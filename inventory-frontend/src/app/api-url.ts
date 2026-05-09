/**
 * Browser:
 * - Local: relative `/api/...` + `ng serve` proxy (`src/proxy.conf.json`).
 * - Production (e.g. Vercel): build sets `<meta name="api-origin">` from env `BACKEND_ORIGIN`
 *   (see `scripts/patch-api-origin.cjs`). Empty meta → still relative `/api`.
 * SSR / prerender: call backend on this machine directly.
 */
const SSR_API_ORIGIN = 'http://127.0.0.1:3000';

function browserApiOrigin(): string {
  if (typeof document === 'undefined') return '';
  const el = document.querySelector('meta[name="api-origin"]');
  const raw = el?.getAttribute('content')?.trim() ?? '';
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

export function apiOrigin(): string {
  if (typeof document !== 'undefined') {
    return browserApiOrigin();
  }
  return SSR_API_ORIGIN;
}

/** @param path e.g. `inventories`, `assets/available`, `auth/login`; empty → `/api` */
export function apiUrl(path: string): string {
  const clean = (path ?? '').replace(/^\/+/, '');
  const base = apiOrigin();
  return clean ? `${base}/api/${clean}` : `${base}/api`;
}
