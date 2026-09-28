import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import * as Sentry from '@sentry/angular';
import {
  normalizeEmail,
  shouldReportAuthFailure,
  verificationErrorMessage,
} from './verify-email.utils';

/** Values collected by the resend-verification form. */
interface ResendVerificationData {
  /** Email address that should receive a new verification link. */
  email: string;
}

/** Error shape returned by the Better Auth verification email method. */
type AuthError = {
  /** Optional user-facing message returned by the auth server. */
  message?: string | undefined;
  /** HTTP-like status code; `0` represents a network failure. */
  status: number;
};

/**
 * Reports only network and server-side verification email failures.
 *
 * @param error The error returned by the auth client.
 */
function reportAuthFailure(error: AuthError): void {
  if (!shouldReportAuthFailure(error.status)) {
    return;
  }
  Sentry.captureException(
    new Error(`Verification email request failed: ${error.message ?? 'unknown error'}`),
    {
      tags: { 'auth.flow': 'sendVerificationEmail' },
      extra: { status: error.status },
    },
  );
}

@Component({
  selector: 'hiking-downward-verify-email-result',
  imports: [NgOptimizedImage, RouterLink, FormField],
  templateUrl: './verify-email-result.ng.html',
})
/** Shows the outcome of an email verification link and offers a new link on failure. */
export class VerifyEmailResult {
  /** Better Auth client used to resend verification emails. */
  readonly #auth = inject(FrontendAuth);
  readonly #authClient = this.#auth.authClient;
  /** Origin used to build the verification callback URL. */
  readonly #origin = inject(DOCUMENT).location.origin;
  /** Error code Better Auth appended when verification failed. */
  readonly #errorCode = inject(ActivatedRoute).snapshot.queryParamMap.get('error');

  // Validators stay inactive until a submit attempt, so errors only appear afterwards.
  readonly #attempted = signal(false);

  readonly #resendModel = signal<ResendVerificationData>({ email: '' });

  /** Explanation of the verification failure, or `null` when verification succeeded. */
  protected readonly failureMessage =
    this.#errorCode === null ? null : verificationErrorMessage(this.#errorCode);

  /** Signal Form tree containing email validation for resending verification. */
  protected readonly resendForm = form(this.#resendModel, (path) => {
    required(path.email, {
      message: 'Enter your email address.',
      when: () => this.#attempted(),
    });
    email(path.email, {
      message: 'Enter a valid email address.',
      when: () => this.#attempted(),
    });
  });

  /** Whether a resend request is currently in progress. */
  protected readonly pending = signal(false);
  /** User-facing resend error, when the latest request failed. */
  protected readonly errorMessage = signal<string | null>(null);
  /** Email address to which the latest verification link was requested. */
  protected readonly verificationSentTo = signal<string | null>(null);

  /**
   * Validates the email address and requests a new verification link.
   *
   * @param event The native form-submit event to prevent from reloading the page.
   * @returns A promise that settles after validation and the resend request complete.
   * @throws Propagates unexpected form submission or authentication client failures.
   */
  protected async resendVerification(event: Event): Promise<void> {
    event.preventDefault();
    this.#attempted.set(true);
    this.errorMessage.set(null);
    this.verificationSentTo.set(null);
    await submit(this.resendForm, {
      action: async () => {
        this.pending.set(true);
        try {
          await this.#sendVerificationEmail();
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
   * Requests a verification email that returns to this page.
   *
   * @returns A promise that settles after the request completes.
   * @throws Propagates unexpected authentication client failures.
   */
  async #sendVerificationEmail(): Promise<void> {
    const emailAddress = normalizeEmail(this.#resendModel().email);
    const { error } = await this.#authClient.sendVerificationEmail({
      email: emailAddress,
      callbackURL: this.#auth.emailVerificationCallbackUrl(this.#origin),
    });

    if (error) {
      reportAuthFailure(error);
      this.errorMessage.set(error.message ?? 'Unable to send a verification email.');
    } else {
      this.verificationSentTo.set(emailAddress);
    }
  }
}
