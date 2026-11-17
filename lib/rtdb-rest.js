import { adminApp } from './firebase-admin.js';
import { db } from './exam-server.js';

const DEFAULT_TIMEOUT_MS = 4500;
const ABORT = Symbol('ABORT');

export function abortTx(errorMessage, status = 409) {
  return { [ABORT]: true, error: errorMessage, status };
}

async function authEndpoint(path) {
  const app = adminApp();
  const baseUrl = String(app.options.databaseURL || process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    // Triggers clear Firebase diagnostic error if databaseURL missing
    db();
  }
  const tokenObj = await app.options.credential.getAccessToken();
  const accessToken = tokenObj?.access_token;
  if (!accessToken) throw new Error('Không lấy được access token cho Realtime Database.');
  return `${baseUrl}/${String(path || '').replace(/^\/+/, '')}.json?access_token=${encodeURIComponent(accessToken)}`;
}

export async function rtdbGet(path, { withEtag = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = await authEndpoint(path);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: withEtag ? { 'X-Firebase-ETag': 'true' } : undefined,
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!res.ok) throw Object.assign(new Error(`RTDB GET ${res.status}`), { status: 502 });
    const etag = res.headers.get('ETag') || null;
    const val = await res.json();
    return withEtag ? { val, etag } : val;
  } finally {
    clearTimeout(timer);
  }
}

export async function rtdbPut(path, value, { etag = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = await authEndpoint(path);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (etag) headers['if-match'] = etag;
    const res = await fetch(url, {
      method: value === null ? 'DELETE' : 'PUT',
      headers,
      body: value === null ? undefined : JSON.stringify(value),
      signal: ctrl.signal
    });
    if (res.status === 412) return { ok: false, conflict: true, val: null };
    if (!res.ok) throw Object.assign(new Error(`RTDB PUT ${res.status}`), { status: 502 });
    const val = value === null ? null : await res.json();
    return { ok: true, conflict: false, val };
  } finally {
    clearTimeout(timer);
  }
}

export async function rtdbTransaction(path, mutator, { maxRetries = 6 } = {}) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { val, etag } = await rtdbGet(path, { withEtag: true });
    const next = await mutator(val);
    if (next && typeof next === 'object' && next[ABORT]) {
      throw Object.assign(new Error(next.error || 'Thao tác bị từ chối.'), { status: next.status || 409 });
    }
    if (next === undefined) {
      return { committed: false, val };
    }
    const writeRes = await rtdbPut(path, next, { etag: etag || '*' });
    if (writeRes.ok) {
      return { committed: true, val: writeRes.val };
    }
  }
  throw Object.assign(new Error('Dữ liệu vừa được cập nhật đồng thời. Hãy thử lại.'), { status: 409 });
}
