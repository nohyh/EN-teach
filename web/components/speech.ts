// 语音相关工具: 16kHz 单声道 PCM 录音 + 转文字上传
// 被 AI 伙伴页 (app/page.tsx) 和口语对话题 (components/learning-components.tsx) 共用

export const API_BASE = "http://localhost:8000"; // 后端 FastAPI 地址 (见 C:\demo8\api)

// 开始录音, 返回 stop() 函数; 调用 stop() 得到 PCM 字节 (16kHz mono Int16)
export async function startPcmRecording(): Promise<() => Uint8Array> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const silence = audioCtx.createGain();
  silence.gain.value = 0; // 只让 onaudioprocess 跑, 不把麦克风声音放出来
  const chunks: Uint8Array[] = [];
  processor.onaudioprocess = (event) => {
    const data = event.inputBuffer.getChannelData(0);
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    chunks.push(new Uint8Array(int16.buffer));
  };
  source.connect(processor);
  processor.connect(silence);
  silence.connect(audioCtx.destination);
  return () => {
    source.disconnect();
    processor.disconnect();
    void audioCtx.close();
    stream.getTracks().forEach((t) => t.stop());
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  };
}

// 把 PCM 上传给后端转成文字
export async function transcribePcm(pcm: Uint8Array): Promise<string> {
  const form = new FormData();
  form.append("audio", new Blob([pcm], { type: "application/octet-stream" }), "speech.pcm");
  form.append("fmt", "pcm");
  form.append("sample_rate", "16000");
  const res = await fetch(`${API_BASE}/api/v1/speech/transcribe`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`STT 错误: ${res.status}`);
  const data = await res.json();
  return data.text as string;
}
