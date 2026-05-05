import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Prerender static shells; parameterized asset routes must be server-rendered
 * (Prerender without `getPrerenderParams` fails the build for `:invId` / `:category`).
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'assets/inv/:invId', renderMode: RenderMode.Server },
  { path: 'assets/:category', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Prerender },
];
