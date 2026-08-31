import { useCallback, useMemo, useRef } from "react";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

import ReferenceApp from "@/reference/ReferenceApp.dom";
import { chatWithLumi, checkBackendHealth, checkDialog, evaluatePcm, transcribePcm } from "@/services/api";
import { createDemoChatReply, createDemoEvaluation } from "@/services/demo-fallback";
import { useSpeechRecorder } from "@/services/speech-recorder";
import type { SpeechRuntime } from "@/types/speech";

export default function Index() {
  const recorder = useSpeechRecorder();
  const backendHealth = useRef<{ available: boolean; checkedAt: number } | null>(null);
  const canUseBackend = useCallback(async () => {
    const cached = backendHealth.current;
    if (cached && Date.now() - cached.checkedAt < 5_000) return cached.available;
    const available = await checkBackendHealth();
    backendHealth.current = { available, checkedAt: Date.now() };
    return available;
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    const pcm = await recorder.stopRecording();
    if (!await canUseBackend()) throw new Error("语音转文字服务暂未连接，请使用键盘或快捷回答");
    return transcribePcm(pcm);
  }, [canUseBackend, recorder.stopRecording]);

  const stopAndEvaluate = useCallback(async (referenceText: string) => {
    const pcm = await recorder.stopRecording();
    if (!await canUseBackend()) return createDemoEvaluation(pcm, referenceText);
    try {
      return await evaluatePcm(pcm, referenceText);
    } catch {
      return createDemoEvaluation(pcm, referenceText);
    }
  }, [canUseBackend, recorder.stopRecording]);

  const safeChatWithLumi = useCallback(async (messages: Parameters<typeof chatWithLumi>[0]) => {
    if (!await canUseBackend()) return createDemoChatReply(messages);
    try {
      return await chatWithLumi(messages);
    } catch {
      return createDemoChatReply(messages);
    }
  }, [canUseBackend]);

  const safeCheckDialog = useCallback(async (request: Parameters<typeof checkDialog>[0]) => {
    if (!await canUseBackend()) throw new Error("对话服务暂未连接");
    return checkDialog(request);
  }, [canUseBackend]);

  const speakText = useCallback(async (text: string, options?: { rate?: number }) => {
    const rate = options?.rate ?? 0.82;
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = rate;
        utterance.onend = () => resolve();
        // 浏览器可能因切换页面、连续点击或缺少语音包取消播报；这是可恢复状态，不抛到 React。
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
      return;
    }

    try {
      await Speech.stop();
    } catch {
      // 某些原生语音引擎在没有活动播报时会拒绝 stop，忽略即可。
    }
    await new Promise<void>((resolve, reject) => {
      try {
        Speech.speak(text, {
          language: "en-US",
          rate,
          onDone: resolve,
          onStopped: resolve,
          onError: reject,
        });
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const runtime = useMemo<SpeechRuntime>(() => ({
    startRecording: recorder.startRecording,
    cancelRecording: recorder.cancelRecording,
    stopAndTranscribe,
    stopAndEvaluate,
    chatWithLumi: safeChatWithLumi,
    checkDialog: safeCheckDialog,
    speakText,
  }), [recorder.startRecording, recorder.cancelRecording, safeChatWithLumi, safeCheckDialog, speakText, stopAndEvaluate, stopAndTranscribe]);

  return <ReferenceApp {...runtime} dom={{ style: { flex: 1, width: "100%" } }} />;
}
