/// <reference types="@angular/localize" />

import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { afterNextRender, Component, inject, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
 * @returns Nothing; eligible failures are sent to Sentry.
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

/** Presents password, magic-link, and passkey authentication flows. */
@Component({
  selector: 'hiking-downward-hiking-downward-sign-in',
  imports: [NgOptimizedImage, RouterLink, FormField],
  templateUrl: './sign-in.ng.html',
  styleUrl: './sign-in.css',
})
/* v8 ignore start */
export class SignIn {
  /* v8 ignore stop */
  /** Shared Better Auth client and safe return-destination helpers. */
  readonly #auth = inject(FrontendAuth);
  /** Better Auth client used to execute authentication requests. */
  readonly #authClient = this.#auth.authClient;
  /** Router used to navigate after successful authentication. */
  readonly #router = inject(Router);
  /** Requested local destination preserved by the authenticated route guard. */
  readonly #returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  /** Origin used to build the magic-link callback URL. */
  readonly #origin = inject(DOCUMENT).location.origin;

  // Validators stay inactive until a button is clicked, so errors only appear after an attempt.
  readonly #method = signal<SignInMethod | null>(null);

  readonly #signInModel = signal<SignInData>({
    emailOrUsername: '',
    password: '',
  });

  /** Signal Form tree containing method-specific authentication validators. */
  private readonly signInForm = form(this.#signInModel, (path) => {
    required(path.emailOrUsername, {
      message: $localize`Enter your email address or username.`,
      when: () => this.#method() !== null,
    });
    email(path.emailOrUsername, {
      message: $localize`Magic link sign-in requires an email address.`,
      when: () => this.#method() === 'magicLink',
    });
    required(path.password, {
      message: $localize`Enter your password.`,
      when: () => this.#method() === 'password',
    });
  });

  /** Whether an authentication request is currently in progress. */
  private readonly pending = signal(false);
  /** User-facing authentication error, when the latest request failed. */
  private readonly errorMessage = signal<string | null>(null);
  /** Email address to which the latest magic link was sent. */
  private readonly magicLinkSentTo = signal<string | null>(null);

  /** Starts optional conditional passkey autofill after the view renders. */
  public constructor() {
    afterNextRender({ read: async () => this.#startPasskeyAutofill() });
  }

  /**
   * Submits password authentication using either the email or username endpoint.
   *
   * @param event The native form-submit event to prevent from reloading the page.
   * @returns A promise that settles after validation and the auth request complete.
   * @throws Propagates unexpected form submission or auth client failures.
   */
  private async signInWithPassword(event: Event): Promise<void> {
    event.preventDefault();
    this.#auth.rememberPostAuthRedirectUrl(this.#returnUrl);
    await this.#run('password', async () => {
      const { emailOrUsername, password } = this.#signInModel();
      const identifier = normalizeIdentifier(emailOrUsername);
      const { data, error } =
        identifierMethod(identifier) === 'email'
          ? await this.#authClient.signIn.email({ email: identifier, password })
          : await this.#authClient.signIn.username({ username: identifier, password });

      if (error) {
        reportAuthFailure('password', error);
        this.errorMessage.set(error.message ?? $localize`Unable to sign in.`);
        return;
      }
      // The two-factor client plugin handles its own redirect.
      if ('twoFactorRedirect' in data && data.twoFactorRedirect) {
        return;
      }
      await this.#router.navigateByUrl(this.#auth.consumePostAuthRedirectUrl());
    });
  }

  /**
   * Sends a magic-link sign-in email for the entered address.
   *
   * @returns A promise that settles after validation and the email request complete.
   * @throws Propagates unexpected form submission or auth client failures.
   */
  private async sendMagicLink(): Promise<void> {
    await this.#run('magicLink', async () => {
      const emailAddress = normalizeIdentifier(this.#signInModel().emailOrUsername);
      const { error } = await this.#authClient.signIn.magicLink({
        email: emailAddress,
        callbackURL: this.#auth.localizedUrl(
          this.#origin,
          FrontendAuth.safePostAuthRedirectUrl(this.#returnUrl),
        ),
      });

      if (error) {
        reportAuthFailure('magicLink', error);
        this.errorMessage.set(error.message ?? $localize`Unable to send a magic link.`);
        return;
      }
      this.magicLinkSentTo.set(emailAddress);
    });
  }

  /**
   * Starts an explicit passkey sign-in ceremony.
   *
   * @returns A promise that settles after the passkey ceremony and navigation complete.
   * @throws Propagates passkey client or navigation failures.
   */
  private async signInWithPasskey(): Promise<void> {
    this.#method.set(null);
    this.errorMessage.set(null);
    this.magicLinkSentTo.set(null);
    this.#auth.rememberPostAuthRedirectUrl(this.#returnUrl);
    this.pending.set(true);
    try {
      const { error } = await this.#authClient.signIn.passkey();
      if (error) {
        reportAuthFailure('passkey', error);
        this.errorMessage.set(error.message ?? $localize`Unable to sign in with a passkey.`);
        return;
      }
      await this.#router.navigateByUrl(this.#auth.consumePostAuthRedirectUrl());
    } finally {
      this.pending.set(false);
    }
  }

  /**
   * Starts browser passkey autofill when Conditional UI is available.
   *
   * @returns A promise that settles after the optional autofill ceremony completes.
   * @throws Propagates conditional UI or navigation failures.
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
    const { data, error } = await this.#authClient.signIn.passkey({ autoFill: true });
    if (!error && data) {
      this.#auth.rememberPostAuthRedirectUrl(this.#returnUrl);
      await this.#router.navigateByUrl(this.#auth.consumePostAuthRedirectUrl());
    }
  }

  /**
   * Runs an authenticated action after applying the method-specific form schema.
   *
   * @param method The flow whose validators should be active for this attempt.
   * @param action The validated authentication operation to execute.
   * @returns A promise that settles after validation and the action complete.
   * @throws Propagates unexpected Signal Forms submission failures.
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
