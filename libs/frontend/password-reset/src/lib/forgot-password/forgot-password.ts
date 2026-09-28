import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import * as Sentry from '@sentry/angular';
import { normalizeEmail, shouldReportAuthFailure } from '../password-reset.utils';

/** Values collected by the forgot-password form. */
interface ForgotPasswordData {
  /** Email address of the account whose password should be reset. */
  email: string;
}

/** Error shape returned by the Better Auth password reset request. */
type AuthError = {
  /** Optional user-facing message returned by the auth server. */
  message?: string | undefined;
  /** HTTP-like status code; `0` represents a network failure. */
  status: number;
};

/**
 * Reports only network and server-side password reset request failures.
 *
 * @param error The error returned by the auth client.
 */
function reportAuthFailure(error: AuthError): void {
  if (!shouldReportAuthFailure(error.status)) {
    return;
  }
  Sentry.captureException(
    new Error(`Password reset request failed: ${error.message ?? 'unknown error'}`),
    {
      tags: { 'auth.flow': 'requestPasswordReset' },
      extra: { status: error.status },
    },
  );
}

@Component({
  selector: 'hiking-downward-forgot-password',
  imports: [NgOptimizedImage, RouterLink, FormField],
  templateUrl: './forgot-password.ng.html',
})
/** Requests a password reset email for an account. */
export class ForgotPassword {
  /** Better Auth client used to request password reset emails. */
  readonly #authClient = inject(FrontendAuth).authClient;
  /** Origin used to build the reset-password redirect URL. */
  readonly #origin = inject(DOCUMENT).location.origin;

  // Validators stay inactive until a submit attempt, so errors only appear afterwards.
  readonly #attempted = signal(false);

  readonly #forgotPasswordModel = signal<ForgotPasswordData>({ email: '' });

  /** Signal Form tree containing email validation. */
  protected readonly forgotPasswordForm = form(this.#forgotPasswordModel, (path) => {
    required(path.email, {
      message: 'Enter your email address.',
      when: () => this.#attempted(),
    });
    email(path.email, {
      message: 'Enter a valid email address.',
      when: () => this.#attempted(),
    });
  });

  /** Whether a reset request is currently in progress. */
  protected readonly pending = signal(false);
  /** User-facing request error, when the latest request failed. */
  protected readonly errorMessage = signal<string | null>(null);
  /** Email address for which the latest reset link was requested. */
  protected readonly resetLinkSentTo = signal<string | null>(null);

  /**
   * Validates the email address and requests a password reset link.
   *
   * @param event The native form-submit event to prevent from reloading the page.
   * @returns A promise that settles after validation and the reset request complete.
   * @throws Propagates unexpected form submission or authentication client failures.
   */
  protected async sendResetLink(event: Event): Promise<void> {
    event.preventDefault();
    this.#attempted.set(true);
    this.errorMessage.set(null);
    this.resetLinkSentTo.set(null);
    await submit(this.forgotPasswordForm, {
      action: async () => {
        this.pending.set(true);
        try {
          await this.#requestReset();
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
   * Sends the reset request with a redirect back to the reset-password page.
   *
   * @returns A promise that settles after the request completes.
   * @throws Propagates unexpected authentication client failures.
   */
  async #requestReset(): Promise<void> {
    const emailAddress = normalizeEmail(this.#forgotPasswordModel().email);
    const { error } = await this.#authClient.requestPasswordReset({
      email: emailAddress,
      redirectTo: `${this.#origin}/reset-password`,
    });

    if (error) {
      reportAuthFailure(error);
      this.errorMessage.set(error.message ?? 'Unable to send a password reset link.');
    } else {
      this.resetLinkSentTo.set(emailAddress);
    }
  }
}
