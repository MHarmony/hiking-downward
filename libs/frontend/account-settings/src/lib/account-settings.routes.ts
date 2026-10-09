import type { Routes } from '@angular/router';
import { AccountSettings } from './account-settings/account-settings';

/**
 * Nested routes for the signed-in account settings area.
 *
 * The parent route renders the settings navigation and child outlet.
 */
export const accountSettingsRoutes: Routes = [
  {
    path: '',
    component: AccountSettings,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        loadComponent: async () =>
          import('./profile-settings/profile-settings').then((m) => m.ProfileSettings),
        title: 'HikingDownward - Profile Settings',
      },
      {
        path: 'security',
        loadComponent: async () =>
          import('./security-settings/security-settings').then((m) => m.SecuritySettings),
        title: 'HikingDownward - Security Settings',
      },
      {
        path: 'account',
        loadComponent: async () => import('./danger-zone/danger-zone').then((m) => m.DangerZone),
        title: 'HikingDownward - Account Settings',
      },
    ],
  },
];
