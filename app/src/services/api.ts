import Constants from "expo-constants";
import { Blob as ExpoBlob } from "expo-blob";
import { fetch } from "expo/fetch";

import type {
  ChatMessage,
  ChatReply,
  DialogCheckRequest,
  DialogCheckResult,
  EvaluationResult,
} from "@/types/speech";
import type { LessonSection } from "@/types/lesson";

export interface PublishedCourse {
  id: number;
  slug: string;
  title: string;
  version: number;
  published_at: string;
  manifest: Record<string, unknown>;
  content: {
    title: string;
    intro: string;
    sections: LessonSection[];
  };
}

export interface CloudProgress {
  client_progress_key: string;
  course_ref: string;
  section_id: string;
  completed_activities: number;
  total_activities: number;
  status: "in_progress" | "completed";
}

export interface CloudWrongItem {
  id: number;
  kind: "word" | "sentence" | "recall" | "pronunciation" | "dialog";
  prompt: string;
  correct_answer?: string;
  course_ref: string;
  section_id: string;
  error_count: number;
  review_count: number;
  mastery_level: number;
  correct_streak: number;
  status: "active" | "mastered";
  next_review_at: string;
}

export interface CloudAssignment {
  id: number;
  title: string;
  course_ref: string;
  section_id: string;
  total_activities: number;
  due_at?: string;
  instructions: string;
  progress: { completed_activities: number; status: "not_started" | "in_progress" | "completed"; completed_at?: string };
  feedback?: {
    id: number;
    comment: string;
    encouragement_tag?: "great_progress" | "keep_practicing" | "careful_work" | "confident_speaking";
    revision: number;
    teacher: { id: number; name: string };
    student_response?: string;
    responded_at?: string;
    updated_at: string;
  };
}

export interface StoreItem {
  id: number;
  slug: string;
  name: string;
  description?: string;
  category: "skin" | "outfit" | "background" | "badge" | "theme";
  price: number;
  asset_url?: string;
  preview?: string;
  owned: boolean;
  equipped: boolean;
}

export interface PointsAccount {
  balance: number;
  version: number;
  updated_at?: string;
}

export interface GrowthSummary {
  learning_events: number;
  weekly_learning_events: number;
  completed_lessons: number;
  completed_assignments: number;
  mastered_items: number;
  review_total: number;
  review_correct: number;
  review_accuracy: number;
  points: number;
  badges: Array<{ code: string; name: string; description: string; icon: string; awarded_at: string }>;
}

export interface LearningPolicyStatus {
  settings: {
    is_configured: boolean;
    learning_enabled: boolean;
    daily_limit_minutes: number;
    allowed_start: string;
    allowed_end: string;
    timezone: string;
    voice_enabled: boolean;
    ai_enabled: boolean;
  };
  usage: { date: string; active_seconds: number; used_minutes: number; remaining_minutes: number };
  access: { allowed: boolean; reason?: string; message?: string };
}

export type LearningEventInput = {
  idempotency_key: string;
  course_ref: string;
  course_id?: number;
  client_progress_key: string;
  section_id: string;
  activity_index: number;
  activity_type: "word" | "sentence" | "recall" | "pronunciation" | "dialog";
  knowledge_key?: string;
  prompt: string;
  correct_answer?: string;
  user_answer?: string;
  correct: boolean;
  completed_activities: number;
  total_activities: number;
};

const REQUEST_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 1_500;
let accessToken: string | null = null;

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function getAuthorizedAudioSource(path: string) {
  return {
    uri: `${getApiBaseUrl()}${path}`,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

/**
 * 真机开发时自动使用 Metro 所在电脑的局域网 IP；生产/EAS 必须通过
 * EXPO_PUBLIC_API_BASE_URL 指向 HTTPS 后端。
 */
export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured) return trimTrailingSlash(configured);

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.replace(/^https?:\/\//, "").split(":")[0];
  return `http://${host || "127.0.0.1"}:8000`;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = new Headers(init.headers);
    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = `请求失败 (${response.status})`;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        // 非 JSON 错误页保留通用提示。
      }
      throw new ApiError(detail, response.status);
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("请求超时，请检查网络后重试");
    }
    throw new ApiError(`连接不到学习服务：${error instanceof Error ? error.message : "未知错误"}`);
  } finally {
    clearTimeout(timeout);
  }
}

function pcmForm(pcm: ArrayBuffer) {
  const form = new FormData();
  const blob = new ExpoBlob([pcm], { type: "application/octet-stream" });
  form.append("audio", blob as unknown as Blob, "speech.pcm");
  form.append("fmt", "pcm");
  form.append("sample_rate", "16000");
  return form;
}

export async function transcribePcm(pcm: ArrayBuffer) {
  const response = await request("/api/v1/speech/transcribe", {
    method: "POST",
    body: pcmForm(pcm),
  });
  const body = (await response.json()) as { text: string };
  return body.text;
}

