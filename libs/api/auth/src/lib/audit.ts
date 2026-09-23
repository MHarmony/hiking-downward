import { auditEvent, db } from '@seahawk/database';
import { randomUUID } from 'node:crypto';

/** Event names persisted by the application audit log. */
export type AuditEventType =
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'two_factor_changed'
  | 'admin_action'
  | 'sensitive_resource_access';

/** Safe request context attached to an audit event. */
export type AuditRequestContext = {
  /** User responsible for the event, when known. */
  actorUserId?: string;
  /** User affected by the event, when applicable. */
  targetUserId?: string;
  /** Request or endpoint path that produced the event. */
  path?: string;
  /** Correlation identifier for the originating request. */
  requestId?: string;
  /** Originating client IP address, when available. */
  ipAddress?: string;
  /** Originating client user-agent, when available. */
  userAgent?: string;
};

/** Input used to persist an application audit event. */
export type AuditEventInput = AuditRequestContext & {
  /** Stable event category. */
  eventType: AuditEventType;
  /** Type of protected resource affected by the event. */
  resourceType?: string;
  /** Identifier of the protected resource affected by the event. */
  resourceId?: string;
  /** Additional non-sensitive event details. */
  metadata?: Record<string, unknown>;
};

/**
 * Extracts non-sensitive request metadata from an auth request.
 *
 * @param request Optional request whose safe headers should be inspected.
 * @returns Request metadata suitable for audit persistence.
 */
export function getAuditRequestContext(request?: Request): AuditRequestContext {
  if (!request) {
    return {};
  }

  const headers = request.headers;
  const requestId = headers.get('x-request-id');
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const userAgent = headers.get('user-agent');
  const firstForwardedIp = forwardedFor ? forwardedFor.split(',')[0] : null;
  const ipAddress = firstForwardedIp ? firstForwardedIp.trim() : realIp;

  return {
    ...(requestId ? { requestId } : {}),
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

const sensitiveKeyPattern = /password|secret|token|backup.?code|access.?token|refresh.?token/i;

/**
 * Removes credential-like fields from event metadata.
 *
 * @param metadata Metadata supplied by the event producer.
 * @returns Metadata with sensitive keys removed.
 */
function redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !sensitiveKeyPattern.test(key)),
  );
}

/**
 * Persists an audit event without blocking the user action on audit failure.
 *
 * @param event Event data to persist.
 * @returns A promise that resolves after persistence succeeds or fails safely.
 */
export async function recordAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    await db.insert(auditEvent).values({
      id: randomUUID(),
      eventType: event.eventType,
      actorUserId: event.actorUserId,
      targetUserId: event.targetUserId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      path: event.path,
      requestId: event.requestId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      metadata: redactMetadata(event.metadata ?? {}),
    });
  } catch {
    /* oxlint-disable-next-line no-console */
    console.error('Unable to persist audit event', { eventType: event.eventType });
  }
}

/**
 * Records access to a future sensitive application resource.
 *
 * @param context Resource and request context for the access.
 * @returns A promise that resolves after the best-effort audit attempt.
 */
export async function recordSensitiveResourceAccess(
  context: AuditRequestContext & { resourceType: string; resourceId: string },
): Promise<void> {
  await recordAuditEvent({
    ...context,
    eventType: 'sensitive_resource_access',
  });
}
