import axios from "axios";

/** Same-origin prefix; Next.js proxies to Nest (`BACKEND_URL` in `.env.local`, see `next.config.mjs`). */
const API_PROXY_BASE = "/backend-api";

export function getApiBaseUrl() {
  return API_PROXY_BASE;
}

/**
 * File bytes and multipart uploads should use the API origin directly when `NEXT_PUBLIC_BACKEND_URL`
 * is set (e.g. `http://localhost:4000`). Next.js rewrites (`/backend-api` → backend) can mishandle
 * binary / multipart bodies in dev (empty blobs, empty uploaded files → 400).
 */
export function getBlobFetchBaseUrl(): string {
  if (typeof window !== "undefined") {
    const raw = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (typeof raw === "string" && raw.trim()) {
      return raw.replace(/\/$/, "");
    }
  }
  return getApiBaseUrl();
}

/** Shared client — 401 handling is registered in `src/store/index.ts` (calls `appStore.logout()`). */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
});

/** 401 with a Bearer header means the session token was rejected (e.g. expired). */
export function shouldLogoutOn401(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 401) return false;
  const h = err.config?.headers;
  const auth =
    h && typeof (h as { get?: (key: string) => unknown }).get === "function"
      ? (h as { get: (key: string) => unknown }).get("Authorization")
      : (h as Record<string, string> | undefined)?.Authorization;
  return typeof auth === "string" && auth.startsWith("Bearer ");
}
