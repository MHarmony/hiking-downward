import type { Routes } from '@angular/router';
import { AccountSettings } from './account-settings/account-settings';
import { DangerZone } from './danger-zone/danger-zone';
import { ProfileSettings } from './profile-settings/profile-settings';
import { SecuritySettings } from './security-settings/security-settings';

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
      { path: 'profile', component: ProfileSettings, title: 'HikingDownward - Profile Settings' },
      {
        path: 'security',
        component: SecuritySettings,
        title: 'HikingDownward - Security Settings',
      },
      { path: 'account', component: DangerZone, title: 'HikingDownward - Account Settings' },
    ],
  },
];
