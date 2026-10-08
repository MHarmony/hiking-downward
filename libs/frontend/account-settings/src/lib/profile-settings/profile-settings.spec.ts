import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FrontendAuth } from '@hiking-downward/frontend-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSettings } from './profile-settings';

/** Session response shape used by the profile fixture. */
type SessionResponse = {
  /** Profile data or a missing session. */
  data: {
    user: { name?: string | null; username?: string | null; displayUsername?: string | null };
  } | null;
  /** Session lookup error, when present. */
  error: { message?: string } | null;
};

/** Update-user response shape used by profile-save tests. */
type UpdateResponse = {
  /** Better Auth response payload. */
  data: unknown;
  /** Update error, when present. */
  error: { message?: string } | null;
};

describe('ProfileSettings', () => {
  let fixture: ComponentFixture<ProfileSettings>;
  let getSession: ReturnType<typeof vi.fn<() => Promise<SessionResponse>>>;
  let updateUser: ReturnType<
    typeof vi.fn<(value: Record<string, string>) => Promise<UpdateResponse>>
  >;

  beforeEach(() => {
    getSession = vi.fn<() => Promise<SessionResponse>>().mockResolvedValue({
      data: {
        user: {
          name: 'Trail Hiker',
          username: 'trail_hiker',
          displayUsername: 'Trail Hiker',
        },
      },
      error: null,
    });
    updateUser = vi
      .fn<(value: Record<string, string>) => Promise<UpdateResponse>>()
      .mockResolvedValue({
        data: { status: true },
        error: null,
      });

    TestBed.configureTestingModule({
      imports: [ProfileSettings],
      providers: [
        provideRouter([]),
        { provide: FrontendAuth, useValue: { authClient: { getSession, updateUser } } },
      ],
    });
  });

  /** Creates and renders a profile-settings fixture. */
  function createFixture(): ComponentFixture<ProfileSettings> {
    fixture = TestBed.createComponent(ProfileSettings);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Waits until the profile-loading state has finished.
   *
   * @returns A promise settling when the fixture displays its loaded state.
   */
  async function waitForProfileLoad(): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('Loading your profile…');
    });
  }

  it('loads and displays the signed-in profile', async () => {
    fixture = createFixture();
    await waitForProfileLoad();

    expect(getSession).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('#display-name').value).toBe('Trail Hiker');
    expect(fixture.nativeElement.querySelector('#username').value).toBe('trail_hiker');
    expect(fixture.nativeElement.querySelector('#public-username').value).toBe('Trail Hiker');
  }, 10_000);

  it('uses empty defaults for nullable profile fields', async () => {
    getSession.mockResolvedValueOnce({
      data: { user: { name: null, username: null, displayUsername: null } },
      error: null,
    });
    fixture = createFixture();
    await waitForProfileLoad();

    expect(fixture.nativeElement.querySelector('#display-name').value).toBe('');
    expect(fixture.nativeElement.querySelector('#username').value).toBe('');
    expect(fixture.nativeElement.querySelector('#public-username').value).toBe('');
  }, 10_000);

  it('saves the profile fields and announces success', async () => {
    fixture = createFixture();
    await waitForProfileLoad();
    const name = fixture.nativeElement.querySelector('#display-name') as HTMLInputElement;
    name.value = '  Ridge Walker  ';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const username = fixture.nativeElement.querySelector('#username') as HTMLInputElement;
    username.value = 'ridge_walker';
    username.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(updateUser).toHaveBeenCalledWith({
      name: 'Ridge Walker',
      username: 'ridge_walker',
      displayUsername: 'Trail Hiker',
    });
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Profile saved.',
    );
  }, 10_000);

  it('rejects reserved usernames before sending an update', async () => {
    fixture = createFixture();
    await waitForProfileLoad();
    const username = fixture.nativeElement.querySelector('#username') as HTMLInputElement;
    username.value = 'admin';
    username.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(updateUser).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('That username is reserved.');
  }, 10_000);

  it('shows server errors without reporting a successful save', async () => {
    fixture = createFixture();
    await waitForProfileLoad();
    updateUser.mockResolvedValueOnce({ data: null, error: { message: 'Username already taken.' } });
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Username already taken.',
    );
  }, 10_000);

  it('handles both a missing session and a failed session request', async () => {
    getSession.mockResolvedValueOnce({ data: null, error: null });
    fixture = createFixture();
    await waitForProfileLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load your profile.');

    fixture.destroy();
    getSession.mockRejectedValueOnce(new Error('Network unavailable'));
    fixture = createFixture();
    await waitForProfileLoad();
    expect(fixture.nativeElement.textContent).toContain('Unable to load your profile.');
  }, 10_000);

  it('shows an error when a profile save request throws', async () => {
    fixture = createFixture();
    await waitForProfileLoad();
    updateUser.mockRejectedValueOnce(new Error('Network unavailable'));
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Check your connection and try again.');
  }, 10_000);

  it('omits blank optional usernames from the update payload', async () => {
    fixture = createFixture();
    await waitForProfileLoad();
    const username = fixture.nativeElement.querySelector('#username') as HTMLInputElement;
    const displayUsername = fixture.nativeElement.querySelector(
      '#public-username',
    ) as HTMLInputElement;
    username.value = '';
    displayUsername.value = '';
    username.dispatchEvent(new Event('input', { bubbles: true }));
    displayUsername.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(updateUser).toHaveBeenCalledWith({ name: 'Trail Hiker' });
  }, 10_000);

  it('rejects short, malformed, and overlong usernames before saving', async () => {
    fixture = createFixture();
    await waitForProfileLoad();
    const username = fixture.nativeElement.querySelector('#username') as HTMLInputElement;
    const submitUsername = async (value: string): Promise<void> => {
      updateUser.mockClear();
      username.value = value;
      username.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      fixture.nativeElement
        .querySelector('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
      expect(updateUser).not.toHaveBeenCalled();
    };
    await submitUsername('ab');
    await submitUsername('space name');
    await submitUsername('x'.repeat(31));
    expect(fixture.nativeElement.textContent).toContain('Username must be 3 to 30 characters.');
  }, 10_000);

  it('requires a display name and bounds the public username', async () => {
    fixture = createFixture();
    await waitForProfileLoad();
    const name = fixture.nativeElement.querySelector('#display-name') as HTMLInputElement;
    name.value = '';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Enter your display name.');

    name.value = 'Trail Hiker';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const publicUsername = fixture.nativeElement.querySelector(
      '#public-username',
    ) as HTMLInputElement;
    publicUsername.value = 'x'.repeat(51);
    publicUsername.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Public username must be 50 characters or fewer.',
    );
  }, 10_000);
});
