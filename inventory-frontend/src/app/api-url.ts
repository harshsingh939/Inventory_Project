import { environment } from '../environments/environment';

/**
 * Browser: `environment.apiOrigin` (prod build from BACKEND_ORIGIN; dev empty → relative `/api` + proxy).
 * SSR: `environment.ssrApiOrigin` (backend on same host as Node SSR).
 */
export function apiOrigin(): string {
  const raw =
    typeof document !== 'undefined'
      ? environment.apiOrigin
      : environment.ssrApiOrigin;
  return (raw ?? '').trim().replace(/\/$/, '');
}

/** @param path e.g. `inventories`, `assets/available`, `auth/login`; empty → `/api` */
export function apiUrl(path: string): string {
  const clean = (path ?? '').replace(/^\/+/, '');
  const base = apiOrigin();
  return clean ? `${base}/api/${clean}` : `${base}/api`;
}
