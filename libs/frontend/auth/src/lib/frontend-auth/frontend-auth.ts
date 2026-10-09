import { inject, InjectionToken, LOCALE_ID, Service } from '@angular/core';
import { Router } from '@angular/router';
import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/client';
import {
  adminClient,
  magicLinkClient,
  twoFactorClient,
  usernameClient,
} from 'better-auth/client/plugins';

/** Base URL used by the browser-side Better Auth client. */
export const AUTH_BASE_URL = new InjectionToken<string>('AUTH_BASE_URL', {
  factory: (): string => 'http://localhost:3000',
});

/** Session storage key holding the epoch milliseconds at which a pending two-factor sign-in expires. */
const TWO_FACTOR_PENDING_KEY = 'hiking-downward.two-factor-pending-until';
/** Session storage key holding a validated destination to open after sign-in. */
const POST_AUTH_REDIRECT_KEY = 'hiking-downward.post-auth-redirect';

/** Lifetime of a pending two-factor sign-in, matching Better Auth's default two-factor cookie. */
const TWO_FACTOR_PENDING_MS = 10 * 60 * 1000;

/** Local storage key holding the active verification-email callback flow. */
const EMAIL_VERIFICATION_FLOW_KEY = 'hiking-downward.email-verification-flow';

/** Lifetime of a verification-email callback flow. */
const EMAIL_VERIFICATION_FLOW_MS = 24 * 60 * 60 * 1000;

/** Local storage key holding the active magic-link sign-up completion flow. */
const SIGN_UP_COMPLETION_FLOW_KEY = 'hiking-downward.sign-up-completion-flow';

/** Locally recorded verification-email callback state. */
interface EmailVerificationFlow {
  /** Opaque value included in the callback URL. */
  id: string;
  /** Epoch milliseconds at which the callback flow expires. */
  expiresAt: number;
}

/** Provides the configured Better Auth client to frontend features. */
@Service()
export class FrontendAuth {
  readonly #localStorage = localStorage;
  readonly #router = inject(Router);
  readonly #sessionStorage = sessionStorage;
  readonly #localePrefix = inject(LOCALE_ID) === 'es' ? '/es' : '/en';

