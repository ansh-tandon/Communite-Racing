import { demoFetch } from '../demo/demoApi';

const TOKEN_KEY = 'crql.token';
const TIMEOUT_MS = 15_000;

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const DEMO = import.meta.env.VITE_DEMO === 'true' || !API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Per-question validation messages from the backend: { questionId: message } */
    public errors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: (): string | null => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } },
};

/** Fired when the server says the session is no longer valid. AuthProvider listens. */
export const SESSION_EXPIRED = 'crql:session-expired';

function detailOf(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '');
  }
  if (status >= 500) return 'The server had a problem. Try again in a moment.';
  return 'Something went wrong.';
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const token = tokenStore.get();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  if (DEMO) {
    res = await demoFetch(path, { method, body: init.body, token });
  } else {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      res = await fetch(API_URL + path, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new ApiError(
        (e as Error).name === 'AbortError' ? 'The server took too long to answer.' : 'No connection. Check your internet and try again.',
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
    const errors = body && typeof body === 'object' && 'errors' in body ? (body as { errors: Record<string, string> }).errors : undefined;
    throw new ApiError(detailOf(body, res.status), res.status, errors);
  }
  return body as T;
}
