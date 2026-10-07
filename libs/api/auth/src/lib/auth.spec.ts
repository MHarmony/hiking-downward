import * as fc from 'fast-check';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const noValue = null as never;

type RedisMultiMock = {
  incr: ReturnType<typeof vi.fn<(key: string) => unknown>>;
  expire: ReturnType<typeof vi.fn<(key: string, ttl: number, mode: string) => unknown>>;
  exec: ReturnType<typeof vi.fn<() => Promise<number[]>>>;
};

type RedisMock = {
  del: ReturnType<typeof vi.fn<(key: string) => Promise<number>>>;
  get: ReturnType<typeof vi.fn<(key: string) => Promise<string | null>>>;
  getdel: ReturnType<typeof vi.fn<(key: string) => Promise<string | null>>>;
  multi: ReturnType<typeof vi.fn<() => RedisMultiMock>>;
  ping: ReturnType<typeof vi.fn<() => Promise<string>>>;
  set: ReturnType<
    typeof vi.fn<(key: string, value: unknown, options?: { ex?: number }) => Promise<void>>
  >;
};

const {
  betterAuthMock,
  getAuditRequestContextMock,
  recordAuditMock,
  sendEmailMock,
  redisMock,
  redisMultiMock,
} = vi.hoisted(() => {
  const redisMultiMock: RedisMultiMock = {
    incr: vi.fn<(key: string) => unknown>().mockReturnThis(),
    expire: vi.fn<(key: string, ttl: number, mode: string) => unknown>().mockReturnThis(),
    exec: vi.fn<() => Promise<number[]>>(),
  };
  const redisMock: RedisMock = {
    del: vi.fn<(key: string) => Promise<number>>(),
    get: vi.fn<(key: string) => Promise<string | null>>(),
    getdel: vi.fn<(key: string) => Promise<string | null>>(),
    multi: vi.fn<() => RedisMultiMock>(() => redisMultiMock),
    ping: vi.fn<() => Promise<string>>(),
    set: vi.fn<(key: string, value: unknown, options?: { ex?: number }) => Promise<void>>(),
  };

  return {
    betterAuthMock: vi.fn<(options: unknown) => unknown>((options) => options),
    getAuditRequestContextMock: vi.fn<() => Record<string, string>>(() => ({
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'test-agent',
    })),
    recordAuditMock: vi
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(null as never),
    redisMock,
    redisMultiMock,
    sendEmailMock: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  };
});
const usernameOptions: {
  displayUsernameValidator: (value: string) => boolean;
  usernameValidator: (value: string) => boolean;
} = {
  displayUsernameValidator: (_value: string): boolean => false,
  usernameValidator: (_value: string): boolean => false,
};
type MagicLinkOptions = {
  sendMagicLink: (input: { email: string; url: string; token: string }) => Promise<void>;
};
const magicLinkOptions: MagicLinkOptions = {
  sendMagicLink: async (_input): Promise<void> => {
    await Promise.resolve();
  },
};

vi.mock('@better-auth/drizzle-adapter/relations-v2', () => ({
  drizzleAdapter: vi.fn<() => { adapter: boolean }>(() => ({ adapter: true })),
}));
vi.mock('@better-auth/i18n', () => ({
  i18n: vi.fn<() => { id: string }>(() => ({ id: 'i18n' })),
  locales: {},
}));
vi.mock('@better-auth/passkey', () => ({
  passkey: vi.fn<() => { id: string }>(() => ({ id: 'passkey' })),
}));
vi.mock('@hiking-downward/database', () => ({
  account: {},
  db: {},
  passkey: {},
  session: {},
  twoFactor: {},
  user: {},
  verification: {},
}));
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn<() => typeof redisMock>(() => redisMock),
  },
}));
vi.mock('better-auth/minimal', () => ({ betterAuth: betterAuthMock }));
vi.mock('better-auth/plugins', () => ({
  admin: vi.fn<() => { id: string }>(() => ({ id: 'admin' })),
  haveIBeenPwned: vi.fn<() => { id: string }>(() => ({ id: 'pwned' })),
  magicLink: vi.fn<(options: MagicLinkOptions) => { id: string }>((options) => {
    Object.assign(magicLinkOptions, options);
    return { id: 'magic-link' };
  }),
  twoFactor: vi.fn<() => { id: string }>(() => ({ id: 'two-factor' })),
  username: vi.fn<(options: typeof usernameOptions) => { id: string }>((options) => {
    Object.assign(usernameOptions, options);
    return { id: 'username' };
  }),
}));
vi.mock('./email', () => ({
  appUrl: 'http://localhost:4200',
  sendTransactionalEmail: sendEmailMock,
}));
vi.mock('./audit', () => ({
  getAuditRequestContext: getAuditRequestContextMock,
  recordAuditEvent: recordAuditMock,
}));

