import { defineRelations } from 'drizzle-orm';
import { account } from './account.schema';
import { passkey } from './passkey.schema';
import { twoFactor } from './two-factor.schema';
import { user } from './user.schema';

/** Drizzle relations connecting Better Auth records. */
export const relations = defineRelations({ user, account, twoFactor, passkey }, (r) => ({
  user: {
    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),
    twoFactors: r.many.twoFactor({
      from: r.user.id,
      to: r.twoFactor.userId,
    }),
    passkeys: r.many.passkey({
      from: r.user.id,
      to: r.passkey.userId,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  twoFactor: {
    user: r.one.user({
      from: r.twoFactor.userId,
      to: r.user.id,
    }),
  },
  passkey: {
    user: r.one.user({
      from: r.passkey.userId,
      to: r.user.id,
    }),
  },
}));
