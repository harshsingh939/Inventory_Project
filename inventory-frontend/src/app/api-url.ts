/**
 * Browser: relative `/api/...` so `ng serve` can proxy to Node.
 * Use pattern `/api/**` in `src/proxy.conf.json` (Vite only matches `/api` exactly, not subpaths).
 * SSR / prerender: call backend on this machine directly.
 */
const SSR_API_ORIGIN = 'http://127.0.0.1:3000';

export function apiOrigin(): string {
  return typeof document !== 'undefined' ? '' : SSR_API_ORIGIN;
}

/** @param path e.g. `inventories`, `assets/available`, `auth/login`; empty → `/api` */
export function apiUrl(path: string): string {
  const clean = (path ?? '').replace(/^\/+/, '');
  const base = apiOrigin();
  return clean ? `${base}/api/${clean}` : `${base}/api`;
}