type AuthOptions = {
  user: {
    changeEmail: {
      enabled: boolean;
      updateEmailWithoutVerification: boolean;
      sendChangeEmailConfirmation: (
        input: {
          user: { id: string; email: string };
          newEmail: string;
          url: string;
          token: string;
        },
        request?: Request,
      ) => Promise<void>;
    };
    deleteUser: {
      enabled: boolean;
      sendDeleteAccountVerification: (
        input: { user: { id: string; email: string }; url: string; token: string },
        request?: Request,
      ) => Promise<void>;
      beforeDelete: (user: { id: string; email: string }, request?: Request) => Promise<void>;
      afterDelete: (user: { id: string; email: string }, request?: Request) => Promise<void>;
    };
  };
  emailAndPassword: {
    customSyntheticUser: (input: {
      coreFields: Record<string, unknown>;
      additionalFields: Record<string, unknown>;
      id: string;
    }) => Record<string, unknown>;
    sendResetPassword: (input: {
      user: { email: string };
      url: string;
      token: string;
    }) => Promise<void>;
  };
  emailVerification: {
    onExistingUserSignUp: (input: { user: { email: string } }) => Promise<void>;
    sendVerificationEmail: (input: {
      user: { email: string };
      url: string;
      token: string;
    }) => Promise<void>;
  };
  databaseHooks: {
    user: {
      update: {
        after: (
          user: { id: string },
          context?: { path: string; context: { session?: { user: { id: string } } } },
        ) => Promise<void>;
      };
    };
    account: {
      update: {
        after: (
          account: { userId: string },
          context?: { path: string; context: { session?: { user: { id: string } } } },
        ) => Promise<void>;
      };
    };
  };
  hooks: {
    before: (context: { path: string; body: Record<string, unknown> }) => Promise<void>;
    after: (context: {
      path: string;
      request: Request;
      context: { session?: { user: { id: string } } };
    }) => Promise<void>;
  };
  plugins: unknown[];
  secondaryStorage: {
    delete: (key: string) => Promise<void>;
    get: (key: string) => Promise<unknown>;
    getAndDelete: (key: string) => Promise<unknown>;
    increment: (key: string, ttl: number) => Promise<number | null>;
    set: (key: string, value: unknown, ttl?: number) => Promise<void>;
  };
};

/**
 * Loads the mocked auth configuration for a specific Node environment.
 *
 * @param nodeEnvironment Environment value supplied to the auth module.
 * @returns The Better Auth options captured by the test double.
 */
async function loadAuth(nodeEnvironment: string): Promise<AuthOptions> {
  process.env['NODE_ENV'] = nodeEnvironment;
  vi.resetModules();
  const { auth } = await import('./auth');
  return auth as unknown as AuthOptions;
}

