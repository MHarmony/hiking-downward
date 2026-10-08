import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DangerZone } from './danger-zone';

/** Account-deletion response shape returned by the test auth client. */
type DeleteResponse = {
  /** Whether the deletion request was accepted. */
  data: { success: boolean; message: string } | null;
  /** Request error, when present. */
  error: { message?: string } | null;
};

/** Session response shape used to display the deletion email destination. */
type SessionResponse = {
  /** Current account data or a missing session. */
  data: { user: { email: string } } | null;
  /** Session lookup error, when present. */
  error: { message?: string } | null;
};

describe('DangerZone', () => {
  let fixture: ComponentFixture<DangerZone>;
  let getSession: ReturnType<typeof vi.fn<() => Promise<SessionResponse>>>;
  let deleteUser: ReturnType<
    typeof vi.fn<(input: Record<string, unknown>) => Promise<DeleteResponse>>
  >;

  beforeEach(() => {
    getSession = vi.fn<() => Promise<SessionResponse>>().mockResolvedValue({
      data: { user: { email: 'hiker@example.com' } },
      error: null,
    });
    deleteUser = vi
      .fn<(input: Record<string, unknown>) => Promise<DeleteResponse>>()
      .mockResolvedValue({
        data: { success: true, message: 'Verification email sent' },
        error: null,
      });
    TestBed.configureTestingModule({
      imports: [DangerZone],
      providers: [
        provideRouter([]),
        {
          provide: FrontendAuth,
          useValue: {
            authClient: {
              deleteUser,
              getSession,
            },
          },
        },
      ],
    });
  });

  /** Creates and renders a danger-zone fixture. */
  function createFixture(): ComponentFixture<DangerZone> {
    const createdFixture = TestBed.createComponent(DangerZone);
    createdFixture.detectChanges();
    return createdFixture;
  }

  /**
   * Waits for the account email to appear in the rendered confirmation UI.
   *
   * @returns A promise settling when the email is visible.
   */
  async function waitForEmail(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('hiker@example.com');
    });
  }

  it('requests email-confirmed deletion only after the user types DELETE', async () => {
    fixture = createFixture();
    await waitForEmail();
    const confirmation = fixture.nativeElement.querySelector(
      '#delete-confirmation',
    ) as HTMLInputElement;
    confirmation.value = 'DELETE';
    confirmation.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(deleteUser).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: expect.stringContaining('/account-deleted') }),
    );
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'hiker@example.com',
    );
  }, 10_000);

  it('blocks deletion when the confirmation phrase is incorrect', async () => {
    fixture = createFixture();
    await waitForEmail();
    const confirmation = fixture.nativeElement.querySelector(
      '#delete-confirmation',
    ) as HTMLInputElement;
    confirmation.value = 'delete';
    confirmation.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(deleteUser).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Type DELETE to confirm account deletion.');
  }, 10_000);

  it('shows deletion request errors without claiming the account was deleted', async () => {
    fixture = createFixture();
    await waitForEmail();
    deleteUser.mockResolvedValueOnce({ data: null, error: { message: 'Session expired.' } });
    const confirmation = fixture.nativeElement.querySelector(
      '#delete-confirmation',
    ) as HTMLInputElement;
    confirmation.value = 'DELETE';
    confirmation.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Session expired.');
    expect(fixture.nativeElement.textContent).not.toContain('Account deleted');
  }, 10_000);

  it('sends the optional current password for accounts with a credential', async () => {
    fixture = createFixture();
    await waitForEmail();
    const password = fixture.nativeElement.querySelector('#delete-password') as HTMLInputElement;
    password.value = 'current-password';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    const confirmation = fixture.nativeElement.querySelector(
      '#delete-confirmation',
    ) as HTMLInputElement;
    confirmation.value = 'DELETE';
    confirmation.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(deleteUser).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'current-password' }),
    );
  }, 10_000);

  it('rejects passwords longer than Better Auth allows', async () => {
    fixture = createFixture();
    await waitForEmail();
    const password = fixture.nativeElement.querySelector('#delete-password') as HTMLInputElement;
    password.value = 'x'.repeat(129);
    password.dispatchEvent(new Event('input', { bubbles: true }));
    const confirmation = fixture.nativeElement.querySelector(
      '#delete-confirmation',
    ) as HTMLInputElement;
    confirmation.value = 'DELETE';
    confirmation.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(deleteUser).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Password must be no more than 128 characters.',
    );
  }, 10_000);

  it('shows a network error when the deletion request rejects', async () => {
    fixture = createFixture();
    await waitForEmail();
    deleteUser.mockRejectedValueOnce(new Error('Network unavailable'));
    const confirmation = fixture.nativeElement.querySelector(
      '#delete-confirmation',
    ) as HTMLInputElement;
    confirmation.value = 'DELETE';
    confirmation.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Check your connection and try again.');
  }, 10_000);

  it('uses a generic recipient label when the current session has no user', async () => {
    getSession.mockResolvedValueOnce({ data: null, error: null });
    fixture = createFixture();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('your account email address');
    });
  }, 10_000);

  it('uses a generic recipient label when the session request rejects', async () => {
    getSession.mockRejectedValueOnce(new Error('Network unavailable'));
    fixture = createFixture();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('your account email address');
    });
  }, 10_000);
});
