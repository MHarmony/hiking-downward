import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { i18n, locales } from '@better-auth/i18n';
import { passkey } from '@better-auth/passkey';
import {
  account,
  db,
  passkey as passkeySchema,
  twoFactor as twoFactorSchema,
  user,
} from '@hiking-downward/database';
import { Redis } from '@upstash/redis';
import type { SecondaryStorage } from 'better-auth';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { admin, haveIBeenPwned, magicLink, twoFactor, username } from 'better-auth/plugins';
import type { User } from 'better-auth/types';
import { getAuditRequestContext, recordAuditEvent } from './audit';
import { appUrl, sendTransactionalEmail } from './email';

const missingActor = null as never;

const redis = Redis.fromEnv();

/**
 * Checks that Upstash Redis accepts a ping request.
 *
 * @returns A promise that resolves when Redis responds successfully.
 * @throws The Redis client error when the ping fails.
 */
export async function checkRedis(): Promise<void> {
  await redis.ping();
}

/**
 * Closes the Redis lifecycle safely.
 *
 * Upstash Redis uses HTTP and has no persistent client resource to close.
 *
 * @returns A promise that resolves immediately.
 */
export async function closeRedis(): Promise<void> {
  await Promise.resolve();
}

/** Implements Better Auth secondary storage with Upstash Redis. */
const redisSecondaryStorage: SecondaryStorage = {
  /**
   * Retrieves a stored value by key.
   *
   * @param key Storage key.
   * @returns The stored value, or `null` when the key does not exist.
   */
  async get(key) {
    return redis.get(key);
  },
  /**
   * Retrieves and removes a stored value by key.
   *
   * @param key Storage key.
   * @returns The removed value, or `null` when the key does not exist.
   */
  async getAndDelete(key) {
    return redis.getdel(key);
  },
  /**
   * Increments a counter and sets its expiry when it has no expiry.
   *
   * @param key Counter key.
   * @param ttl Expiration time in seconds.
   * @returns The incremented counter value.
   * @throws A `TypeError` when `ttl` is not a positive integer.
   */
  async increment(key, ttl) {
    if (!Number.isInteger(ttl) || ttl <= 0) {
      throw new TypeError('Redis increment TTL must be a positive integer');
    }

    const [value] = await redis.multi().incr(key).expire(key, ttl, 'NX').exec();
    return value;
  },
  /**
   * Stores a value with an optional expiration in seconds.
   *
   * @param key Storage key.
   * @param value Value to store.
   * @param ttl Optional expiration time in seconds.
   * @returns A promise that resolves after the value is stored.
   */
  async set(key, value, ttl) {
    if (ttl) {
      await redis.set(key, value, { ex: ttl });
    } else {
      await redis.set(key, value);
    }
  },
  /**
   * Removes a stored value by key.
   *
   * @param key Storage key.
   * @returns A promise that resolves after the value is removed.
   */
  async delete(key) {
    await redis.del(key);
  },
};

