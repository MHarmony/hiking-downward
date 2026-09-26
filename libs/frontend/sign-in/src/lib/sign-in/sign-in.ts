import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { afterNextRender, Component, inject, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import * as Sentry from '@sentry/angular';
import {
  identifierMethod,
  normalizeIdentifier,
  shouldReportAuthFailure,
  type SignInMethod,
} from './sign-in.utils';

/** Values collected by the sign-in form. */
interface SignInData {
  /** Email address or username used to identify the account. */
  emailOrUsername: string;
  /** Password supplied for password-based authentication. */
  password: string;
}

/** Error shape returned by Better Auth sign-in methods. */
type AuthError = {
  /** Optional user-facing message returned by the auth server. */
  message?: string | undefined;
  /** HTTP-like status code; `0` represents a network failure. */
  status: number;
};

/**
 * Reports only network and server-side authentication failures.
 *
 * @param method The authentication flow that produced the failure.
 * @param error The error returned by the auth client.
 */
function reportAuthFailure(method: SignInMethod | 'passkey', error: AuthError): void {
  if (!shouldReportAuthFailure(error.status)) {
    return;
  }
  Sentry.captureException(
    new Error(`Sign-in request failed: ${error.message ?? 'unknown error'}`),
    {
      tags: { 'auth.method': method },
      extra: { status: error.status },
    },
  );
}

@Component({
  selector: 'hiking-downward-hiking-downward-sign-in',
  imports: [NgOptimizedImage, RouterLink, FormField],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
})
/** Presents password, magic-link, and passkey authentication flows. */
export class SignIn {
  /** Better Auth client used to execute authentication requests. */
  readonly #authClient = inject(FrontendAuth).authClient;
  /** Router used to navigate after successful authentication. */
  readonly #router = inject(Router);
  /** Origin used to build the magic-link callback URL. */
  readonly #origin = inject(DOCUMENT).location.origin;

  // Validators stay inactive until a button is clicked, so errors only appear after an attempt.
  readonly #method = signal<SignInMethod | null>(null);

  readonly #signInModel = signal<SignInData>({
    emailOrUsername: '',
    password: '',
  });

  /** Signal Form tree containing method-specific authentication validators. */
  protected readonly signInForm = form(this.#signInModel, (path) => {
    required(path.emailOrUsername, {
      message: 'Enter your email address or username.',
      when: () => this.#method() !== null,
    });
    email(path.emailOrUsername, {
      message: 'Magic link sign-in requires an email address.',
      when: () => this.#method() === 'magicLink',
    });
    required(path.password, {
      message: 'Enter your password.',
      when: () => this.#method() === 'password',
    });
  });

  /** Whether an authentication request is currently in progress. */
  protected readonly pending = signal(false);
  /** User-facing authentication error, when the latest request failed. */
  protected readonly errorMessage = signal<string | null>(null);
  /** Email address to which the latest magic link was sent. */
  protected readonly magicLinkSentTo = signal<string | null>(null);

  public constructor() {
    afterNextRender({ read: async () => this.#startPasskeyAutofill() });
  }

  /**
   * Submits password authentication using either the email or username endpoint.
   *
   * @param event The native form-submit event to prevent from reloading the page.
   * @returns A promise that settles after validation and the auth request complete.
   */
  protected async signInWithPassword(event: Event): Promise<void> {
    event.preventDefault();
    await this.#run('password', async () => {
      const { emailOrUsername, password } = this.#signInModel();
      const identifier = normalizeIdentifier(emailOrUsername);
      const { data, error } =
        identifierMethod(identifier) === 'email'
          ? await this.#authClient.signIn.email({ email: identifier, password })
          : await this.#authClient.signIn.username({ username: identifier, password });

      if (error) {
        reportAuthFailure('password', error);
        this.errorMessage.set(error.message ?? 'Unable to sign in.');
        return;
      }
      // The two-factor client plugin handles its own redirect.
      if ('twoFactorRedirect' in data && data.twoFactorRedirect) {
        return;
      }
      await this.#router.navigateByUrl('/');
    });
  }

  /**
   * Sends a magic-link sign-in email for the entered address.
   *
   * @returns A promise that settles after validation and the email request complete.
   */
  protected async sendMagicLink(): Promise<void> {
    await this.#run('magicLink', async () => {
      const emailAddress = normalizeIdentifier(this.#signInModel().emailOrUsername);
      const { error } = await this.#authClient.signIn.magicLink({
        email: emailAddress,
        callbackURL: `${this.#origin}/`,
      });

      if (error) {
        reportAuthFailure('magicLink', error);
        this.errorMessage.set(error.message ?? 'Unable to send a magic link.');
        return;
      }
      this.magicLinkSentTo.set(emailAddress);
    });
  }

  /**
   * Starts an explicit passkey sign-in ceremony.
   *
   * @returns A promise that settles after the passkey ceremony and navigation complete.
   */
  protected async signInWithPasskey(): Promise<void> {
    this.#method.set(null);
    this.errorMessage.set(null);
    this.magicLinkSentTo.set(null);
    this.pending.set(true);
    try {
      const { error } = await this.#authClient.signIn.passkey();
      if (error) {
        reportAuthFailure('passkey', error);
        this.errorMessage.set(error.message ?? 'Unable to sign in with a passkey.');
        return;
      }
      await this.#router.navigateByUrl('/');
    } finally {
      this.pending.set(false);
    }
  }

  /**
   * Starts browser passkey autofill when Conditional UI is available.
   *
   * @returns A promise that settles after the optional autofill ceremony completes.
   */
  async #startPasskeyAutofill(): Promise<void> {
    if (
      !('PublicKeyCredential' in globalThis) ||
      typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function' ||
      !(await PublicKeyCredential.isConditionalMediationAvailable())
    ) {
      return;
    }

    // Errors are ignored: this ceremony is aborted whenever another passkey prompt starts.
    const { error } = await this.#authClient.signIn.passkey({ autoFill: true });
    if (!error) {
      await this.#router.navigateByUrl('/');
    }
  }

  /**
   * Runs an authenticated action after applying the method-specific form schema.
   *
   * @param method The flow whose validators should be active for this attempt.
   * @param action The validated authentication operation to execute.
   * @returns A promise that settles after validation and the action complete.
   */
  async #run(method: SignInMethod, action: () => Promise<void>): Promise<void> {
    this.#method.set(method);
    this.errorMessage.set(null);
    this.magicLinkSentTo.set(null);
    await submit(this.signInForm, {
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
}
