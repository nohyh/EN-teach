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

const REQUEST_TIMEOUT_MS = 60_000;

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
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
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
  form.append("user_id", "mobile-demo");
  const response = await request("/api/v1/speech/evaluate", {
    method: "POST",
    body: form,
  });
  return (await response.json()) as EvaluationResult;
}

export async function chatWithLumi(messages: ChatMessage[]) {
  const response = await request("/api/v1/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, user_id: 2 }),
  });
  return (await response.json()) as ChatReply;
}

export async function checkDialog(requestBody: DialogCheckRequest) {
  const response = await request("/api/v1/ai/dialog-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  return (await response.json()) as DialogCheckResult;
}
