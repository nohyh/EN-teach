import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { ApiError, getApiBaseUrl } from "@/services/api";

const SESSION_KEY = "lumi-auth-session-v1";

export type AuthUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

type TokenResponse = {
  token_type: "bearer";
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
  user: AuthUser;
};

export type AuthSession = TokenResponse;

async function readStoredValue() {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(SESSION_KEY);
}

async function writeStoredValue(value: string | null) {
  if (Platform.OS === "web") {
    try {
      if (value == null) window.localStorage.removeItem(SESSION_KEY);
      else window.localStorage.setItem(SESSION_KEY, value);
    } catch {
      // Restricted browser storage keeps the session in memory for this run.
    }
    return;
  }
  if (value == null) await SecureStore.deleteItemAsync(SESSION_KEY);
  else await SecureStore.setItemAsync(SESSION_KEY, value);
}

async function authRequest<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, init);
  } catch (error) {
    throw new ApiError(`连接不到学习服务：${error instanceof Error ? error.message : "未知错误"}`);
  }
  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Keep the generic message for non-JSON responses.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function saveSession(session: AuthSession) {
  await writeStoredValue(JSON.stringify(session));
  return session;
}

export async function login(username: string, password: string) {
  const session = await authRequest<AuthSession>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return saveSession(session);
}

export async function restoreSession(): Promise<AuthSession | null> {
  const stored = await readStoredValue();
  if (!stored) return null;
  let session: AuthSession;
  try {
    session = JSON.parse(stored) as AuthSession;
  } catch {
    await writeStoredValue(null);
    return null;
  }

  try {
    const user = await authRequest<AuthUser>("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    return { ...session, user };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) return session;
  }

  try {
    const refreshed = await authRequest<AuthSession>("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    return saveSession(refreshed);
  } catch {
    await writeStoredValue(null);
    return null;
  }
}

export async function logout(session: AuthSession | null) {
  try {
    if (session) {
      await authRequest<void>("/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
    }
  } catch {
    // 本地退出不能被网络故障阻断；服务端会话还会在到期后自然失效。
  } finally {
    await writeStoredValue(null);
  }
}
