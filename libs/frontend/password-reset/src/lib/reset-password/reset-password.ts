import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import * as Sentry from '@sentry/angular';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordsMatch,
  resetToken,
  shouldReportAuthFailure,
} from '../password-reset.utils';

/** Values collected by the reset-password form. */
interface ResetPasswordData {
  /** New password for the account. */
  password: string;
  /** Repeated new password used to detect entry mistakes. */
  passwordConfirmation: string;
}

/** Error shape returned by the Better Auth password reset method. */
type AuthError = {
  /** Optional user-facing message returned by the auth server. */
  message?: string | undefined;
  /** HTTP-like status code; `0` represents a network failure. */
  status: number;
};

/**
 * Reports only network and server-side password reset failures.
 *
 * @param error The error returned by the auth client.
 */
function reportAuthFailure(error: AuthError): void {
  if (!shouldReportAuthFailure(error.status)) {
    return;
  }
  Sentry.captureException(new Error(`Password reset failed: ${error.message ?? 'unknown error'}`), {
    tags: { 'auth.flow': 'resetPassword' },
    extra: { status: error.status },
  });
}

@Component({
  selector: 'hiking-downward-reset-password',
  imports: [NgOptimizedImage, RouterLink, FormField],
  templateUrl: './reset-password.ng.html',
})
/** Sets a new password using the token from a password reset email. */
export class ResetPassword {
  /** Better Auth client used to reset passwords. */
  readonly #authClient = inject(FrontendAuth).authClient;
  /** Query parameters Better Auth appended when redirecting from the reset email. */
  readonly #queryParams = inject(ActivatedRoute).snapshot.queryParamMap;
  /** Reset token from the link, or empty when the link is unusable. */
  readonly #token = resetToken(this.#queryParams.get('token'), this.#queryParams.get('error'));

  // Validators stay inactive until a submit attempt, so errors only appear afterwards.
  readonly #attempted = signal(false);

  readonly #resetPasswordModel = signal<ResetPasswordData>({
    password: '',
    passwordConfirmation: '',
  });

  /** Whether the reset link carried a usable token. */
  protected readonly linkUsable = this.#token !== '';

  /** Signal Form tree containing password policy validators. */
  protected readonly resetPasswordForm = form(this.#resetPasswordModel, (path) => {
    required(path.password, {
      message: 'Enter a new password.',
      when: () => this.#attempted(),
    });
    minLength(path.password, MIN_PASSWORD_LENGTH, {
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      when: () => this.#attempted(),
    });
    maxLength(path.password, MAX_PASSWORD_LENGTH, {
      message: `Password must be no more than ${MAX_PASSWORD_LENGTH} characters.`,
      when: () => this.#attempted(),
    });
    required(path.passwordConfirmation, {
      message: 'Confirm your new password.',
      when: () => this.#attempted(),
    });
    validate(path.passwordConfirmation, (context) => {
      if (this.#attempted() && !passwordsMatch(context.valueOf(path.password), context.value())) {
        return { kind: 'passwordMismatch', message: 'Passwords must match.' };
      }
      return;
    });
  });

  /** Whether a reset request is currently in progress. */
  protected readonly pending = signal(false);
  /** User-facing reset error, when the latest request failed. */
  protected readonly errorMessage = signal<string | null>(null);
  /** Whether the password was reset successfully. */
  protected readonly passwordReset = signal(false);

  /**
   * Validates the new password and submits it with the reset token.
   *
   * @param event The native form-submit event to prevent from reloading the page.
   * @returns A promise that settles after validation and the reset request complete.
   * @throws Propagates unexpected form submission or authentication client failures.
   */
  protected async resetPassword(event: Event): Promise<void> {
    event.preventDefault();
    this.#attempted.set(true);
    this.errorMessage.set(null);
    await submit(this.resetPasswordForm, {
      action: async () => {
        this.pending.set(true);
        try {
          await this.#submitNewPassword();
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
   * Sends the new password and token to Better Auth.
   *
   * @returns A promise that settles after the request completes.
   * @throws Propagates unexpected authentication client failures.
   */
  async #submitNewPassword(): Promise<void> {
    const { error } = await this.#authClient.resetPassword({
      newPassword: this.#resetPasswordModel().password,
      token: this.#token,
    });

    if (error) {
      reportAuthFailure(error);
      this.errorMessage.set(error.message ?? 'Unable to reset your password.');
    } else {
      this.passwordReset.set(true);
    }
  }
}
