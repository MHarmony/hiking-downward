import { boolean, index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { betterAuthSchema } from './db-constants.schema';
import { user } from './user.schema';

/** Better Auth two-factor authentication records for users. */
export const twoFactor = betterAuthSchema.table(
  'two_factor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: boolean('verified').default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: timestamp('locked_until'),
  },
  (table) => [
    index('two_factor_secret_idx').on(table.secret),
    index('two_factor_user_id_idx').on(table.userId),
  ],
);