/** Better Auth client configured for HikingDownward authentication workflows. */
export const auth = betterAuth({
  appName: 'HikingDownward',
  trustedOrigins: [appUrl],
  databaseHooks: {
    user: {
      update: {
        after: async (updatedUser, context) => {
          const path = context ? context.path : '';
          const eventType = path.includes('/two-factor/') ? 'two_factor_changed' : null;

          if (!eventType || !context) {
            return;
          }

          await recordAuditEvent({
            eventType,
            actorUserId: context.context.session ? context.context.session.user.id : missingActor,
            targetUserId: updatedUser.id,
            path,
            ...getAuditRequestContext(context.request),
          });
        },
      },
    },
    account: {
      update: {
        after: async (updatedAccount, context) => {
          const path = context ? context.path : '';
          if (!path.includes('reset-password') || !context) {
            return;
          }

          await recordAuditEvent({
            eventType: 'password_reset_completed',
            actorUserId: context.context.session ? context.context.session.user.id : missingActor,
            targetUserId: updatedAccount.userId,
            path,
            ...getAuditRequestContext(context.request),
          });
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== '/sign-up/email' && context.path !== '/sign-in/magic-link') {
        return;
      }

      if ('email' in context.body && typeof context.body.email === 'string') {
        context.body.email = context.body.email.trim().toLowerCase();
      }
    }),
    after: createAuthMiddleware(async (context) => {
      if (!context.path.startsWith('/admin/')) {
        return;
      }

      await recordAuditEvent({
        eventType: 'admin_action',
        actorUserId: context.context.session ? context.context.session.user.id : missingActor,
        path: context.path,
        ...getAuditRequestContext(context.request),
      });
    }),
  },
  advanced: {
    cookiePrefix: 'hiking-downward',
    database: {
      joins: true,
    },
  },
  database: drizzleAdapter(db, {
    schema: {
      user,
      account,
      passkey: passkeySchema,
      two_factor: twoFactorSchema,
    },
    camelCase: false,
    schemaName: 'better_auth',
    provider: 'pg',
  }),
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
      sendChangeEmailConfirmation: async ({ user, newEmail, url, token }, request) => {
        await recordAuditEvent({
          eventType: 'account_email_change_requested',
          actorUserId: user.id,
          targetUserId: user.id,
          path: '/change-email',
          ...getAuditRequestContext(request),
        });
        await sendTransactionalEmail({
          body: `A request was made to change your HikingDownward email address to ${newEmail}. If you made this request, confirm the change using the button below.`,
          heading: 'Confirm your new email address',
          preview: 'Confirm the requested change to your HikingDownward email address.',
          subject: 'Confirm your HikingDownward email change',
          textBody: `A request was made to change your HikingDownward email address to ${newEmail}. Confirm the change: ${url}`,
          to: user.email,
          action: { label: 'Confirm email change', url },
          idempotencyKey: `change-email/${token}`,
        });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }, request) => {
        await recordAuditEvent({
          eventType: 'account_deletion_requested',
          actorUserId: user.id,
          targetUserId: user.id,
          path: '/delete-user',
          ...getAuditRequestContext(request),
        });
        await sendTransactionalEmail({
          body: 'A request was made to delete your HikingDownward account. Confirming will permanently delete your account and cannot be undone.',
          heading: 'Confirm account deletion',
          preview: 'Confirm whether you want to permanently delete your account.',
          subject: 'Confirm your HikingDownward account deletion',
          textBody: `A request was made to delete your HikingDownward account. Confirm deletion: ${url}`,
          to: user.email,
          action: { label: 'Confirm account deletion', url },
          idempotencyKey: `delete-account/${token}`,
        });
      },
      beforeDelete: async (user, request) => {
        await recordAuditEvent({
          eventType: 'account_deletion_confirmed',
          actorUserId: user.id,
          targetUserId: user.id,
          path: '/delete-user/callback',
          ...getAuditRequestContext(request),
        });
      },
      afterDelete: async (user, request) => {
        await recordAuditEvent({
          eventType: 'account_deleted',
          actorUserId: user.id,
          targetUserId: user.id,
          path: '/delete-user/callback',
          ...getAuditRequestContext(request),
        });
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    maxPasswordLength: 128,
    minPasswordLength: 8,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    /**
     * Adds application-specific defaults when Better Auth creates a synthetic user.
     *
     * @param coreFields Core user fields supplied by Better Auth.
     * @param additionalFields Additional user fields supplied by Better Auth.
     * @param id Generated user identifier.
     * @returns The complete synthetic user record.
     */
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      // Admin plugin fields (in schema order)
      role: 'user',
      banned: false,
      banReason: null,
      banExpires: null,
      // Your additional fields
      ...additionalFields,
      // ID must be last to match database output order
      id,
    }),
    /**
     * Sends a password reset link to the requesting user.
     *
     * @param user User requesting the password reset.
     * @param url Password reset URL.
     * @param token Password reset token used for idempotency.
     * @returns A promise that resolves after the email is accepted.
     * @throws An error when the email provider rejects the message.
     */
    sendResetPassword: async ({ user, url, token }) => {
      await recordAuditEvent({
        eventType: 'password_reset_requested',
        targetUserId: user.id,
        path: '/request-password-reset',
      });
      await sendTransactionalEmail({
        body: 'Use the button below to choose a new password for your HikingDownward account.',
        heading: 'Reset your password',
        preview: 'Choose a new password for your HikingDownward account.',
        subject: 'Reset your HikingDownward password',
        textBody: `Reset your HikingDownward password: ${url}`,
        to: user.email,
        action: { label: 'Reset password', url },
        idempotencyKey: `reset-password/${token}`,
      });
    },
  },
  rateLimit: {
    storage: 'secondary-storage',
  },
  secondaryStorage: redisSecondaryStorage,
  emailVerification: {
    autoSignInAfterVerification: true,
    /**
     * Sends an email verification link to the user.
     *
     * @param user User requesting verification.
     * @param url Email verification URL.
     * @param token Verification token used for idempotency.
     * @returns A promise that resolves after the email is accepted.
     * @throws An error when the email provider rejects the message.
     */
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendTransactionalEmail({
        body: 'Confirm your email address to finish setting up your HikingDownward account.',
        heading: 'Verify your email',
        preview: 'Confirm your email address to finish setting up your account.',
        subject: 'Verify your HikingDownward email',
        textBody: `Verify your HikingDownward email: ${url}`,
        to: user.email,
        action: { label: 'Verify email', url },
        idempotencyKey: `verify-email/${token}`,
      });
    },
    /**
     * Notifies an existing user when a duplicate signup is attempted.
     *
     * @param user Existing user associated with the signup attempt.
     * @returns A promise that resolves after the email is accepted.
     * @throws An error when the email provider rejects the message.
     */
    onExistingUserSignUp: async ({ user }: { user: User }) => {
      await sendTransactionalEmail({
        body: 'We received a request to create a HikingDownward account with this email address. An account already exists for you, so no new account was created.',
        heading: 'Account notification',
        preview: 'An account already exists for this email address.',
        subject: 'HikingDownward account notification',
        textBody: `An account already exists for this email address. Visit HikingDownward: ${appUrl}`,
        to: user.email,
      });
    },
    sendOnSignUp: true,
  },
  disabledPaths: ['/is-username-available'],
  verification: { storeInDatabase: false },
  plugins: [
    admin(),
    twoFactor({
      allowPasswordless: true,
      issuer: 'hiking-downward',
      twoFactorTable: 'two_factor',
    }),
    username({
      displayUsername: false,
      usernameValidator: (username) => {
        return username.toLowerCase() !== 'admin' && /^[a-zA-Z0-9_-]+$/.test(username);
      },
    }),
    magicLink({
      /**
       * Sends a passwordless sign-in link to the requested email address.
       *
       * @param email Recipient email address.
       * @param url Passwordless sign-in URL.
       * @param token Sign-in token used for idempotency.
       * @returns A promise that resolves after the email is accepted.
       * @throws An error when the email provider rejects the message.
       */
      sendMagicLink: async ({ email, url, token }) => {
        await sendTransactionalEmail({
          body: 'Use the button below to sign in to HikingDownward securely. This link expires shortly.',
          heading: 'Your sign-in link',
          preview: 'Use this secure link to sign in to HikingDownward.',
          subject: 'Your HikingDownward sign-in link',
          textBody: `Sign in to HikingDownward: ${url}`,
          to: email,
          action: { label: 'Sign in securely', url },
          idempotencyKey: `magic-link/${token}`,
        });
      },
      storeToken: 'hashed',
    }),
    passkey(),
    haveIBeenPwned({
      enabled: process.env['NODE_ENV'] === 'production',
    }),
    i18n({ translations: locales }),
  ],
});