describe('auth configuration', () => {
  let authOptions: AuthOptions;

  beforeAll(async () => {
    authOptions = await loadAuth('production');
  });

  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(null);
    recordAuditMock.mockReset();
    recordAuditMock.mockResolvedValue(noValue);
    redisMock.get.mockReset();
    redisMock.getdel.mockReset();
    redisMock.set.mockReset();
    redisMock.del.mockReset();
    redisMock.multi.mockClear();
    redisMock.ping.mockReset();
    redisMultiMock.incr.mockClear();
    redisMultiMock.expire.mockClear();
    redisMultiMock.exec.mockReset();
    redisMock.get.mockResolvedValue('cached-value');
    redisMock.getdel.mockResolvedValue('deleted-value');
    redisMock.set.mockImplementation(async () => Promise.resolve());
    redisMock.del.mockResolvedValue(1);
    redisMultiMock.exec.mockResolvedValue([42]);
    redisMock.ping.mockResolvedValue('PONG');
  });

  it('builds a synthetic admin-compatible user in schema order', () => {
    expect(
      authOptions.emailAndPassword.customSyntheticUser({
        coreFields: { name: 'Synthetic', email: 'person@example.com' },
        additionalFields: { username: 'person' },
        id: 'user-id',
      }),
    ).toEqual({
      name: 'Synthetic',
      email: 'person@example.com',
      role: 'user',
      banned: false,
      banReason: null,
      banExpires: null,
      username: 'person',
      id: 'user-id',
    });
  }, 10_000);

  it('enables verified email changes and sends confirmation to the current address', async () => {
    const { changeEmail } = authOptions.user;
    expect(changeEmail.enabled).toBe(true);
    expect(changeEmail.updateEmailWithoutVerification).toBe(false);

    const request = new Request('https://api.example.com/api/auth/change-email', {
      headers: { 'x-request-id': 'request-id' },
    });
    await changeEmail.sendChangeEmailConfirmation(
      {
        user: { id: 'user-id', email: 'current@example.com' },
        newEmail: 'new@example.com',
        url: 'https://example.com/verify-email?token=secret-token',
        token: 'change-token',
      },
      request,
    );

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Confirm your HikingDownward email change',
        to: 'current@example.com',
        textBody: expect.stringContaining('new@example.com'),
        action: {
          label: 'Confirm email change',
          url: 'https://example.com/verify-email?token=secret-token',
        },
        idempotencyKey: 'change-email/change-token',
      }),
    );
    expect(recordAuditMock).toHaveBeenCalledWith({
      eventType: 'account_email_change_requested',
      actorUserId: 'user-id',
      targetUserId: 'user-id',
      path: '/change-email',
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'test-agent',
    });
  }, 10_000);

  it('sends deletion verification and audits the confirmed deletion lifecycle', async () => {
    const { deleteUser } = authOptions.user;
    expect(deleteUser.enabled).toBe(true);
    const user = { id: 'user-id', email: 'person@example.com' };
    const request = new Request('https://api.example.com/api/auth/delete-user', {
      headers: { 'x-request-id': 'request-id' },
    });

    await deleteUser.sendDeleteAccountVerification(
      {
        user,
        url: 'https://example.com/delete-user?token=secret-token',
        token: 'delete-token',
      },
      request,
    );

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Confirm your HikingDownward account deletion',
        to: 'person@example.com',
        action: {
          label: 'Confirm account deletion',
          url: 'https://example.com/delete-user?token=secret-token',
        },
        idempotencyKey: 'delete-account/delete-token',
      }),
    );
    expect(recordAuditMock).toHaveBeenNthCalledWith(1, {
      eventType: 'account_deletion_requested',
      actorUserId: 'user-id',
      targetUserId: 'user-id',
      path: '/delete-user',
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'test-agent',
    });

    await deleteUser.beforeDelete(user, request);
    await deleteUser.afterDelete(user, request);

    expect(recordAuditMock).toHaveBeenNthCalledWith(2, {
      eventType: 'account_deletion_confirmed',
      actorUserId: 'user-id',
      targetUserId: 'user-id',
      path: '/delete-user/callback',
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'test-agent',
    });
    expect(recordAuditMock).toHaveBeenNthCalledWith(3, {
      eventType: 'account_deleted',
      actorUserId: 'user-id',
      targetUserId: 'user-id',
      path: '/delete-user/callback',
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'test-agent',
    });
  }, 10_000);

  it('sends the reset-password email', async () => {
    await authOptions.emailAndPassword.sendResetPassword({
      user: { email: 'person@example.com' },
      url: 'https://example.com/reset',
      token: 'reset-token',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Reset your HikingDownward password',
        to: 'person@example.com',
        idempotencyKey: 'reset-password/reset-token',
      }),
    );
  }, 10_000);

  it('audits password reset completion, two-factor changes, and admin actions', async () => {
    const resetHook = authOptions.databaseHooks.account.update.after;
    const userHook = authOptions.databaseHooks.user.update.after;
    const adminHook = authOptions.hooks.after;
    const context = {
      path: '/two-factor/enable',
      context: { session: { user: { id: 'actor-id' } } },
    };

    await resetHook({ userId: 'target-id' }, { ...context, path: '/reset-password' });
    await userHook({ id: 'target-id' }, context);

    expect(recordAuditMock).toHaveBeenNthCalledWith(1, {
      eventType: 'password_reset_completed',
      actorUserId: 'actor-id',
      targetUserId: 'target-id',
      path: '/reset-password',
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'test-agent',
    });
    expect(recordAuditMock).toHaveBeenNthCalledWith(2, {
      eventType: 'two_factor_changed',
      actorUserId: 'actor-id',
      targetUserId: 'target-id',
      path: '/two-factor/enable',
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'test-agent',
    });
    await adminHook({
      path: '/admin/ban-user',
      context: { session: { user: { id: 'actor-id' } } },
      request: new Request('http://localhost/admin/ban-user'),
    });
    expect(recordAuditMock).toHaveBeenNthCalledWith(3, {
      eventType: 'admin_action',
      actorUserId: 'actor-id',
      path: '/admin/ban-user',
      ipAddress: '127.0.0.1',
      requestId: 'request-id',
      userAgent: 'test-agent',
    });
    await adminHook({
      path: '/session/get',
      context: { session: { user: { id: 'actor-id' } } },
      request: new Request('http://localhost/session/get'),
    });
    await adminHook({
      path: '/admin/list-users',
      context: {},
      request: new Request('http://localhost/admin/list-users'),
    });

    await userHook({ id: 'target-id' }, { path: '/profile/update', context: {} });
    await userHook({ id: 'target-id' }, noValue);
    await resetHook({ userId: 'target-id' }, { path: '/account/update', context: {} });
    await resetHook({ userId: 'target-id' }, noValue);
    await userHook({ id: 'target-id' }, { path: '/two-factor/disable', context: {} });
    await userHook({ id: 'target-id' }, { path: '/admin/list-users', context: {} });
    await resetHook({ userId: 'target-id' }, { path: '/reset-password', context: {} });
    await userHook({ id: 'target-id' }, noValue);
    await resetHook({ userId: 'target-id' }, noValue);
  }, 10_000);

  it('sends the verification email', async () => {
    await authOptions.emailVerification.sendVerificationEmail({
      user: { email: 'person@example.com' },
      url: 'https://example.com/verify',
      token: 'verify-token',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Verify your HikingDownward email',
        to: 'person@example.com',
        idempotencyKey: 'verify-email/verify-token',
      }),
    );
  }, 10_000);

  it('sends the existing-user signup notification', async () => {
    await authOptions.emailVerification.onExistingUserSignUp({
      user: { email: 'person@example.com' },
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'HikingDownward account notification',
        textBody: expect.stringContaining('http://localhost:4200'),
        to: 'person@example.com',
      }),
    );
  }, 10_000);

  it('normalizes registration emails in the before hook', async () => {
    const beforeHook = authOptions.hooks.before;
    const signUpContext = { path: '/sign-up/email', body: { email: '  PERSON@Example.COM  ' } };
    const magicLinkContext = {
      path: '/sign-in/magic-link',
      body: { email: '  HIKER@Example.COM  ' },
    };
    const unrelatedContext = { path: '/sign-in/email', body: { email: 'Person@Example.COM' } };
    const invalidEmailContext = { path: '/sign-up/email', body: { email: 42 } };

    await beforeHook(signUpContext);
    await beforeHook(magicLinkContext);
    await beforeHook(unrelatedContext);
    await beforeHook(invalidEmailContext);

    expect(signUpContext.body.email).toBe('person@example.com');
    expect(magicLinkContext.body.email).toBe('hiker@example.com');
    expect(unrelatedContext.body.email).toBe('Person@Example.COM');
    expect(invalidEmailContext.body.email).toBe(42);
  }, 10_000);

  it('sends the magic link email', async () => {
    await magicLinkOptions.sendMagicLink({
      email: 'person@example.com',
      url: 'https://example.com/magic',
      token: 'magic-token',
    });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your HikingDownward sign-in link',
        idempotencyKey: 'magic-link/magic-token',
        to: 'person@example.com',
      }),
    );
  }, 10_000);
});

