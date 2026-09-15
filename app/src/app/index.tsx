import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import StudentApp from "@/screens/StudentApp.dom";
import { login, logout, restoreSession, type AuthSession } from "@/services/auth";
import { answerCloudReview, assertStudentFeature, chatWithLumi, checkBackendHealth, checkDialog, equipStoreItem, evaluatePcm, getAuthorizedAudioSource, getCloudLearningState, getPublishedCourses, purchaseStoreItem, recordLearningEvent, recordUsageHeartbeat, respondToAssignmentFeedback, setApiAccessToken, startCloudReview, transcribePcm, type CloudAssignment, type CloudProgress, type CloudWrongItem, type GrowthSummary, type LearningEventInput, type PointsAccount, type PublishedCourse, type StoreItem } from "@/services/api";
import { createDemoChatReply, createDemoEvaluation } from "@/services/demo-fallback";
import { useSpeechRecorder } from "@/services/speech-recorder";
import type { SpeechRuntime } from "@/types/speech";

export default function Index() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [publishedCourses, setPublishedCourses] = useState<PublishedCourse[]>([]);
  const [cloudProgress, setCloudProgress] = useState<CloudProgress[]>([]);
  const [cloudWrongItems, setCloudWrongItems] = useState<CloudWrongItem[]>([]);
  const [cloudAssignments, setCloudAssignments] = useState<CloudAssignment[]>([]);
  const [points, setPoints] = useState<PointsAccount>({ balance: 0, version: 0 });
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [growth, setGrowth] = useState<GrowthSummary | null>(null);
  const recorder = useSpeechRecorder();
  const cloudPlayback = useRef<{ player: AudioPlayer; finish: () => void } | null>(null);
  const backendHealth = useRef<{ available: boolean; checkedAt: number } | null>(null);
  const canUseBackend = useCallback(async () => {
    const cached = backendHealth.current;
    if (cached && Date.now() - cached.checkedAt < 5_000) return cached.available;
    const available = await checkBackendHealth();
    backendHealth.current = { available, checkedAt: Date.now() };
    return available;
  }, []);

  useEffect(() => {
    let active = true;
    restoreSession().then((session) => {
      if (active) setAuthSession(session);
    }).finally(() => {
      if (active) setAuthReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setApiAccessToken(authSession?.access_token ?? null);
  }, [authSession]);

  useEffect(() => {
    if (!authSession || authSession.user.role !== "student") return;
    let sequence = 0;
    const timer = setInterval(() => {
      if (Platform.OS === "web" && typeof document !== "undefined" && document.visibilityState !== "visible") return;
      sequence += 1;
      void recordUsageHeartbeat(`usage-${authSession.user.id}-${Date.now()}-${sequence}`, 60)
        .catch((error) => console.warn("Could not record active learning time", error));
    }, 60_000);
    return () => clearInterval(timer);
  }, [authSession]);

  const loadCloudLearningState = useCallback(async () => {
    if (!authSession) {
      setCloudProgress([]); setCloudWrongItems([]); setCloudAssignments([]); setPoints({ balance: 0, version: 0 }); setStoreItems([]); setGrowth(null);
      return;
    }
    try {
      const snapshot = await getCloudLearningState();
      setCloudProgress(snapshot.progress); setCloudWrongItems(snapshot.wrongItems); setCloudAssignments(snapshot.assignments);
      setPoints({ balance: snapshot.growth.points, version: 0 }); setStoreItems(snapshot.storeItems); setGrowth(snapshot.growth);
    } catch (error) {
      console.warn("Could not synchronize cloud learning state", error);
    }
  }, [authSession]);

  useEffect(() => { void loadCloudLearningState(); }, [loadCloudLearningState]);

  useEffect(() => {
    let active = true;
    getPublishedCourses()
      .then((courses) => { if (active) setPublishedCourses(courses); })
      .catch((error) => console.warn("Could not load published courses", error));
    return () => { active = false; };
  }, []);

  const handleLogin = useCallback(async (username: string, password: string) => {
    try {
      const session = await login(username, password);
      setAuthSession(session);
      return { ok: true as const, user: { ...session.user } };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "登录失败，请稍后重试" };
    }
  }, []);

  const handleLogout = useCallback(async () => {
    const current = authSession;
    setAuthSession(null);
    await logout(current);
  }, [authSession]);

  const handleLearningEvent = useCallback(async (event: LearningEventInput) => {
    if (!authSession) return { ok: false as const };
    try {
      const result = await recordLearningEvent(event);
      setCloudProgress((items) => [...items.filter((item) => item.client_progress_key !== result.progress.client_progress_key), result.progress]);
      void loadCloudLearningState();
      return { ok: true as const };
    } catch (error) {
      console.warn("Could not sync learning event; local progress remains available", error);
      return { ok: false as const };
    }
  }, [authSession, loadCloudLearningState]);

  const handleStartCloudReview = useCallback(async () => {
    try { return { ok: true as const, session: await startCloudReview() }; }
    catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "暂时无法开始复习" }; }
  }, []);

  const handleCloudReviewAnswer = useCallback(async (sessionId: number, wrongItemId: number, correct: boolean) => {
    try { await answerCloudReview(sessionId, wrongItemId, correct); void loadCloudLearningState(); return { ok: true as const }; }
    catch (error) { console.warn("Could not sync review answer", error); return { ok: false as const }; }
  }, [loadCloudLearningState]);

  const handleAssignmentFeedbackResponse = useCallback(async (assignmentId: number, responseText: string) => {
    try {
      await respondToAssignmentFeedback(assignmentId, responseText);
      await loadCloudLearningState();
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "回复失败，请稍后重试" };
    }
  }, [loadCloudLearningState]);

  const handlePurchase = useCallback(async (itemId: number) => {
    try {
      await purchaseStoreItem(itemId, `store-${authSession?.user.id ?? 0}-${itemId}-${Date.now()}`);
      await loadCloudLearningState();
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "购买失败，请稍后重试" };
    }
  }, [authSession?.user.id, loadCloudLearningState]);

  const handleEquip = useCallback(async (itemId: number) => {
    try {
      await equipStoreItem(itemId); await loadCloudLearningState(); return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "装备失败，请稍后重试" };
    }
  }, [loadCloudLearningState]);

  const stopAndTranscribe = useCallback(async () => {
    const pcm = await recorder.stopRecording();
    if (authSession?.user.role === "student") await assertStudentFeature("voice");
    if (!await canUseBackend()) throw new Error("语音转文字服务暂未连接，请使用键盘或快捷回答");
    return transcribePcm(pcm);
  }, [authSession?.user.role, canUseBackend, recorder.stopRecording]);

  const stopAndEvaluate = useCallback(async (referenceText: string) => {
    const pcm = await recorder.stopRecording();
    if (authSession?.user.role === "student") await assertStudentFeature("voice");
    if (!await canUseBackend()) return createDemoEvaluation(pcm, referenceText);
    try {
      return await evaluatePcm(pcm, referenceText);
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 403) throw error;
      return createDemoEvaluation(pcm, referenceText);
    }
  }, [authSession?.user.role, canUseBackend, recorder.stopRecording]);

  const safeChatWithLumi = useCallback(async (messages: Parameters<typeof chatWithLumi>[0]) => {
    // 聊天接口本身就是最准确的可用性检查。不要先做短超时 health 探测，
    // 否则一次瞬时超时会被缓存，并让接下来数秒的消息全部误走演示回复。
    try {
      if (authSession?.user.role === "student") await assertStudentFeature("ai");
      const reply = await chatWithLumi(messages);
      // DOM 组件方法的返回值必须是完全 JSON 可序列化的普通对象。
      return { english: reply.english, translation: reply.translation };
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 403) throw error;
      console.warn("AI chat request failed; using local demo reply", error);
      return createDemoChatReply(messages);
    }
  }, [authSession?.user.role]);

  const safeCheckDialog = useCallback(async (request: Parameters<typeof checkDialog>[0]) => {
    if (authSession?.user.role === "student") await assertStudentFeature("ai");
    if (!await canUseBackend()) throw new Error("对话服务暂未连接");
    return checkDialog(request);
  }, [authSession?.user.role, canUseBackend]);

  const speakText = useCallback(async (text: string, options?: { rate?: number }) => {
    const systemRate = options?.rate ?? 0.82;
    const cloudRate = options?.rate ?? 1;

    // 云端合成统一使用阿里云音色。直接交给音频播放器加载 URL，Web 和真机
    // 共用同一条链路；后端不可用时再回退到系统 TTS。
    try {
      if (authSession?.user.role === "student") await assertStudentFeature("voice");
      cloudPlayback.current?.finish();
      const params = new URLSearchParams({ text, fmt: "mp3" });
      const player = createAudioPlayer(getAuthorizedAudioSource(`/api/v1/tts/synthesize?${params}`));

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let subscription: { remove: () => void } | undefined;
        const timeout = setTimeout(() => finish(new Error("云端发音加载超时")), 30_000);
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          subscription?.remove();
          player.remove();
          if (cloudPlayback.current?.player === player) cloudPlayback.current = null;
          if (error) reject(error);
          else resolve();
        };

        cloudPlayback.current = { player, finish: () => finish() };
        subscription = player.addListener("playbackStatusUpdate", (status) => {
          if (status.error) finish(new Error(status.error));
          else if (status.didJustFinish) finish();
        });
        player.setPlaybackRate(cloudRate, "high");
        player.play();
      });
      return;
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 403) throw error;
      console.warn("Cloud speech failed; using system speech", error);
    }

    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = systemRate;
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
          rate: systemRate,
          onDone: resolve,
          onStopped: resolve,
          onError: reject,
        });
      } catch (error) {
        reject(error);
      }
    });
  }, [authSession?.user.role]);

  const runtime = useMemo<SpeechRuntime>(() => ({
    startRecording: recorder.startRecording,
    cancelRecording: recorder.cancelRecording,
    stopAndTranscribe,
    stopAndEvaluate,
    chatWithLumi: safeChatWithLumi,
    checkDialog: safeCheckDialog,
    speakText,
  }), [recorder.startRecording, recorder.cancelRecording, safeChatWithLumi, safeCheckDialog, speakText, stopAndEvaluate, stopAndTranscribe]);

  return <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#f7f8fc" }}><StudentApp {...runtime} publishedCourses={publishedCourses} cloudProgress={cloudProgress} cloudWrongItems={cloudWrongItems} cloudAssignments={cloudAssignments} points={points} storeItems={storeItems} growth={growth} onPurchase={handlePurchase} onEquip={handleEquip} onLearningEvent={handleLearningEvent} onStartCloudReview={handleStartCloudReview} onCloudReviewAnswer={handleCloudReviewAnswer} onAssignmentFeedbackResponse={handleAssignmentFeedbackResponse} authReady={authReady} authenticatedUser={authSession?.user ?? null} onLogin={handleLogin} onLogout={handleLogout} dom={{ style: { flex: 1, width: "100%" } }} /></SafeAreaView>;
}
