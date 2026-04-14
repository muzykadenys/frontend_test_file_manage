import { apiClient, getBlobFetchBaseUrl } from './apiClient';

export type AuthHeaderOpts = { userId?: string; userEmail?: string };

/** Supports legacy `authHeaders(token, userId)` or `authHeaders(token, { userId, userEmail })`. */
export function authHeaders(token: string, userIdOrOpts?: string | AuthHeaderOpts) {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (typeof userIdOrOpts === 'string') {
    if (userIdOrOpts) h['X-User-Id'] = userIdOrOpts;
  } else if (userIdOrOpts) {
    if (userIdOrOpts.userId) h['X-User-Id'] = userIdOrOpts.userId;
    if (userIdOrOpts.userEmail) h['X-User-Email'] = userIdOrOpts.userEmail;
  }
  return h;
}

/**
 * Binary file streams must use the Fetch API — axios `responseType: 'blob'` is unreliable in the browser
 * with some proxies/transports and can yield empty or unusable blobs.
 */
async function fetchBlob(path: string, init?: RequestInit): Promise<Blob> {
  const url = `${getBlobFetchBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = init?.headers as Record<string, string> | Headers | undefined;
  const hadBearer =
    headers &&
    (headers instanceof Headers
      ? headers.get('Authorization')?.startsWith('Bearer ')
      : typeof (headers as Record<string, string>).Authorization === 'string' &&
        (headers as Record<string, string>).Authorization.startsWith('Bearer '));

  const res = await fetch(url, { ...init, mode: 'cors', credentials: 'omit' });

  if (res.status === 401 && hadBearer && typeof window !== 'undefined') {
    const { appStore } = await import('@/store/appStore');
    appStore.logout();
  }

  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    let message = res.statusText || `HTTP ${res.status}`;
    if (ct.includes('application/json')) {
      try {
        const j = (await res.json()) as { message?: string | string[] };
        const m = j.message;
        message = Array.isArray(m) ? m.join(', ') : (m ?? message);
      } catch {
        /* ignore */
      }
    } else {
      try {
        const t = await res.text();
        if (t && t.length < 500) message = t.slice(0, 240);
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }

  return res.blob();
}

export async function loginRequest(email: string, password: string) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data;
}

export async function registerRequest(email: string, password: string) {
  const { data } = await apiClient.post('/auth/register', { email, password });
  return data;
}

export async function listItems(token: string, parentId: string | null, opts?: AuthHeaderOpts) {
  const q = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
  const { data } = await apiClient.get(`/items${q}`, { headers: authHeaders(token, opts) });
  return data as { items: import('@/store/types').Item[] };
}

export async function listSharedWithMe(
  token: string,
  parentId: string | null,
  opts: { userId?: string; userEmail?: string | null },
) {
  const q = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
  const { data } = await apiClient.get(`/items/shared-with-me${q}`, {
    headers: authHeaders(token, {
      userId: opts.userId,
      userEmail: opts.userEmail ?? undefined,
    }),
  });
  return data as { items: import('@/store/types').Item[] };
}

export async function searchItems(token: string, q: string) {
  const { data } = await apiClient.get(`/items/search?q=${encodeURIComponent(q)}`, {
    headers: authHeaders(token),
  });
  return data as { items: import('@/store/types').Item[] };
}

export async function deleteItem(token: string, id: string) {
  await apiClient.delete(`/items/${id}`, { headers: authHeaders(token) });
}

export async function createFolder(token: string, body: { name: string; parentId?: string | null; isPublic?: boolean }) {
  const { data } = await apiClient.post('/items/folder', body, { headers: authHeaders(token) });
  return data;
}

/**
 * Multipart upload must hit the API origin when `NEXT_PUBLIC_BACKEND_URL` is set — same as `fetchBlob`.
 * Next.js rewrites to the Nest app can break multipart bodies in dev, yielding an empty file and 400.
 */
export async function uploadFile(
  token: string,
  file: File,
  opts: { parentId?: string | null; name?: string; isPublic?: boolean; userId?: string | null },
) {
  const fd = new FormData();
  fd.append('file', file);
  if (opts.parentId) fd.append('parentId', opts.parentId);
  if (opts.name) fd.append('name', opts.name);
  fd.append('isPublic', opts.isPublic ? 'true' : 'false');
  const base = getBlobFetchBaseUrl().replace(/\/$/, '');
  const uploadUrl = `${base}/items/upload`;
  const { data } = await apiClient.post(uploadUrl, fd, {
    headers: authHeaders(token, { userId: opts.userId ?? undefined }),
  });
  return data;
}

export async function renameItem(token: string, id: string, name: string) {
  const { data } = await apiClient.patch(`/items/${id}`, { name }, { headers: authHeaders(token) });
  return data;
}

export async function togglePublic(token: string, id: string, isPublic: boolean) {
  const { data } = await apiClient.patch(`/items/${id}`, { isPublic: Boolean(isPublic) }, { headers: authHeaders(token) });
  return data;
}

export async function cloneItem(token: string, id: string) {
  const { data } = await apiClient.post(`/items/${id}/clone`, {}, { headers: authHeaders(token) });
  return data;
}

export async function reorderItems(token: string, items: { id: string; sortOrder: number }[]) {
  await apiClient.patch('/items/reorder', { items }, { headers: authHeaders(token) });
}

export async function getFileUrl(
  token: string,
  id: string,
  opts?: { userId?: string; userEmail?: string | null },
) {
  const { data } = await apiClient.get(`/items/${id}/file-url`, {
    headers: authHeaders(token, {
      userId: opts?.userId,
      userEmail: opts?.userEmail ?? undefined,
    }),
  });
  return data as { url: string };
}

/** Authenticated file bytes — use for preview/download so the client never receives a Supabase signed URL. */
export async function fetchItemFileBlob(
  token: string,
  id: string,
  opts?: { userId?: string; userEmail?: string | null },
) {
  return fetchBlob(`/items/${encodeURIComponent(id)}/file`, {
    headers: authHeaders(token, {
      userId: opts?.userId,
      userEmail: opts?.userEmail ?? undefined,
    }),
  });
}

export async function getItemContext(
  token: string,
  id: string,
  opts?: { userId?: string; userEmail?: string | null },
) {
  const { data } = await apiClient.get(`/items/${id}/context`, {
    headers: authHeaders(token, {
      userId: opts?.userId,
      userEmail: opts?.userEmail ?? undefined,
    }),
  });
  return data as {
    item: import('@/store/types').Item;
    pathFromRoot: { id: string; name: string }[];
  };
}

export async function shareItem(
  token: string,
  id: string,
  body: { email: string; permission: 'read' | 'write' | 'admin'; createPublicLink?: boolean },
) {
  const { data } = await apiClient.post(`/items/${id}/share`, body, { headers: authHeaders(token) });
  return data as { share: unknown; publicPath: string | null };
}

export async function listItemShares(
  token: string,
  itemId: string,
  opts?: { userId?: string; userEmail?: string | null },
) {
  const { data } = await apiClient.get(`/items/${itemId}/shares`, {
    headers: authHeaders(token, {
      userId: opts?.userId,
      userEmail: opts?.userEmail ?? undefined,
    }),
  });
  return data as {
    shares: { id: string; email: string; permission: string; created_at?: string }[];
  };
}

export async function revokeItemShare(
  token: string,
  itemId: string,
  shareId: string,
  opts?: { userId?: string; userEmail?: string | null },
) {
  await apiClient.delete(`/items/${itemId}/shares/${shareId}`, {
    headers: authHeaders(token, {
      userId: opts?.userId,
      userEmail: opts?.userEmail ?? undefined,
    }),
  });
}

export async function getPublicShare(token: string) {
  const { data } = await apiClient.get(`/public/share/${encodeURIComponent(token)}`);
  return data as {
    permission: string;
    item: { id: string; name: string; item_type: string; is_public: boolean; mime_type?: string | null };
  };
}

/** Public share token — stream file bytes (no Supabase signed URL). */
export async function fetchPublicShareFileBlob(shareToken: string) {
  return fetchBlob(`/public/share/${encodeURIComponent(shareToken)}/file`);
}

/** Anonymous browse: public item metadata + path (same shape as getItemContext). */
export async function getPublicItemContext(id: string) {
  const { data } = await apiClient.get(`/public/items/${encodeURIComponent(id)}/context`);
  return data as {
    item: import('@/store/types').Item;
    pathFromRoot: { id: string; name: string }[];
  };
}

export async function listPublicChildren(parentId: string) {
  const { data } = await apiClient.get(`/public/items/${encodeURIComponent(parentId)}/children`);
  return data as { items: import('@/store/types').Item[] };
}

/** Public item file bytes — no auth (item must be in public chain). */
export async function fetchPublicItemFileBlob(itemId: string) {
  return fetchBlob(`/public/items/${encodeURIComponent(itemId)}/file`);
}
