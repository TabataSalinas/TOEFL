'use client';

import { TokenPair } from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const ACCESS_KEY = 'toefl_access';
const REFRESH_KEY = 'toefl_refresh';

export const tokenStore = {
  get access() {
    return typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;
  },
  get refresh() {
    return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null;
  },
  set(tokens: TokenPair) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && tokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, false);
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokenStore.refresh }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    const tokens = (await res.json()) as TokenPair;
    tokenStore.set(tokens);
    return true;
  } catch {
    tokenStore.clear();
    return false;
  }
}

/** Multipart upload (e.g. speaking recordings). */
async function upload<T>(path: string, form: FormData, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: form, headers });
  if (res.status === 401 && retry && tokenStore.refresh && (await tryRefresh())) return upload<T>(path, form, false);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

/** Authenticated binary fetch → object URL (audio elements cannot send Authorization headers). */
const blobCache = new Map<string, string>();
export async function fetchBlobUrl(path: string): Promise<string> {
  const cached = blobCache.get(path);
  if (cached) return cached;
  const headers: Record<string, string> = {};
  if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;
  let res = await fetch(`${API_URL}${path}`, { headers });
  if (res.status === 401 && tokenStore.refresh && (await tryRefresh())) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
    res = await fetch(`${API_URL}${path}`, { headers });
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  const url = URL.createObjectURL(await res.blob());
  blobCache.set(path, url);
  return url;
}

export const api = {
  upload,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};

export { ApiError };
