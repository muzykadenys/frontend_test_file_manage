import axios from "axios";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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
