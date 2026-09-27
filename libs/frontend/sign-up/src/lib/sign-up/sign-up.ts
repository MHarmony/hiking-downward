import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  maxLength,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import * as Sentry from '@sentry/angular';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  passwordsMatch,
  shouldReportAuthFailure,
} from './sign-up.utils';

/** Values collected by the sign-up form. */
interface SignUpData {
  /** Email address used to create the account. */
  email: string;
  /** Password used for password-based registration. */
  password: string;
  /** Repeated password used to detect entry mistakes. */
  passwordConfirmation: string;
}

/** Error shape returned by Better Auth sign-up methods. */
type AuthError = {
  /** Optional user-facing message returned by the auth server. */
  message?: string | undefined;
  /** HTTP-like status code; `0` represents a network failure. */
  status: number;
};

/**
 * Reports network and server-side registration failures.
 *
 * @param method The registration flow that produced the failure.
 * @param error The error returned by the auth client.
 */
function reportAuthFailure(method: 'email' | 'magicLink', error: AuthError): void {
  if (!shouldReportAuthFailure(error.status)) {
    return;
  }
  Sentry.captureException(
    new Error(`Sign-up request failed: ${error.message ?? 'unknown error'}`),
    {
      tags: { 'auth.method': method },
      extra: { status: error.status },
    },
  );
}

@Component({
  selector: 'hiking-downward-sign-up',
  imports: [NgOptimizedImage, RouterLink, FormField],
  templateUrl: './sign-up.ng.html',
  styleUrl: './sign-up.css',
})
/** Presents email/password and magic-link registration flows. */
export class SignUp {
  /** Better Auth client used to execute registration requests. */
  readonly #authClient = inject(FrontendAuth).authClient;
  /** Origin used to build registration callback URLs. */
  readonly #origin = inject(DOCUMENT).location.origin;
  /** Signal containing the current registration field values. */
  readonly #signUpModel = signal<SignUpData>({
    email: '',
    password: '',
    passwordConfirmation: '',
  });
  /** Registration flow whose validators are active for the current attempt. */
  readonly #method = signal<'email' | 'magicLink' | null>(null);

  /** Signal Form tree containing method-specific registration validators. */
  protected readonly signUpForm = form(this.#signUpModel, (path) => {
    required(path.email, {
      message: 'Enter your email address.',
      when: () => this.#method() !== null,
    });
    email(path.email, {
      message: 'Enter a valid email address.',
      when: () => this.#method() !== null,
    });
    required(path.password, {
      message: 'Enter a password.',
      when: () => this.#method() === 'email',
    });
    minLength(path.password, MIN_PASSWORD_LENGTH, {
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      when: () => this.#method() === 'email',
    });
    maxLength(path.password, MAX_PASSWORD_LENGTH, {
      message: `Password must be no more than ${MAX_PASSWORD_LENGTH} characters.`,
      when: () => this.#method() === 'email',
    });
    required(path.passwordConfirmation, {
      message: 'Confirm your password.',
      when: () => this.#method() === 'email',
    });
    validate(path.passwordConfirmation, (context) => {
      if (
        this.#method() === 'email' &&
        !passwordsMatch(context.valueOf(path.password), context.value())
      ) {
        return { kind: 'passwordMismatch', message: 'Passwords must match.' };
      }
      return;
    });
  });

  /** Whether a registration request is currently in progress. */
  protected readonly pending = signal(false);
  /** User-facing registration error, when the latest request failed. */
  protected readonly errorMessage = signal<string | null>(null);
  /** Email address to which the latest verification or magic-link email was sent. */
  protected readonly verificationSentTo = signal<string | null>(null);

  /**
   * Creates an account using the entered email address and password.
   *
   * @param event The native form-submit event to prevent from reloading the page.
   * @returns A promise that settles after validation and the registration request complete.
   * @throws Propagates unexpected form submission or authentication client failures.
   */
  protected async signUpWithPassword(event: Event): Promise<void> {
    event.preventDefault();
    await this.#run('email', async () => {
      const { email: rawEmail, password } = this.#signUpModel();
      const emailAddress = normalizeEmail(rawEmail);
      const { error } = await this.#authClient.signUp.email({
        email: emailAddress,
        name: emailAddress,
        password,
        callbackURL: `${this.#origin}/`,
      });

      if (error) {
        reportAuthFailure('email', error);
        this.errorMessage.set(error.message ?? 'Unable to create your account.');
        return;
      }
      this.verificationSentTo.set(emailAddress);
    });
  }

  /**
   * Sends a magic-link registration email for the entered address.
   *
   * @returns A promise that settles after validation and the email request complete.
   * @throws Propagates unexpected form submission or authentication client failures.
   */
  protected async sendMagicLink(): Promise<void> {
    this.#method.set('magicLink');
    this.#clearMessages();
    await submit(this.signUpForm, {
      action: async () => {
        this.pending.set(true);
        try {
          const emailAddress = normalizeEmail(this.#signUpModel().email);
          const { error } = await this.#authClient.signIn.magicLink({
            email: emailAddress,
            name: emailAddress,
            callbackURL: `${this.#origin}/`,
            newUserCallbackURL: `${this.#origin}/sign-up/complete`,
          });
          if (error) {
            reportAuthFailure('magicLink', error);
            this.errorMessage.set(error.message ?? 'Unable to send a sign-up link.');
            return;
          }
          this.verificationSentTo.set(emailAddress);
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
   * Runs a password registration action after applying its form schema.
   *
   * @param method The registration flow whose validators should be active.
   * @param action The validated registration operation to execute.
   * @returns A promise that settles after validation and the action complete.
   * @throws Propagates unexpected form submission or action failures.
   */
  async #run(method: 'email', action: () => Promise<void>): Promise<void> {
    this.#method.set(method);
    this.#clearMessages();
    await submit(this.signUpForm, {
      action: async () => {
        this.pending.set(true);
        try {
          await action();
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

  /** Clears user-facing results from the preceding registration attempt. */
  #clearMessages(): void {
    this.errorMessage.set(null);
    this.verificationSentTo.set(null);
  }
}