  /** Better Auth client configured with the application's enabled auth plugins. */
  public authClient = createAuthClient({
    baseURL: inject(AUTH_BASE_URL),
    fetchOptions: {
      onSuccess: (context) => {
        if (context.request.url.toString().includes('/two-factor/verify-')) {
          this.#sessionStorage.removeItem(TWO_FACTOR_PENDING_KEY);
        }
      },
    },
    plugins: [
      adminClient(),
      magicLinkClient(),
      twoFactorClient({
        onTwoFactorRedirect: async () => {
          this.#sessionStorage.setItem(
            TWO_FACTOR_PENDING_KEY,
            String(Date.now() + TWO_FACTOR_PENDING_MS),
          );
          await this.#router.navigateByUrl('/two-factor');
        },
      }),
      usernameClient({ displayUsername: true }),
      passkeyClient(),
    ],
  });

  /**
   * Returns whether a sign-in attempt in this tab is waiting for a second factor.
   *
   * @returns `true` while an unexpired two-factor challenge is pending.
   */
  public hasPendingTwoFactor(): boolean {
    return Number(this.#sessionStorage.getItem(TWO_FACTOR_PENDING_KEY)) > Date.now();
  }

  /**
   * Accepts only an application-local route as a post-authentication destination.
   *
   * @param url Candidate path from a return URL query parameter.
   * @returns A safe local URL, or `/` when the candidate is external or malformed.
   */
  public static safePostAuthRedirectUrl(url: string | null): string {
    if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) {
      return '/';
    }
    return url;
  }

  /** Adds the active locale prefix to an application route used outside Angular Router. */
  public localizedPath(path: string): string {
    const pathWithoutLocale = path.replace(/^\/(?:en|es)(?=\/|$)/u, '') || '/';
    return `${this.#localePrefix}${pathWithoutLocale}`;
  }

  /** Builds a locale-prefixed absolute URL for authentication callbacks. */
  public localizedUrl(origin: string, path: string): string {
    return `${origin}${this.localizedPath(path)}`;
  }

  /**
   * Stores a safe local destination so it survives a two-factor challenge.
   *
   * @param url Candidate destination from the sign-in return URL.
   * @returns Nothing; the session-storage value is replaced synchronously.
   */
  public rememberPostAuthRedirectUrl(url: string | null): void {
    const safeUrl = FrontendAuth.safePostAuthRedirectUrl(url);
    this.#sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, safeUrl);
  }

  /**
   * Returns and clears the post-authentication destination.
   *
   * @returns The previously stored safe path, or `/` when none was stored.
   */
  public consumePostAuthRedirectUrl(): string {
    const url = FrontendAuth.safePostAuthRedirectUrl(
      this.#sessionStorage.getItem(POST_AUTH_REDIRECT_KEY),
    );
    this.#sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
    return url;
  }

  /**
   * Creates a callback URL for an email-verification flow initiated in this tab.
   *
   * @param origin Application origin to receive the verification result.
   * @returns A callback URL carrying the registered flow identifier.
   * @throws Propagates local-storage or UUID-generation failures.
   */
  public emailVerificationCallbackUrl(origin: string): string {
    const flow: EmailVerificationFlow = {
      expiresAt: Date.now() + EMAIL_VERIFICATION_FLOW_MS,
      id: crypto.randomUUID(),
    };
    this.#localStorage.setItem(EMAIL_VERIFICATION_FLOW_KEY, JSON.stringify(flow));
    return `${this.localizedUrl(origin, '/verify-email/result')}?flow=${encodeURIComponent(flow.id)}`;
  }

  /**
   * Returns whether the supplied verification callback flow is current for this tab.
   *
   * @param flowId Flow identifier received in the verification callback URL.
   * @returns `true` when the flow is registered and has not expired.
   * @throws Propagates local-storage access failures.
   */
  public hasPendingEmailVerification(flowId: string | null): boolean {
    const storedFlow = this.#localStorage.getItem(EMAIL_VERIFICATION_FLOW_KEY);
    if (storedFlow === null) {
      return false;
    }
    try {
      const flow = JSON.parse(storedFlow) as EmailVerificationFlow;
      if (flow.expiresAt <= Date.now()) {
        this.#localStorage.removeItem(EMAIL_VERIFICATION_FLOW_KEY);
        return false;
      }
      return flow.id === flowId;
    } catch {
      this.#localStorage.removeItem(EMAIL_VERIFICATION_FLOW_KEY);
      return false;
    }
  }

  /**
   * Creates a callback URL for a magic-link account registration.
   *
   * @param origin Application origin to receive the sign-up completion page.
   * @returns A callback URL carrying the registered flow identifier.
   * @throws Propagates local-storage or UUID-generation failures.
   */
  public signUpCompletionCallbackUrl(origin: string): string {
    const flow: EmailVerificationFlow = {
      expiresAt: Date.now() + EMAIL_VERIFICATION_FLOW_MS,
      id: crypto.randomUUID(),
    };
    this.#localStorage.setItem(SIGN_UP_COMPLETION_FLOW_KEY, JSON.stringify(flow));
    return `${this.localizedUrl(origin, '/sign-up/complete')}?flow=${encodeURIComponent(flow.id)}`;
  }

  /**
   * Returns whether the supplied magic-link sign-up callback flow is current.
   *
   * @param flowId Flow identifier received in the magic-link callback URL.
   * @returns `true` when the flow is registered and has not expired.
   * @throws Propagates local-storage access failures.
   */
  public hasPendingSignUpCompletion(flowId: string | null): boolean {
    const storedFlow = this.#localStorage.getItem(SIGN_UP_COMPLETION_FLOW_KEY);
    if (storedFlow === null) {
      return false;
    }
    try {
      const flow = JSON.parse(storedFlow) as EmailVerificationFlow;
      if (flow.expiresAt <= Date.now()) {
        this.#localStorage.removeItem(SIGN_UP_COMPLETION_FLOW_KEY);
        return false;
      }
      return flow.id === flowId;
    } catch {
      this.#localStorage.removeItem(SIGN_UP_COMPLETION_FLOW_KEY);
      return false;
    }
  }
}
