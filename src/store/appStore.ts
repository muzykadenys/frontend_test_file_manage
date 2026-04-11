import * as api from "@/lib/api";
import { axiosErrorMessage } from "@/lib/axiosError";
import { normalizeUploadedFileDisplayName } from "@/lib/transliterateFileName";
import {
  AUTH_LOGIN_FAILURE,
  AUTH_LOGIN_REQUEST,
  AUTH_LOGIN_SUCCESS,
  AUTH_LOGOUT,
  AUTH_REGISTER_DONE,
  AUTH_REGISTER_REQUEST,
  AUTH_RESTORE,
  FILES_LOAD_FAILURE,
  FILES_LOAD_REQUEST,
  FILES_LOAD_SUCCESS,
  FILES_PARENT_SET_SYNC,
  FILES_SEARCH,
  FILES_SEARCH_RESET,
  FILES_SEARCH_SUCCESS,
  FILES_UPLOAD_PENDING_ADD,
  FILES_UPLOAD_PENDING_REMOVE,
  FILES_VIEW_MODE_SET,
} from "./actionTypes";
import { authReducer } from "./authReducer";
import { filesReducer } from "./filesReducer";
import type { AuthState, FilesViewMode, FilesState } from "./types";

const STORAGE_KEY = "fm_auth";

export type RootState = {
  auth: AuthState;
  files: FilesState;
};

function persist(payload: { accessToken: string; user: { id: string; email?: string } }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function readPersist(): { accessToken: string; user: { id: string; email?: string } } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { accessToken: string; user: { id: string; email?: string } };
  } catch {
    return null;
  }
}

function clearPersist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function combine(
  auth: AuthState,
  files: FilesState,
  nextAuth: AuthState,
  nextFiles: FilesState,
): RootState | null {
  if (nextAuth === auth && nextFiles === files) return null;
  return { auth: nextAuth, files: nextFiles };
}

export type AppStoreApi = {
  getState: () => RootState;
  subscribe: (listener: () => void) => () => void;
  /** Login (email + password). */
  login: (email: string, password: string) => Promise<void>;
  /** Register then auto-login when possible. */
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Hydrate session from `localStorage` (call once on app load). */
  restoreSession: () => void;
  /** Load items for current `viewMode` + `parentId` (after navigation / refresh). */
  loadFiles: (opts?: { parentId?: string | null }) => Promise<void>;
  /** Switch mine/shared and reset folder depth; then loads list. */
  setViewMode: (viewMode: FilesViewMode, parentId?: string | null) => Promise<void>;
  /** Updates search query and runs search (mine view only). */
  search: (q: string) => Promise<void>;
  setFilesError: (message: string) => void;
  createFolder: (name: string, isPublic?: boolean) => Promise<void>;
  uploadFile: (file: File, opts: { clientId: string; isPublic?: boolean; name?: string }) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  renameItem: (id: string, name: string) => Promise<void>;
  togglePublic: (id: string, isPublic: boolean) => Promise<void>;
  cloneItem: (id: string) => Promise<void>;
  reorderItems: (items: { id: string; sortOrder: number }[]) => Promise<void>;
};

