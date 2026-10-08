/** Email address submitted to Better Auth for a verified email change. */
export interface EmailChangeData {
  /** Address that will receive the change-confirmation flow. */
  newEmail: string;
}

/** Password values collected by the password-change form. */
export interface PasswordChangeData {
  /** Current password authorizing the change. */
  currentPassword: string;
  /** New account password. */
  newPassword: string;
  /** Repeated password used to confirm the new value. */
  confirmation: string;
}

/** Credentials and one-time code used for authenticator management. */
export interface AuthenticatorData {
  /** Optional password required by the auth policy. */
  password: string;
  /** Six-digit code used to verify enrollment. */
  code: string;
}

/** Public passkey information rendered in the account settings list. */
export interface PasskeySummary {
  /** Opaque ID used for rename and removal. */
  id: string;
  /** User-assigned label. */
  name: string;
  /** Creation time from Better Auth. */
  createdAt: Date | string;
}

/** Session metadata rendered without exposing its authentication token. */
export interface SessionSummary {
  /** Opaque session ID. */
  id: string;
  /** Secret token used only for revocation requests. */
  token: string;
  /** Creation time from Better Auth. */
  createdAt: Date | string;
  /** Expiry time from Better Auth. */
  expiresAt: Date | string;
  /** Optional client IP address. */
  ipAddress?: string | null;
  /** Optional client user-agent. */
  userAgent?: string | null;
  /** Whether this is the current browser session. */
  isCurrent: boolean;
}