export async function evaluatePcm(pcm: ArrayBuffer, referenceText: string) {
  const form = pcmForm(pcm);
  form.append("reference_text", referenceText);
  const response = await request("/api/v1/speech/evaluate", {
    method: "POST",
    body: form,
  });
  return (await response.json()) as EvaluationResult;
}

export async function chatWithLumi(messages: ChatMessage[]) {
  // 不把空的模型回复带回后端；一次异常空回复不应污染后续整段会话。
  // 与后端 MAX_HISTORY 保持一致，只提交最近 20 条有效消息。
  const history = messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-20);
  const response = await request("/api/v1/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history }),
  });
  const body = (await response.json()) as Partial<ChatReply>;
  // expo/fetch 的 JSON 结果可能带有运行时对象原型；显式重建为普通、可序列化对象，
  // 保证通过 Expo DOM bridge 后 english / translation 字段不会丢失。
  return {
    english: typeof body.english === "string" ? body.english : "",
    translation: typeof body.translation === "string" ? body.translation : "",
  } satisfies ChatReply;
}

export async function checkDialog(requestBody: DialogCheckRequest) {
  const response = await request("/api/v1/ai/dialog-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  return (await response.json()) as DialogCheckResult;
}

export async function checkBackendHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPublishedCourses() {
  const listResponse = await request("/api/v1/courses", { method: "GET" });
  const summaries = (await listResponse.json()) as Array<Omit<PublishedCourse, "content">>;
  return Promise.all(summaries.map(async (course) => {
    const response = await request(`/api/v1/courses/${encodeURIComponent(course.slug)}`, { method: "GET" });
    return (await response.json()) as PublishedCourse;
  }));
}

export async function getCloudLearningState() {
  const [progressResponse, wrongResponse, assignmentResponse, storeResponse, growthResponse] = await Promise.all([
    request("/api/v1/me/progress", { method: "GET" }),
    request("/api/v1/me/wrong-items", { method: "GET" }),
    request("/api/v1/assignments", { method: "GET" }),
    request("/api/v1/store/items", { method: "GET" }),
    request("/api/v1/me/growth", { method: "GET" }),
  ]);
  return {
    progress: await progressResponse.json() as CloudProgress[],
    wrongItems: await wrongResponse.json() as CloudWrongItem[],
    assignments: await assignmentResponse.json() as CloudAssignment[],
    storeItems: await storeResponse.json() as StoreItem[],
    growth: await growthResponse.json() as GrowthSummary,
  };
}

export async function getLearningPolicy() {
  const response = await request("/api/v1/me/learning-policy", { method: "GET" });
  return await response.json() as LearningPolicyStatus;
}

export async function assertStudentFeature(feature?: "voice" | "ai") {
  const policy = await getLearningPolicy();
  if (!policy.access.allowed) throw new ApiError(policy.access.message || "当前不能继续学习", 403);
  if (feature === "voice" && !policy.settings.voice_enabled) throw new ApiError("家长已关闭语音功能", 403);
  if (feature === "ai" && !policy.settings.ai_enabled) throw new ApiError("家长已关闭 AI 对话功能", 403);
  return policy;
}

export async function recordUsageHeartbeat(idempotencyKey: string, activeSeconds = 60) {
  const response = await request("/api/v1/me/usage-heartbeats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotency_key: idempotencyKey, active_seconds: activeSeconds }),
  });
  return await response.json() as LearningPolicyStatus & { duplicate: boolean; recorded_seconds: number };
}

export async function recordLearningEvent(input: LearningEventInput) {
  const response = await request("/api/v1/me/learning-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await response.json() as { event_id: number; duplicate: boolean; progress: CloudProgress };
}

export async function respondToAssignmentFeedback(assignmentId: number, responseText: string) {
  const response = await request(`/api/v1/assignments/${assignmentId}/feedback/response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: responseText }),
  });
  return await response.json() as CloudAssignment;
}

export async function startCloudReview(maxItems = 15) {
  const response = await request("/api/v1/me/review-sessions", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max_items: maxItems }),
  });
  return await response.json() as { id: number; status: string; item_count: number; items: CloudWrongItem[] };
}

export async function answerCloudReview(sessionId: number, wrongItemId: number, correct: boolean) {
  const response = await request(`/api/v1/me/review-sessions/${sessionId}/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotency_key: `review-answer-${sessionId}-${wrongItemId}`,
      wrong_item_id: wrongItemId,
      correct,
    }),
  });
  return await response.json() as { interval_days: number; item: CloudWrongItem; session: { status: string } };
}

export async function purchaseStoreItem(itemId: number, idempotencyKey: string) {
  const response = await request("/api/v1/store/purchases", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId, idempotency_key: idempotencyKey }),
  });
  return await response.json() as { item_id: number; price_paid: number; duplicate: boolean; balance: number };
}

export async function equipStoreItem(itemId: number) {
  const response = await request(`/api/v1/me/assets/${itemId}/equip`, { method: "PUT" });
  return await response.json() as { item_id: number; equipped: true; assets: StoreItem[] };
}
