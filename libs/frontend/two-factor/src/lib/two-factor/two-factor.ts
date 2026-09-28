import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import * as Sentry from '@sentry/angular';
import {
  codeError,
  normalizeCode,
  shouldReportAuthFailure,
  type TwoFactorMethod,
} from './two-factor.utils';

/** Values collected by the two-factor form. */
interface TwoFactorData {
  /** Authenticator or backup code entered by the user. */
  code: string;
  /** Whether the server should skip two-factor checks on this device for 30 days. */
  trustDevice: boolean;
}

/** Error shape returned by Better Auth two-factor methods. */
type AuthError = {
  /** Optional user-facing message returned by the auth server. */
  message?: string | undefined;
  /** HTTP-like status code; `0` represents a network failure. */
  status: number;
};

/**
 * Reports only network and server-side verification failures.
 *
 * @param method The verification method that produced the failure.
 * @param error The error returned by the auth client.
 */
function reportAuthFailure(method: TwoFactorMethod, error: AuthError): void {
  if (!shouldReportAuthFailure(error.status)) {
    return;
  }
  Sentry.captureException(
    new Error(`Two-factor verification failed: ${error.message ?? 'unknown error'}`),
    {
      tags: { 'auth.method': method },
      extra: { status: error.status },
    },
  );
}

@Component({
  selector: 'hiking-downward-two-factor',
  imports: [NgOptimizedImage, RouterLink, FormField],
  templateUrl: './two-factor.ng.html',
})
/** Completes a pending sign-in with an authenticator app code or a backup code. */
export class TwoFactor {
  /** Better Auth client used to verify two-factor codes. */
  readonly #authClient = inject(FrontendAuth).authClient;
  /** Router used to navigate after successful verification. */
  readonly #router = inject(Router);

  // Validators stay inactive until a submit attempt, so errors only appear afterwards.
  readonly #attempted = signal(false);

  readonly #twoFactorModel = signal<TwoFactorData>({ code: '', trustDevice: false });

  /** Verification method currently offered to the user. */
  protected readonly method = signal<TwoFactorMethod>('totp');

  /** Signal Form tree containing method-specific code validation. */
  protected readonly twoFactorForm = form(this.#twoFactorModel, (path) => {
    validate(path.code, (context) => {
      const message = this.#attempted() ? codeError(this.method(), context.value()) : null;
      if (message !== null) {
        return { kind: 'code', message };
      }
      return;
    });
  });

  /** Whether a verification request is currently in progress. */
  protected readonly pending = signal(false);
  /** User-facing verification error, when the latest request failed. */
  protected readonly errorMessage = signal<string | null>(null);

  /** Switches between authenticator app and backup code verification. */
  protected toggleMethod(): void {
    this.method.update((method) => (method === 'totp' ? 'backupCode' : 'totp'));
    this.#attempted.set(false);
    this.errorMessage.set(null);
    this.#twoFactorModel.update((value) => ({ ...value, code: '' }));
  }

  /**
   * Verifies the entered code with the selected method and completes sign-in.
   *
   * @param event The native form-submit event to prevent from reloading the page.
   * @returns A promise that settles after validation, verification, and navigation complete.
   * @throws Propagates unexpected form submission, authentication client, or navigation failures.
   */
  protected async verify(event: Event): Promise<void> {
    event.preventDefault();
    this.#attempted.set(true);
    this.errorMessage.set(null);
    await submit(this.twoFactorForm, {
      action: async () => {
        this.pending.set(true);
        try {
          await this.#verifyCode();
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
   * Sends the entered code to the endpoint for the selected verification method.
   *
   * @returns A promise that settles after verification and any navigation complete.
   * @throws Propagates unexpected authentication client or navigation failures.
   */
  async #verifyCode(): Promise<void> {
    const method = this.method();
    const { code: rawCode, trustDevice } = this.#twoFactorModel();
    const code = normalizeCode(rawCode);
    const { error } =
      method === 'totp'
        ? await this.#authClient.twoFactor.verifyTotp({ code, trustDevice })
        : await this.#authClient.twoFactor.verifyBackupCode({ code, trustDevice });

    if (error) {
      reportAuthFailure(method, error);
      this.errorMessage.set(error.message ?? 'Unable to verify your code.');
    } else {
      await this.#router.navigateByUrl('/');
    }
  }
}
