import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
} from "expo-audio";
import { useCallback, useEffect, useRef } from "react";

const TARGET_SAMPLE_RATE = 16_000;
const MIN_DURATION_SECONDS = 0.35;
const MAX_DURATION_SECONDS = 60;

type BrowserCapture = {
  context: AudioContext;
  mediaStream: MediaStream;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
};

function joinChunks(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

function downmixPcm16(input: Int16Array, channels: number) {
  if (channels <= 1) return input;
  const output = new Int16Array(Math.floor(input.length / channels));
  for (let frame = 0; frame < output.length; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      sum += input[frame * channels + channel] ?? 0;
    }
    output[frame] = Math.max(-32768, Math.min(32767, Math.round(sum / channels)));
  }
  return output;
}

/** 线性插值到 16kHz，保证 NLS/SSECP 两条链路使用同一份 PCM。 */
export function resamplePcm16(input: Int16Array, sourceRate: number, targetRate = TARGET_SAMPLE_RATE) {
  if (!input.length || sourceRate === targetRate) return input.slice();
  const outputLength = Math.max(1, Math.round(input.length * targetRate / sourceRate));
  const output = new Int16Array(outputLength);
  const ratio = sourceRate / targetRate;
  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.min(input.length - 1, Math.floor(sourcePosition));
    const right = Math.min(input.length - 1, left + 1);
    const fraction = sourcePosition - left;
    output[index] = Math.round(input[left] * (1 - fraction) + input[right] * fraction);
  }
  return output;
}

function validatePcm(pcm: Int16Array) {
  const seconds = pcm.length / TARGET_SAMPLE_RATE;
  if (seconds < MIN_DURATION_SECONDS) {
    throw new Error("录音太短了，请至少说半秒钟");
  }
  if (seconds > MAX_DURATION_SECONDS) {
    throw new Error("一次最多录音 60 秒，请缩短后重试");
  }
}

export function useSpeechRecorder() {
  const chunksRef = useRef<Uint8Array[]>([]);
  const sourceRateRef = useRef(TARGET_SAMPLE_RATE);
  const channelsRef = useRef(1);
  const recordingRef = useRef(false);
  const browserCaptureRef = useRef<BrowserCapture | null>(null);

  const onNativeBuffer = useCallback((buffer: { data: ArrayBuffer; sampleRate: number; channels: number }) => {
    if (!recordingRef.current) return;
    chunksRef.current.push(new Uint8Array(buffer.data).slice());
    sourceRateRef.current = buffer.sampleRate;
    channelsRef.current = buffer.channels;
  }, []);

  const { stream } = useAudioStream({
    sampleRate: TARGET_SAMPLE_RATE,
    channels: 1,
    encoding: "int16",
    onBuffer: onNativeBuffer,
  });

  const reset = useCallback(() => {
    chunksRef.current = [];
    sourceRateRef.current = TARGET_SAMPLE_RATE;
    channelsRef.current = 1;
  }, []);

  const stopBrowserCapture = useCallback(async () => {
    const capture = browserCaptureRef.current;
    browserCaptureRef.current = null;
    if (!capture) return;
    capture.processor.onaudioprocess = null;
    capture.mediaStream.getTracks().forEach((track) => track.stop());
    capture.source.disconnect();
    capture.processor.disconnect();
    capture.silentGain.disconnect();
    await capture.context.close();
  }, []);

  const startRecording = useCallback(async () => {
    if (recordingRef.current) return;
    reset();

    if (process.env.EXPO_OS === "web") {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("当前浏览器不支持麦克风录音");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      try {
        const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
        const source = context.createMediaStreamSource(mediaStream);
        const processor = context.createScriptProcessor(4096, 1, 1);
        const silentGain = context.createGain();
        silentGain.gain.value = 0;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(context.destination);
        sourceRateRef.current = context.sampleRate;
        channelsRef.current = 1;
        processor.onaudioprocess = (event) => {
          if (!recordingRef.current) return;
          const samples = event.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(samples.length);
          for (let index = 0; index < samples.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, samples[index]));
            pcm[index] = sample < 0 ? sample * 32768 : sample * 32767;
          }
          chunksRef.current.push(new Uint8Array(pcm.buffer).slice());
        };
        browserCaptureRef.current = { context, mediaStream, source, processor, silentGain };
        recordingRef.current = true;
        await context.resume();
      } catch (error) {
        mediaStream.getTracks().forEach((track) => track.stop());
        throw error;
      }
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error("需要麦克风权限才能进行语音输入和跟读评分");
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    recordingRef.current = true;
    try {
      await stream.start();
    } catch (error) {
      recordingRef.current = false;
      await setAudioModeAsync({ allowsRecording: false });
      throw error;
    }
  }, [reset, stream]);

  const cancelRecording = useCallback(async () => {
    const wasRecording = recordingRef.current;
    recordingRef.current = false;
    if (process.env.EXPO_OS === "web") {
      await stopBrowserCapture();
    } else if (wasRecording) {
      try {
        stream.stop();
      } finally {
        await setAudioModeAsync({ allowsRecording: false });
      }
    }
    reset();
  }, [reset, stopBrowserCapture, stream]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) throw new Error("还没有开始录音");
    recordingRef.current = false;
    if (process.env.EXPO_OS === "web") {
      await stopBrowserCapture();
    } else {
      try {
        stream.stop();
      } finally {
        await setAudioModeAsync({ allowsRecording: false });
      }
    }

    const joined = joinChunks(chunksRef.current);
    const usableBytes = joined.byteLength - joined.byteLength % 2;
    const interleaved = new Int16Array(joined.buffer, joined.byteOffset, usableBytes / 2);
    const mono = downmixPcm16(interleaved, channelsRef.current);
    const pcm = resamplePcm16(mono, sourceRateRef.current);
    reset();
    validatePcm(pcm);
    return pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
  }, [reset, stopBrowserCapture, stream]);

  useEffect(() => () => {
    recordingRef.current = false;
    if (process.env.EXPO_OS === "web") {
      void stopBrowserCapture();
    }
    // Native AudioStream is a SharedObject owned and released by useAudioStream.
    // Touching it from this later unmount cleanup races with that release on Android.
  }, [stopBrowserCapture]);

  return { startRecording, stopRecording, cancelRecording };
}
