import { useCallback, useMemo } from "react";
import * as Speech from "expo-speech";

import ReferenceApp from "@/reference/ReferenceApp.dom";
import { chatWithLumi, checkDialog, evaluatePcm, transcribePcm } from "@/services/api";
import { useSpeechRecorder } from "@/services/speech-recorder";
import type { SpeechRuntime } from "@/types/speech";

export default function Index() {
  const recorder = useSpeechRecorder();

  const stopAndTranscribe = useCallback(async () => {
    const pcm = await recorder.stopRecording();
    return transcribePcm(pcm);
  }, [recorder.stopRecording]);

  const stopAndEvaluate = useCallback(async (referenceText: string) => {
    const pcm = await recorder.stopRecording();
    return evaluatePcm(pcm, referenceText);
  }, [recorder.stopRecording]);

  const speakText = useCallback(async (text: string) => {
    await Speech.stop();
    await new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        language: "en-US",
        rate: 0.82,
        onDone: resolve,
        onStopped: resolve,
        onError: reject,
      });
    });
  }, []);

  const runtime = useMemo<SpeechRuntime>(() => ({
    startRecording: recorder.startRecording,
    cancelRecording: recorder.cancelRecording,
    stopAndTranscribe,
    stopAndEvaluate,
    chatWithLumi,
    checkDialog,
    speakText,
  }), [recorder.startRecording, recorder.cancelRecording, speakText, stopAndEvaluate, stopAndTranscribe]);

  return <ReferenceApp {...runtime} dom={{ style: { flex: 1, width: "100%" } }} />;
}
