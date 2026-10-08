import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import { authErrorMessage } from '../account-settings.utils';

/** Editable identity fields returned by the Better Auth user profile. */
interface ProfileData {
  /** Name displayed across the application. */
  name: string;
  /** Unique sign-in username. */
  username: string;
  /** Public-facing username shown to other users. */
  displayUsername: string;
}

/** Loads and updates the signed-in user's profile fields. */
@Component({
  imports: [FormField],
  templateUrl: './profile-settings.ng.html',
})
export class ProfileSettings {
  readonly #authClient = inject(FrontendAuth).authClient;
  readonly #profileModel = signal<ProfileData>({ name: '', username: '', displayUsername: '' });

  protected readonly profileForm = form<ProfileData>(this.#profileModel, (path) => {
    required(path.name, { message: 'Enter your display name.' });
    maxLength(path.name, 80, { message: 'Display name must be 80 characters or fewer.' });
    maxLength(path.displayUsername, 50, {
      message: 'Public username must be 50 characters or fewer.',
    });
    validate(path.username, (context) => {
      const username = context.value().trim();
      if (username.length === 0) {
        return;
      }
      if (username.length < 3 || username.length > 30) {
        return { kind: 'usernameLength', message: 'Username must be 3 to 30 characters.' };
      }
      if (!/^[a-zA-Z0-9_-]+$/u.test(username)) {
        return {
          kind: 'usernameCharacters',
          message: 'Use letters, numbers, underscores, and hyphens only.',
        };
      }
      if (username.toLowerCase() === 'admin') {
        return { kind: 'reservedUsername', message: 'That username is reserved.' };
      }
      return;
    });
  });

  protected readonly loading = signal(true);
  protected readonly pending = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');

  /** Starts loading the current user's profile when the component is created. */
  public constructor() {
    this.#loadProfile().catch(() => {
      this.errorMessage.set('Unable to load your profile. Refresh the page to try again.');
      this.loading.set(false);
    });
  }

  /**
   * Validates and saves the profile form, then announces the outcome.
   *
   * /** Loads the current user's profile into the editable form model.
   *
   * @param event Native form-submit event whose browser navigation is prevented.
   * @returns A promise that settles after form validation and any profile update complete.
   * @throws Propagates unexpected Signal Forms submission failures.
   */
  protected async saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    this.statusMessage.set('');
    this.errorMessage.set('');
    await submit(this.profileForm, {
      action: async () => {
        this.pending.set(true);
        try {
          const profile = this.#profileModel();
          const update: {
            name: string;
            username?: string;
            displayUsername?: string;
          } = { name: profile.name.trim() };
          if (profile.username.trim()) {
            update.username = profile.username.trim();
          }
          if (profile.displayUsername.trim()) {
            update.displayUsername = profile.displayUsername.trim();
          }

          const { error } = await this.#authClient.updateUser(update);
          if (error) {
            this.errorMessage.set(authErrorMessage(error, 'Unable to save your profile.'));
            return;
          }
          this.statusMessage.set('Profile saved.');
        } catch {
          this.errorMessage.set(
            'Unable to save your profile. Check your connection and try again.',
          );
        } finally {
          this.pending.set(false);
        }
      },
      onInvalid: (field) => {
        for (const error of field().errorSummary().slice(0, 1)) {
          error.fieldTree().focusBoundControl();
        }
      },
    });
  }

  /**
   * Loads the current user's profile into the editable form model.
   *
   * @returns A promise that settles after the session response is applied.
   * @throws Propagates failures from the Better Auth session request.
   */
  async #loadProfile(): Promise<void> {
    const { data, error } = await this.#authClient.getSession();
    if (error || !data) {
      this.errorMessage.set('Unable to load your profile. Refresh the page to try again.');
      this.loading.set(false);
      return;
    }
    const user = data.user as {
      name?: string | null;
      username?: string | null;
      displayUsername?: string | null;
    };
    this.#profileModel.set({
      name: user.name ?? '',
      username: user.username ?? '',
      displayUsername: user.displayUsername ?? '',
    });
    this.loading.set(false);
  }
}
