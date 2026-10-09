/// <reference types="@angular/localize" />

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
/* v8 ignore start */
export class SecuritySettings {
  /* v8 ignore stop */
  readonly #auth = inject(FrontendAuth);
  readonly #authClient = this.#auth.authClient;
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

  private readonly emailForm = form(this.#emailModel, (path) => {
    required(path.newEmail, { message: $localize`Enter your new email address.` });
    email(path.newEmail, { message: $localize`Enter a valid email address.` });
  });

  private readonly passwordForm = form(this.#passwordModel, (path) => {
    required(path.currentPassword, { message: $localize`Enter your current password.` });
    required(path.newPassword, { message: $localize`Enter a new password.` });
    minLength(path.newPassword, 8, { message: $localize`Password must be at least 8 characters.` });
    maxLength(path.newPassword, 128, {
      message: $localize`Password must be no more than 128 characters.`,
    });
    required(path.confirmation, { message: $localize`Confirm your new password.` });
    validate(path.confirmation, (context) => {
      if (context.value() !== context.valueOf(path.newPassword)) {
        return { kind: 'passwordMismatch', message: $localize`Passwords must match.` };
      }
      return;
    });
  });

  private readonly authenticatorForm = form(this.#authenticatorModel, (path) => {
    validate(path.code, (context) => {
      if (this.setupUri() && !/^[0-9]{6}$/u.test(context.value().trim())) {
        return {
          kind: 'totpCode',
          message: $localize`Enter the 6-digit code from your authenticator app.`,
        };
      }
      return;
    });
  });

  private readonly loading = signal(true);
  private readonly pendingAction = signal('');
  private readonly emailAddress = signal('');
  private readonly emailVerified = signal(false);
  private readonly emailChangePending = signal(false);
  private readonly twoFactorEnabled = signal(false);
  private readonly setupUri = signal('');
  private readonly qrCodeUrl = signal('');
  private readonly backupCodes = signal<string[]>([]);
  private readonly backupCodesNotice = signal('');
  private readonly passkeys = signal<PasskeySummary[]>([]);
  private readonly sessions = signal<SessionSummary[]>([]);
  private readonly passkeyName = signal('');
  private readonly passkeyPendingRemoval = signal('');
  private readonly passkeySupported =
    typeof PublicKeyCredential !== 'undefined' && globalThis.isSecureContext;
  private readonly statusMessage = signal('');
  private readonly errorMessage = signal('');
  private readonly sessionError = signal('');

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
      this.errorMessage.set(
        $localize`Unable to load security settings. Refresh the page to try again.`,
      );
      this.loading.set(false);
    });
  }

  /** Requests an email change and reports where its confirmation was sent. */
  private async requestEmailChange(event: Event): Promise<void> {
    event.preventDefault();
    this.#clearMessages();
    await submit(this.emailForm, {
      action: async () => {
        await this.#runAction('email', async () => {
          const { error } = await this.#authClient.changeEmail({
            newEmail: this.#emailModel().newEmail.trim(),
            callbackURL: this.#auth.localizedUrl(this.#origin, '/settings/security'),
          });
          if (error) {
            this.errorMessage.set(
              authErrorMessage(error, $localize`Unable to request an email change.`),
            );
            return;
          }
          this.emailChangePending.set(true);
          this.statusMessage.set(
            $localize`Confirmation instructions were sent to ${this.emailAddress()}:emailAddress:. Follow them to finish changing your email.`,
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
  private async changePassword(event: Event): Promise<void> {
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
            this.errorMessage.set(
              authErrorMessage(error, $localize`Unable to change your password.`),
            );
            return;
          }
          this.#passwordModel.set({ currentPassword: '', newPassword: '', confirmation: '' });
          this.statusMessage.set($localize`Password changed. Other sessions were signed out.`);
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
  private async requestPasswordSetup(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('password-reset', async () => {
      const { error } = await this.#authClient.requestPasswordReset({
        email: this.emailAddress(),
        redirectTo: this.#auth.localizedUrl(this.#origin, '/reset-password'),
      });
      if (error) {
        this.errorMessage.set(
          authErrorMessage(error, $localize`Unable to send a password setup link.`),
        );
        return;
      }
      this.statusMessage.set(
        $localize`A password setup link was sent to ${this.emailAddress()}:emailAddress:.`,
      );
    });
  }

  /**
   * Starts authenticator enrollment and prepares its QR code and backup codes.
   *
   * @param event Form-submit event to prevent from navigating.
   * @returns Promise settling after setup data and QR generation.
   */
  private async startAuthenticatorSetup(event: Event): Promise<void> {
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
            this.errorMessage.set(message ?? $localize`Unable to start authenticator setup.`);
            return;
          }
          this.setupUri.set(data.totpURI);
          this.#pendingBackupCodes = data.backupCodes;
          try {
            const { qrcodeDataURI } = await import('etiket/qr');
            this.qrCodeUrl.set(qrcodeDataURI(data.totpURI, { margin: 1, size: 220 }));
          } catch {
            this.errorMessage.set(
              $localize`Unable to create the setup QR code. Use the setup key instead.`,
            );
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
  private async verifyAuthenticatorSetup(event: Event): Promise<void> {
    event.preventDefault();
    this.#clearMessages();
    await submit(this.authenticatorForm, {
      action: async () => {
        await this.#runAction('two-factor', async () => {
          const { code } = this.#authenticatorModel();
          const { error } = await this.#authClient.twoFactor.verifyTotp({ code: code.trim() });
          if (error) {
            this.errorMessage.set(
              authErrorMessage(error, $localize`Unable to verify this authenticator code.`),
            );
            return;
          }
          this.twoFactorEnabled.set(true);
          this.backupCodes.set(this.#pendingBackupCodes);
          this.#pendingBackupCodes = [];
          this.setupUri.set('');
          this.qrCodeUrl.set('');
          this.#authenticatorModel.update((current) => ({ ...current, password: '', code: '' }));
          this.statusMessage.set(
            $localize`Two-factor authentication is enabled. Save your backup codes.`,
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

  /** Disables two-factor authentication and clears recovery codes; resolves after the request. */
  private async disableTwoFactor(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('two-factor', async () => {
      const password = this.#authenticatorModel().password.trim();
      const { error } = await this.#authClient.twoFactor.disable(password ? { password } : {});
      if (error) {
        this.errorMessage.set(
          authErrorMessage(error, $localize`Unable to disable two-factor authentication.`),
        );
        return;
      }
      this.twoFactorEnabled.set(false);
      this.backupCodes.set([]);
      this.#pendingBackupCodes = [];
      this.backupCodesNotice.set('');
      this.statusMessage.set($localize`Two-factor authentication is disabled.`);
    });
  }

  /** Replaces the backup codes; resolves after the replacement set is loaded. */
  private async regenerateBackupCodes(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('backup-codes', async () => {
      const password = this.#authenticatorModel().password.trim();
      const { data, error } = await this.#authClient.twoFactor.generateBackupCodes(
        password ? { password } : {},
      );
      if (error || !data || !('backupCodes' in data) || !data.backupCodes) {
        const message = error ? error.message : null;
        this.errorMessage.set(message ?? $localize`Unable to generate backup codes.`);
        return;
      }
      this.backupCodes.set(data.backupCodes);
      this.backupCodesNotice.set(
        $localize`These new codes replace all previously issued backup codes.`,
      );
      this.statusMessage.set($localize`New backup codes generated. Save them now.`);
    });
  }

  /** Registers a passkey; resolves after registration and list refresh. */
  private async addPasskey(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('passkey', async () => {
      const name = this.passkeyName().trim();
      const { error } = await this.#authClient.passkey.addPasskey(name ? { name } : {});
      if (error) {
        this.errorMessage.set(authErrorMessage(error, $localize`Unable to add this passkey.`));
        return;
      }
      this.passkeyName.set('');
      this.statusMessage.set($localize`Passkey added.`);
      await this.#passkeyQuery.get().refetch();
    });
  }

  /** Updates the pending passkey label from its input event. @param event Bound input event. */
  private updatePasskeyName(event: Event): void {
    this.passkeyName.set((event.target as HTMLInputElement).value);
  }

  /** Marks a passkey for removal confirmation. @param id Passkey identifier. */
  private askRemovePasskey(id: string): void {
    this.passkeyPendingRemoval.set(id);
  }

  /** Cancels pending passkey removal confirmation. */
  private cancelRemovePasskey(): void {
    this.passkeyPendingRemoval.set('');
  }

  /** Renames a passkey and refreshes the list. @param id Passkey ID. @param name New label. */
  private async renamePasskey(id: string, name: string): Promise<void> {
    this.#clearMessages();
    await this.#runAction('passkey', async () => {
      const { error } = await this.#authClient.$fetch('/passkey/update-passkey', {
        method: 'POST',
        body: { id, name: name.trim() },
      });
      if (error) {
        this.errorMessage.set(authErrorMessage(error, $localize`Unable to rename this passkey.`));
        return;
      }
      this.statusMessage.set($localize`Passkey renamed.`);
      await this.#passkeyQuery.get().refetch();
    });
  }

  /** Removes a passkey and refreshes the list. @param id Passkey identifier. */
  private async removePasskey(id: string): Promise<void> {
    this.#clearMessages();
    await this.#runAction('passkey', async () => {
      const { error } = await this.#authClient.$fetch('/passkey/delete-passkey', {
        method: 'POST',
        body: { id },
      });
      if (error) {
        this.errorMessage.set(authErrorMessage(error, $localize`Unable to remove this passkey.`));
        return;
      }
      this.statusMessage.set($localize`Passkey removed.`);
      this.passkeyPendingRemoval.set('');
      await this.#passkeyQuery.get().refetch();
    });
  }

  /** Revokes a session and signs out the current browser when selected. @param session Target. */
  private async revokeSession(session: SessionSummary): Promise<void> {
    this.#clearMessages();
    await this.#runAction('sessions', async () => {
      const { error } = await this.#authClient.revokeSession({ token: session.token });
      if (error) {
        this.sessionError.set(authErrorMessage(error, $localize`Unable to sign out this session.`));
        return;
      }
      if (session.isCurrent) {
        await this.#router.navigateByUrl('/sign-in');
        return;
      }
      this.statusMessage.set($localize`Session signed out.`);
      await this.#loadSessions();
    });
  }

  /** Revokes all other sessions and refreshes the session list. */
  private async revokeOtherSessions(): Promise<void> {
    this.#clearMessages();
    await this.#runAction('sessions', async () => {
      const { error } = await this.#authClient.revokeOtherSessions();
      if (error) {
        this.sessionError.set(
          authErrorMessage(error, $localize`Unable to sign out other sessions.`),
        );
        return;
      }
      this.statusMessage.set($localize`Other sessions were signed out.`);
      await this.#loadSessions();
    });
  }

  /** @returns Setup secret or `null` when absent; throws `TypeError` for an invalid URI. */
  private manualTotpKey(): string | null {
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
        this.errorMessage.set(
          $localize`Unable to load security settings. Refresh the page to try again.`,
        );
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
        this.sessionError.set(authErrorMessage(error, $localize`Unable to load active sessions.`));
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
      this.sessionError.set($localize`Unable to load active sessions.`);
    }
  }

  /** Runs an auth operation with pending state and fallback errors. */
  async #runAction(action: string, operation: () => Promise<void>): Promise<void> {
    this.pendingAction.set(action);
    try {
      await operation();
    } catch {
      this.errorMessage.set(
        $localize`The request could not be completed. Check your connection and try again.`,
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
