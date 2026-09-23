import { beforeEach, describe, expect, it, vi } from 'vitest';

const noValue = null as never;

type ValuesMock = ReturnType<typeof vi.fn<() => Promise<void>>>;

const { insertMock, valuesMock } = vi.hoisted(() => ({
  insertMock: vi.fn<() => { values: ValuesMock }>(),
  valuesMock: vi.fn<() => Promise<void>>().mockResolvedValue(null as never),
}));

vi.mock('@seahawk/database', () => ({
  auditEvent: { name: 'audit_event' },
  db: { insert: insertMock },
}));

import { getAuditRequestContext, recordAuditEvent, recordSensitiveResourceAccess } from './audit';

describe('audit events', () => {
  beforeEach(() => {
    insertMock.mockReturnValue({ values: valuesMock });
    valuesMock.mockResolvedValue(noValue);
  });

  it('persists safe audit metadata and request context', async () => {
    await recordAuditEvent({
      eventType: 'admin_action',
      actorUserId: 'actor-id',
      targetUserId: 'target-id',
      path: '/api/admin/users',
      requestId: 'request-id',
      metadata: {
        action: 'ban-user',
        password: 'never-store',
        accessToken: 'never-store',
      },
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'admin_action',
        actorUserId: 'actor-id',
        targetUserId: 'target-id',
        path: '/api/admin/users',
        requestId: 'request-id',
        metadata: { action: 'ban-user' },
      }),
    );
  }, 10_000);

  it('records sensitive resource access through the shared event API', async () => {
    await recordSensitiveResourceAccess({
      actorUserId: 'actor-id',
      resourceType: 'trail',
      resourceId: 'trail-id',
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'sensitive_resource_access',
        resourceType: 'trail',
        resourceId: 'trail-id',
      }),
    );
  }, 10_000);

  it('extracts safe request metadata', () => {
    expect(getAuditRequestContext()).toEqual({});
    expect(getAuditRequestContext(new Request('http://localhost'))).toEqual({});
    expect(
      getAuditRequestContext(
        new Request('http://localhost', {
          headers: {
            'user-agent': 'test-agent',
            'x-forwarded-for': ' 203.0.113.10, 203.0.113.11',
            'x-request-id': 'request-id',
          },
        }),
      ),
    ).toEqual({
      ipAddress: '203.0.113.10',
      requestId: 'request-id',
      userAgent: 'test-agent',
    });
    expect(
      getAuditRequestContext(
        new Request('http://localhost', { headers: { 'x-real-ip': '198.51.100.4' } }),
      ),
    ).toEqual({ ipAddress: '198.51.100.4' });
  }, 10_000);

  it('does not block the caller when persistence fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => noValue);
    valuesMock.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      recordAuditEvent({ eventType: 'password_reset_requested' }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('Unable to persist audit event', {
      eventType: 'password_reset_requested',
    });

    errorSpy.mockRestore();
  }, 10_000);
});
