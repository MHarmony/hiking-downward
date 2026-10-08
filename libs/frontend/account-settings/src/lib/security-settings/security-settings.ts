import { DatePipe, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
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
import { Router } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import { authErrorMessage } from '../account-settings.utils';
import type {
  AuthenticatorData,
  EmailChangeData,
  PasskeySummary,
  PasswordChangeData,
  SessionSummary,
} from './security-settings.types';

/** Manages the signed-in user's email, credentials, factors, passkeys, and sessions. */
@Component({
  imports: [DatePipe, FormField],
  templateUrl: './security-settings.ng.html',
})
export class SecuritySettings {
  readonly #authClient = inject(FrontendAuth).authClient;
  readonly #origin = inject(DOCUMENT).location.origin;
  readonly #router = inject(Router);
  readonly #passkeyQuery = this.#authClient.useListPasskeys;

  readonly #emailModel = signal<EmailChangeData>({ newEmail: '' });
  readonly #passwordModel = signal<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmation: '',
  });
  readonly #authenticatorModel = signal<AuthenticatorData>({ password: '', code: '' });

  protected readonly emailForm = form(this.#emailModel, (path) => {
    required(path.newEmail, { message: 'Enter your new email address.' });
    email(path.newEmail, { message: 'Enter a valid email address.' });
  });

  protected readonly passwordForm = form(this.#passwordModel, (path) => {
    required(path.currentPassword, { message: 'Enter your current password.' });
    required(path.newPassword, { message: 'Enter a new password.' });
    minLength(path.newPassword, 8, { message: 'Password must be at least 8 characters.' });
    maxLength(path.newPassword, 128, { message: 'Password must be no more than 128 characters.' });
    required(path.confirmation, { message: 'Confirm your new password.' });
    validate(path.confirmation, (context) => {
      if (context.value() !== context.valueOf(path.newPassword)) {
        return { kind: 'passwordMismatch', message: 'Passwords must match.' };
      }
      return;
    });
  });

  protected readonly authenticatorForm = form(this.#authenticatorModel, (path) => {
    validate(path.code, (context) => {
      if (this.setupUri() && !/^[0-9]{6}$/u.test(context.value().trim())) {
        return { kind: 'totpCode', message: 'Enter the 6-digit code from your authenticator app.' };
      }
      return;
    });
  });

  protected readonly loading = signal(true);
  protected readonly pendingAction = signal('');
  protected readonly emailAddress = signal('');
  protected readonly emailVerified = signal(false);
  protected readonly emailChangePending = signal(false);
  protected readonly twoFactorEnabled = signal(false);
  protected readonly setupUri = signal('');
  protected readonly qrCodeUrl = signal('');
  protected readonly backupCodes = signal<string[]>([]);
  protected readonly backupCodesNotice = signal('');
  protected readonly passkeys = signal<PasskeySummary[]>([]);
  protected readonly sessions = signal<SessionSummary[]>([]);
  protected readonly passkeyName = signal('');
  protected readonly passkeyPendingRemoval = signal('');
  protected readonly passkeySupported =
    typeof PublicKeyCredential !== 'undefined' && globalThis.isSecureContext;
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly sessionError = signal('');

  #currentSessionToken = '';
  #pendingBackupCodes: string[] = [];

  /** Subscribes to passkey state and loads the current security settings. */
  public constructor() {
    const destroyRef = inject(DestroyRef);
    const unsubscribe = this.#passkeyQuery.subscribe((state) => {
      this.passkeys.set((state.data ?? []) as PasskeySummary[]);
    });
    destroyRef.onDestroy(unsubscribe);
    this.#loadSecurityState().catch(() => {
      this.errorMessage.set('Unable to load security settings. Refresh the page to try again.');
      this.loading.set(false);
    });
  }

  /**
   * Requests an email change and reports where its confirmation was sent.
   *
   * @param event Form-submit event to prevent from navigating.
   * @returns Promise settling after validation and the change request.
   */
  protected async requestEmailChange(event: Event): Promise<void> {
    event.preventDefault();
    this.#clearMessages();
    await submit(this.emailForm, {
      action: async () => {
        await this.#runAction('email', async () => {
          const { error } = await this.#authClient.changeEmail({
            newEmail: this.#emailModel().newEmail.trim(),
            callbackURL: `${this.#origin}/settings/security`,
          });
          if (error) {
            this.errorMessage.set(authErrorMessage(error, 'Unable to request an email change.'));
            return;
          }
          this.emailChangePending.set(true);
          this.statusMessage.set(
            `Confirmation instructions were sent to ${this.emailAddress()}. Follow them to finish changing your email.`,
          );
        });
      },
      onInvalid: (field) => {
        for (const error of field().errorSummary().slice(0, 1)) {
          error.fieldTree().focusBoundControl();
        }
      },
    });
  }

  /**
   * Changes the password and refreshes active sessions.
   *
   * @param event Form-submit event to prevent from navigating.
   * @returns Promise settling after validation and the password change.
   */
  protected async changePassword(event: Event): Promise<void> {
    event.preventDefault();
    this.#clearMessages();
    await submit(this.passwordForm, {
      action: async () => {
        await this.#runAction('password', async () => {
          const { currentPassword, newPassword } = this.#passwordModel();
          const { error } = await this.#authClient.changePassword({
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
          });
          if (error) {
            this.errorMessage.set(authErrorMessage(error, 'Unable to change your password.'));
            return;
          }
          this.#passwordModel.set({ currentPassword: '', newPassword: '', confirmation: '' });
          this.statusMessage.set('Password changed. Other sessions were signed out.');
          await this.#loadSessions();
        });
      },
      onInvalid: (field) => {
        for (const error of field().errorSummary().slice(0, 1)) {
          error.fieldTree().focusBoundControl();
        }
      },
    });
  }

  /** Emails a password setup link; resolves when the request completes. */
  protected async requestPasswordSetup(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('password-reset', async () => {
      const { error } = await this.#authClient.requestPasswordReset({
        email: this.emailAddress(),
        redirectTo: `${this.#origin}/reset-password`,
      });
      if (error) {
        this.errorMessage.set(authErrorMessage(error, 'Unable to send a password setup link.'));
        return;
      }
      this.statusMessage.set(`A password setup link was sent to ${this.emailAddress()}.`);
    });
  }

  /**
   * Starts authenticator enrollment and prepares its QR code and backup codes.
   *
   * @param event Form-submit event to prevent from navigating.
   * @returns Promise settling after setup data and QR generation.
   */
  protected async startAuthenticatorSetup(event: Event): Promise<void> {
    event.preventDefault();
    this.#clearMessages();
    await submit(this.authenticatorForm, {
      action: async () => {
        await this.#runAction('two-factor', async () => {
          const password = this.#authenticatorModel().password.trim();
          const { data, error } = await this.#authClient.twoFactor.enable(
            password ? { password } : {},
          );
          if (error || !data || !('totpURI' in data)) {
            const message = error ? error.message : null;
            this.errorMessage.set(message ?? 'Unable to start authenticator setup.');
            return;
          }
          this.setupUri.set(data.totpURI);
          this.#pendingBackupCodes = data.backupCodes;
          try {
            const { default: QRCode } = await import('qrcode');
            this.qrCodeUrl.set(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }));
          } catch {
            this.errorMessage.set('Unable to create the setup QR code. Use the setup key instead.');
          }
        });
      },
    });
  }

  /**
   * Verifies authenticator enrollment before revealing backup codes.
   *
   * @param event Form-submit event to prevent from navigating.
   * @returns Promise settling after validation and verification.
   */
  protected async verifyAuthenticatorSetup(event: Event): Promise<void> {
    event.preventDefault();
    this.#clearMessages();
    await submit(this.authenticatorForm, {
      action: async () => {
        await this.#runAction('two-factor', async () => {
          const { code } = this.#authenticatorModel();
          const { error } = await this.#authClient.twoFactor.verifyTotp({ code: code.trim() });
          if (error) {
            this.errorMessage.set(
              authErrorMessage(error, 'Unable to verify this authenticator code.'),
            );
            return;
          }
          this.twoFactorEnabled.set(true);
          this.backupCodes.set(this.#pendingBackupCodes);
          this.#pendingBackupCodes = [];
          this.setupUri.set('');
          this.qrCodeUrl.set('');
          this.#authenticatorModel.update((current) => ({ ...current, password: '', code: '' }));
          this.statusMessage.set('Two-factor authentication is enabled. Save your backup codes.');
        });
      },
      onInvalid: (field) => {
        for (const error of field().errorSummary().slice(0, 1)) {
          error.fieldTree().focusBoundControl();
        }
      },
    });
  }

  /** Disables two-factor authentication and clears recovery codes; resolves after the request. */
  protected async disableTwoFactor(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('two-factor', async () => {
      const password = this.#authenticatorModel().password.trim();
      const { error } = await this.#authClient.twoFactor.disable(password ? { password } : {});
      if (error) {
        this.errorMessage.set(
          authErrorMessage(error, 'Unable to disable two-factor authentication.'),
        );
        return;
      }
      this.twoFactorEnabled.set(false);
      this.backupCodes.set([]);
      this.#pendingBackupCodes = [];
      this.backupCodesNotice.set('');
      this.statusMessage.set('Two-factor authentication is disabled.');
    });
  }

  /** Replaces the backup codes; resolves after the replacement set is loaded. */
  protected async regenerateBackupCodes(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('backup-codes', async () => {
      const password = this.#authenticatorModel().password.trim();
      const { data, error } = await this.#authClient.twoFactor.generateBackupCodes(
        password ? { password } : {},
      );
      if (error || !data || !('backupCodes' in data) || !data.backupCodes) {
        const message = error ? error.message : null;
        this.errorMessage.set(message ?? 'Unable to generate backup codes.');
        return;
      }
      this.backupCodes.set(data.backupCodes);
      this.backupCodesNotice.set('These new codes replace all previously issued backup codes.');
      this.statusMessage.set('New backup codes generated. Save them now.');
    });
  }

  /** Registers a passkey; resolves after registration and list refresh. */
  protected async addPasskey(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('passkey', async () => {
      const name = this.passkeyName().trim();
      const { error } = await this.#authClient.passkey.addPasskey(name ? { name } : {});
      if (error) {
        this.errorMessage.set(authErrorMessage(error, 'Unable to add this passkey.'));
        return;
      }
      this.passkeyName.set('');
      this.statusMessage.set('Passkey added.');
      await this.#passkeyQuery.get().refetch();
    });
  }

  /** Updates the pending passkey label from its input event. @param event Bound input event. */
  protected updatePasskeyName(event: Event): void {
    this.passkeyName.set((event.target as HTMLInputElement).value);
  }

  /** Marks a passkey for removal confirmation. @param id Passkey identifier. */
  protected askRemovePasskey(id: string): void {
    this.passkeyPendingRemoval.set(id);
  }

  /** Cancels pending passkey removal confirmation. */
  protected cancelRemovePasskey(): void {
    this.passkeyPendingRemoval.set('');
  }

  /** Renames a passkey and refreshes the list. @param id Passkey ID. @param name New label. */
  protected async renamePasskey(id: string, name: string): Promise<void> {
    this.#clearMessages();
    await this.#runAction('passkey', async () => {
      const { error } = await this.#authClient.$fetch('/passkey/update-passkey', {
        method: 'POST',
        body: { id, name: name.trim() },
      });
      if (error) {
        this.errorMessage.set(authErrorMessage(error, 'Unable to rename this passkey.'));
        return;
      }
      this.statusMessage.set('Passkey renamed.');
      await this.#passkeyQuery.get().refetch();
    });
  }

  /** Removes a passkey and refreshes the list. @param id Passkey identifier. */
  protected async removePasskey(id: string): Promise<void> {
    this.#clearMessages();
    await this.#runAction('passkey', async () => {
      const { error } = await this.#authClient.$fetch('/passkey/delete-passkey', {
        method: 'POST',
        body: { id },
      });
      if (error) {
        this.errorMessage.set(authErrorMessage(error, 'Unable to remove this passkey.'));
        return;
      }
      this.statusMessage.set('Passkey removed.');
      this.passkeyPendingRemoval.set('');
      await this.#passkeyQuery.get().refetch();
    });
  }

  /** Revokes a session and signs out the current browser when selected. @param session Target. */
  protected async revokeSession(session: SessionSummary): Promise<void> {
    this.#clearMessages();
    await this.#runAction('sessions', async () => {
      const { error } = await this.#authClient.revokeSession({ token: session.token });
      if (error) {
        this.sessionError.set(authErrorMessage(error, 'Unable to sign out this session.'));
        return;
      }
      if (session.isCurrent) {
        await this.#router.navigateByUrl('/sign-in');
        return;
      }
      this.statusMessage.set('Session signed out.');
      await this.#loadSessions();
    });
  }

  /** Revokes all other sessions and refreshes the session list. */
  protected async revokeOtherSessions(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('sessions', async () => {
      const { error } = await this.#authClient.revokeOtherSessions();
      if (error) {
        this.sessionError.set(authErrorMessage(error, 'Unable to sign out other sessions.'));
        return;
      }
      this.statusMessage.set('Other sessions were signed out.');
      await this.#loadSessions();
    });
  }

  /** @returns Setup secret or `null` when absent; throws `TypeError` for an invalid URI. */
  protected manualTotpKey(): string | null {
    const uri = this.setupUri();
    if (!uri) {
      return null;
    }
    return new URL(uri).searchParams.get('secret');
  }

  /** Loads session, factor status, sessions, and passkeys; unexpected request failures propagate. */
  async #loadSecurityState(): Promise<void> {
    try {
      const { data, error } = await this.#authClient.getSession();
      if (error || !data) {
        this.errorMessage.set('Unable to load security settings. Refresh the page to try again.');
        return;
      }
      const user = data.user as {
        email: string;
        emailVerified: boolean;
        twoFactorEnabled?: boolean;
      };
      this.emailAddress.set(user.email);
      this.emailVerified.set(user.emailVerified);
      this.twoFactorEnabled.set(Boolean(user.twoFactorEnabled));
      this.#currentSessionToken = data.session.token;
      await Promise.all([this.#loadSessions(), this.#passkeyQuery.get().refetch()]);
    } finally {
      this.loading.set(false);
    }
  }

  /** Loads active sessions and marks the current one; request failures become UI errors. */
  async #loadSessions(): Promise<void> {
    this.sessionError.set('');
    try {
      const { data, error } = await this.#authClient.listSessions();
      if (error) {
        this.sessionError.set(authErrorMessage(error, 'Unable to load active sessions.'));
        return;
      }
      this.sessions.set(
        (data ?? []).map((session) => ({
          id: session.id,
          token: session.token,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          isCurrent: session.token === this.#currentSessionToken,
        })),
      );
    } catch {
      this.sessionError.set('Unable to load active sessions.');
    }
  }

  /** Runs an auth operation with pending state and fallback errors. */
  async #runAction(action: string, operation: () => Promise<void>): Promise<void> {
    this.pendingAction.set(action);
    try {
      await operation();
    } catch {
      this.errorMessage.set(
        'The request could not be completed. Check your connection and try again.',
      );
    } finally {
      this.pendingAction.set('');
    }
  }

  /** Clears status and error announcements before a new action; returns nothing. */
  #clearMessages(): void {
    this.statusMessage.set('');
    this.errorMessage.set('');
  }
}