describe('auth validators and environment configuration', () => {
  it('loads the non-production plugin configuration', async () => {
    const authOptions = await loadAuth('test');
    expect(authOptions.plugins).toHaveLength(7);
    expect(usernameOptions.displayUsernameValidator('valid_name-1')).toBe(true);
    expect(usernameOptions.displayUsernameValidator('invalid name')).toBe(false);
    expect(usernameOptions.usernameValidator('admin')).toBe(false);
    expect(usernameOptions.usernameValidator('hiker')).toBe(true);
  }, 10_000);

  it('accepts display usernames made only from the permitted alphabet', () => {
    const permittedCharacter = fc.constantFrom(
      ...Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'),
    );
    const displayUsername = fc
      .array(permittedCharacter, { minLength: 1 })
      .map((characters) => characters.join(''));

    fc.assert(
      fc.property(displayUsername, (value) => {
        expect(usernameOptions.displayUsernameValidator(value)).toBe(true);
      }),
    );
  }, 10_000);

  it('rejects display usernames containing a forbidden character', () => {
    const permittedCharacter = fc.constantFrom(
      ...Array.from('abcdefghijklmnopqrstuvwxyz0123456789'),
    );
    const forbiddenCharacter = fc.constantFrom(' ', '.', '/', '@', ':');

    fc.assert(
      fc.property(
        fc.array(permittedCharacter, { maxLength: 20 }),
        forbiddenCharacter,
        (prefix, forbidden) => {
          expect(usernameOptions.displayUsernameValidator(`${prefix.join('')}${forbidden}`)).toBe(
            false,
          );
        },
      ),
    );
  }, 10_000);

  it('uses the redis secondary storage for rate limiting and cache behavior', async () => {
    const authOptions = await loadAuth('test');

    await expect(authOptions.secondaryStorage.get('ratelimit:user:1')).resolves.toBe(
      'cached-value',
    );
    await expect(authOptions.secondaryStorage.getAndDelete('ratelimit:user:1')).resolves.toBe(
      'deleted-value',
    );

    await authOptions.secondaryStorage.set('ratelimit:user:1', { count: 1 }, 60);
    await authOptions.secondaryStorage.set('ratelimit:user:1', { count: 2 });
    await authOptions.secondaryStorage.delete('ratelimit:user:1');

    await expect(authOptions.secondaryStorage.increment('ratelimit:user:2', 30)).resolves.toBe(42);
    await expect(authOptions.secondaryStorage.increment('ratelimit:user:3', 0)).rejects.toThrow(
      'Redis increment TTL must be a positive integer',
    );

    expect(redisMock.get).toHaveBeenCalledWith('ratelimit:user:1');
    expect(redisMock.getdel).toHaveBeenCalledWith('ratelimit:user:1');
    expect(redisMock.set).toHaveBeenNthCalledWith(1, 'ratelimit:user:1', { count: 1 }, { ex: 60 });
    expect(redisMock.set).toHaveBeenNthCalledWith(2, 'ratelimit:user:1', { count: 2 });
    expect(redisMock.del).toHaveBeenCalledWith('ratelimit:user:1');
    expect(redisMock.multi).toHaveBeenCalledWith();
    expect(redisMultiMock.incr).toHaveBeenCalledWith('ratelimit:user:2');
    expect(redisMultiMock.expire).toHaveBeenCalledWith('ratelimit:user:2', 30, 'NX');
  }, 10_000);

  it('checks Redis readiness and closes its HTTP client safely', async () => {
    const { checkRedis, closeRedis } = await import('./auth');

    await checkRedis();
    await closeRedis();

    expect(redisMock.ping).toHaveBeenCalledOnce();
  }, 10_000);

  it('rejects every non-positive or non-integer Redis increment TTL', async () => {
    const authOptions = await loadAuth('test');
    const invalidTtl = fc.oneof(
      fc.integer({ max: 0 }),
      fc.double().filter((value) => !Number.isInteger(value) || !Number.isFinite(value)),
    );

    await fc.assert(
      fc.asyncProperty(invalidTtl, async (ttl) => {
        await expect(
          authOptions.secondaryStorage.increment('ratelimit:user:invalid', ttl),
        ).rejects.toThrow('Redis increment TTL must be a positive integer');
      }),
    );
  }, 10_000);
});
