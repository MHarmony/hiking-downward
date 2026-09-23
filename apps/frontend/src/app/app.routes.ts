import type { Route } from '@angular/router';

/** Route configuration for the HikingDownward application. */
export const appRoutes: Route[] = [
  {
    path: '401',
    loadComponent: async () => import('@seahawk/status-page').then((m) => m.Unauthorized),
    title: 'HikingDownward - 401',
  },
  {
    path: '403',
    loadComponent: async () => import('@seahawk/status-page').then((m) => m.Forbidden),
    title: 'HikingDownward - 403',
  },
  {
    path: '**',
    loadComponent: async () => import('@seahawk/status-page').then((m) => m.NotFound),
    title: 'HikingDownward - 404',
  },
];
