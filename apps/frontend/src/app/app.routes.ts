import type { Route } from '@angular/router';

/** Route configuration for the HikingDownward application. */
export const appRoutes: Route[] = [
  {
    path: 'contact',
    loadComponent: async () => import('@hiking-downward/contact-us').then((m) => m.ContactUs),
    title: 'HikingDownward - Contact Us',
  },
  {
    path: 'sign-in',
    loadComponent: async () => import('@hiking-downward/sign-in').then((m) => m.SignIn),
    title: 'HikingDownward - Sign In',
  },
  {
    path: '401',
    loadComponent: async () => import('@hiking-downward/status-page').then((m) => m.Unauthorized),
    title: 'HikingDownward - 401',
  },
  {
    path: '403',
    loadComponent: async () => import('@hiking-downward/status-page').then((m) => m.Forbidden),
    title: 'HikingDownward - 403',
  },
  {
    path: '**',
    loadComponent: async () => import('@hiking-downward/status-page').then((m) => m.NotFound),
    title: 'HikingDownward - 404',
  },
];
