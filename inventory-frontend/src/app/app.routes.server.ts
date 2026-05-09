import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Prerender static shells; parameterized asset routes must be server-rendered
 * (Prerender without `getPrerenderParams` fails the build for `:invId` / `:category`).
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'assets/inv/:invId', renderMode: RenderMode.Server },
  { path: 'assets/:category', renderMode: RenderMode.Server },
  /** Admin repair detail — dynamic `:id`; prerender would require getPrerenderParams */
  { path: 'repair-review/:id', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Prerender },
];