export function createAppStore(): AppStoreApi {
  let state: RootState = {
    auth: authReducer(undefined, { type: "@@INIT" }),
    files: filesReducer(undefined, { type: "@@INIT" }),
  };
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((l) => l());
  }

  function dispatch(action: { type: string; payload?: unknown }) {
    const nextAuth = authReducer(state.auth, action);
    const nextFiles = filesReducer(state.files, action);
    const merged = combine(state.auth, state.files, nextAuth, nextFiles);
    if (!merged) return;
    state = merged;
    notify();
  }

  function getState(): RootState {
    return state;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function executeLoadFiles(): Promise<void> {
    const token = state.auth.accessToken;
    if (!token) {
      dispatch({ type: FILES_LOAD_SUCCESS, payload: { items: [] } });
      return;
    }
    const parentId = state.files.parentId;
    const viewMode = state.files.viewMode;
    const userId = state.auth.user?.id;
    const userEmail = state.auth.user?.email;
    const authOpts = { userId, userEmail };
    try {
      const data = parentId
        ? await api.listItems(token, parentId, authOpts)
        : viewMode === "shared"
          ? await api.listSharedWithMe(token, null, authOpts)
          : await api.listItems(token, null, authOpts);
      dispatch({ type: FILES_LOAD_SUCCESS, payload: { items: data.items } });
    } catch (e: unknown) {
      dispatch({ type: FILES_LOAD_FAILURE, payload: axiosErrorMessage(e) });
    }
  }

  async function loadFiles(opts?: { parentId?: string | null }): Promise<void> {
    dispatch({ type: FILES_LOAD_REQUEST, payload: opts ?? {} });
    if (opts && Object.prototype.hasOwnProperty.call(opts, "parentId")) {
      dispatch({
        type: FILES_PARENT_SET_SYNC,
        payload: { parentId: opts.parentId ?? null },
      });
    }
    await executeLoadFiles();
  }

  async function setViewMode(viewMode: FilesViewMode, parentId?: string | null): Promise<void> {
    dispatch({ type: FILES_VIEW_MODE_SET, payload: { viewMode, parentId } });
    await executeLoadFiles();
  }

  async function executeSearch(): Promise<void> {
    const token = state.auth.accessToken;
    if (!token) return;
    if (state.files.viewMode === "shared") {
      dispatch({ type: FILES_SEARCH_RESET });
      return;
    }
    const q = state.files.searchQuery.trim();
    if (!q) {
      dispatch({ type: FILES_SEARCH_RESET });
      return;
    }
    try {
      const data = await api.searchItems(token, q);
      dispatch({ type: FILES_SEARCH_SUCCESS, payload: { items: data.items } });
    } catch {
      dispatch({ type: FILES_SEARCH_SUCCESS, payload: { items: [] } });
    }
  }

  async function search(q: string): Promise<void> {
    dispatch({ type: FILES_SEARCH, payload: { q } });
    await executeSearch();
  }

  function setFilesError(message: string): void {
    dispatch({ type: FILES_LOAD_FAILURE, payload: message });
  }

  async function login(email: string, password: string): Promise<void> {
    dispatch({ type: AUTH_LOGIN_REQUEST });
    try {
      const res = await api.loginRequest(email, password);
      if (!res.ok || !res.accessToken) {
        dispatch({ type: AUTH_LOGIN_FAILURE, payload: { message: res.message ?? "Login failed" } });
        return;
      }
      const payload = { accessToken: res.accessToken, user: res.user! };
      dispatch({ type: AUTH_LOGIN_SUCCESS, payload });
      persist(payload);
      await loadFiles({ parentId: null });
    } catch (e: unknown) {
      dispatch({ type: AUTH_LOGIN_FAILURE, payload: { message: axiosErrorMessage(e) } });
    }
  }

  async function register(email: string, password: string): Promise<void> {
    dispatch({ type: AUTH_REGISTER_REQUEST });
    try {
      const res = await api.registerRequest(email, password);
      if (!res.ok) {
        dispatch({
          type: AUTH_REGISTER_DONE,
          payload: { ok: false, message: res.message ?? "Registration failed" },
        });
        return;
      }
      const loginRes = await api.loginRequest(email, password);
      if (!loginRes.ok || !loginRes.accessToken) {
        dispatch({
          type: AUTH_REGISTER_DONE,
          payload: { ok: true, message: "Account created. Please sign in." },
        });
        return;
      }
      const payload = { accessToken: loginRes.accessToken, user: loginRes.user! };
      dispatch({ type: AUTH_LOGIN_SUCCESS, payload });
      persist(payload);
      await loadFiles({ parentId: null });
    } catch (e: unknown) {
      dispatch({ type: AUTH_REGISTER_DONE, payload: { ok: false, message: axiosErrorMessage(e) } });
    }
  }

  function logout(): void {
    clearPersist();
    dispatch({ type: AUTH_LOGOUT });
  }

  function restoreSession(): void {
    const saved = readPersist();
    if (saved?.accessToken) {
      dispatch({ type: AUTH_RESTORE, payload: saved });
    }
  }

  async function createFolder(name: string, isPublic?: boolean): Promise<void> {
    const token = state.auth.accessToken;
    const parentId = state.files.parentId;
    if (!token) return;
    await api.createFolder(token, { name, parentId, isPublic });
    await loadFiles({});
  }

  async function uploadFile(
    file: File,
    opts: { clientId: string; isPublic?: boolean; name?: string },
  ): Promise<void> {
    const token = state.auth.accessToken;
    const parentId = state.files.parentId;
    const userId = state.auth.user?.id;
    if (!token) return;
    const { clientId } = opts;
    const displayName = normalizeUploadedFileDisplayName(opts.name ?? file.name);
    dispatch({ type: FILES_UPLOAD_PENDING_ADD, payload: { clientId, name: displayName } });
    try {
      await api.uploadFile(token, file, {
        parentId,
        name: displayName,
        isPublic: opts.isPublic,
        userId,
      });
      await loadFiles({});
    } catch (e: unknown) {
      dispatch({ type: FILES_LOAD_FAILURE, payload: axiosErrorMessage(e) });
    } finally {
      dispatch({ type: FILES_UPLOAD_PENDING_REMOVE, payload: { clientId } });
    }
  }

  async function deleteItem(id: string): Promise<void> {
    const token = state.auth.accessToken;
    if (!token) return;
    await api.deleteItem(token, id);
    await loadFiles({});
  }

  async function renameItem(id: string, name: string): Promise<void> {
    const token = state.auth.accessToken;
    if (!token) return;
    await api.renameItem(token, id, name);
    await loadFiles({});
  }

  async function togglePublic(id: string, isPublic: boolean): Promise<void> {
    const token = state.auth.accessToken;
    if (!token) return;
    await api.togglePublic(token, id, isPublic);
    await loadFiles({});
  }

  async function cloneItem(id: string): Promise<void> {
    const token = state.auth.accessToken;
    if (!token) return;
    await api.cloneItem(token, id);
    await loadFiles({});
  }

  async function reorderItems(items: { id: string; sortOrder: number }[]): Promise<void> {
    const token = state.auth.accessToken;
    if (!token) return;
    await api.reorderItems(token, items);
    await loadFiles({});
  }

  return {
    getState,
    subscribe,
    login,
    register,
    logout,
    restoreSession,
    loadFiles,
    setViewMode,
    search,
    setFilesError,
    createFolder,
    uploadFile,
    deleteItem,
    renameItem,
    togglePublic,
    cloneItem,
    reorderItems,
  };
}

export const appStore = createAppStore();
