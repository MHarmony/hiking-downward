import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { hikingDownwardSchema } from './db-constants.schema';

/** Durable security and sensitive-operation audit events. */
export const auditEvent = hikingDownwardSchema.table(
  'audit_event',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    actorUserId: text('actor_user_id'),
    targetUserId: text('target_user_id'),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    path: text('path'),
    requestId: text('request_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_event_type_created_at_idx').on(table.eventType, table.createdAt),
    index('audit_event_actor_user_id_idx').on(table.actorUserId),
    index('audit_event_target_user_id_idx').on(table.targetUserId),
    index('audit_event_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_event_request_id_idx').on(table.requestId),
  ],
);
