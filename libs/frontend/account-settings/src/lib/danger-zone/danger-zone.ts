/// <reference types="@angular/localize" />

import { DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, submit, validate } from '@angular/forms/signals';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import { authErrorMessage } from '../account-settings.utils';

/** Form values required to request email-confirmed account deletion. */
interface DeleteAccountData {
  /** Optional password used to reauthenticate the deletion request. */
  password: string;
  /** Exact phrase the user must enter before a deletion request is sent. */
  confirmation: string;
}

/** Collects explicit confirmation before requesting account deletion. */
@Component({
  imports: [FormField],
  templateUrl: './danger-zone.ng.html',
})
/* v8 ignore start */
export class DangerZone {
  /* v8 ignore stop */
  readonly #auth = inject(FrontendAuth);
  readonly #authClient = this.#auth.authClient;
  readonly #origin = inject(DOCUMENT).location.origin;
  readonly #deleteModel = signal<DeleteAccountData>({ password: '', confirmation: '' });

  private readonly deleteForm = form(this.#deleteModel, (path) => {
    maxLength(path.password, 128, {
      message: $localize`Password must be no more than 128 characters.`,
    });
    validate(path.confirmation, (context) => {
      if (context.value().trim() !== 'DELETE') {
        return {
          kind: 'confirmation',
          message: $localize`Type DELETE to confirm account deletion.`,
        };
      }
      return;
    });
  });

  private readonly emailAddress = signal('');
  private readonly pending = signal(false);
  private readonly statusMessage = signal('');
  private readonly errorMessage = signal('');

  /** Loads the account email shown with the deletion confirmation request. */
  public constructor() {
    this.#loadEmail().catch(() => {
      this.emailAddress.set($localize`your account email address`);
    });
  }

  /**
   * Validates the confirmation and requests the server's deletion email.
   *
   * @param event Native form-submit event whose browser navigation is prevented.
   * @returns A promise that settles after validation and the deletion request complete.
   * @throws Propagates unexpected Signal Forms submission failures.
   */
  private async requestDeletion(event: Event): Promise<void> {
    event.preventDefault();
    this.statusMessage.set('');
    this.errorMessage.set('');
    await submit(this.deleteForm, {
      action: async () => {
        this.pending.set(true);
        try {
          const password = this.#deleteModel().password.trim();
          const options = password
            ? { password, callbackURL: this.#auth.localizedUrl(this.#origin, '/account-deleted') }
            : { callbackURL: this.#auth.localizedUrl(this.#origin, '/account-deleted') };
          const { error } = await this.#authClient.deleteUser(options);
          if (error) {
            this.errorMessage.set(
              authErrorMessage(error, $localize`Unable to request account deletion.`),
            );
            return;
          }
          this.#deleteModel.set({ password: '', confirmation: '' });
          this.statusMessage.set(
            $localize`A confirmation link was sent to ${this.emailAddress()}:emailAddress:. Use that link to complete deletion.`,
          );
        } catch {
          this.errorMessage.set(
            $localize`Unable to request account deletion. Check your connection and try again.`,
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
   * Reads the current account email for the confirmation status message.
   *
   * @returns A promise that settles after the session response is applied.
   * @throws Propagates failures from the Better Auth session request.
   */
  async #loadEmail(): Promise<void> {
    const { data } = await this.#authClient.getSession();
    this.emailAddress.set(data ? data.user.email : $localize`your account email address`);
  }
}
