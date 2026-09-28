import type { Route } from '@angular/router';
import {
  emailVerificationResultGuard,
  pendingTwoFactorGuard,
  signUpCompletionGuard,
} from '@hiking-downward/frontend-auth';

/** Route configuration for the HikingDownward application. */
export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: async () => import('@hiking-downward/home').then((m) => m.Home),
    title: 'HikingDownward',
  },
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
    path: 'sign-up',
    loadComponent: async () => import('@hiking-downward/sign-up').then((m) => m.SignUp),
    title: 'HikingDownward - Sign Up',
  },
  {
    path: 'sign-up/complete',
    canActivate: [signUpCompletionGuard],
    loadComponent: async () => import('@hiking-downward/sign-up').then((m) => m.SignUpComplete),
    title: 'HikingDownward - Sign Up Complete',
  },
  {
    path: 'two-factor',
    canActivate: [pendingTwoFactorGuard],
    loadComponent: async () => import('@hiking-downward/two-factor').then((m) => m.TwoFactor),
    title: 'HikingDownward - Two-Factor Authentication',
  },
  {
    path: 'forgot-password',
    loadComponent: async () =>
      import('@hiking-downward/password-reset').then((m) => m.ForgotPassword),
    title: 'HikingDownward - Forgot Password',
  },
  {
    path: 'reset-password',
    loadComponent: async () =>
      import('@hiking-downward/password-reset').then((m) => m.ResetPassword),
    title: 'HikingDownward - Reset Password',
  },
  {
    path: 'verify-email/result',
    canActivate: [emailVerificationResultGuard],
    loadComponent: async () =>
      import('@hiking-downward/verify-email').then((m) => m.VerifyEmailResult),
    title: 'HikingDownward - Verify Email',
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
