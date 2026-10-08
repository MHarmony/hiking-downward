import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './account-settings.utils';

describe('authErrorMessage', () => {
  it('returns a server-provided message', () => {
    expect(authErrorMessage({ message: 'Password is incorrect.' }, 'Request failed.')).toBe(
      'Password is incorrect.',
    );
  }, 10_000);

  it('uses the fallback for absent or empty messages', () => {
    expect(authErrorMessage(null, 'Request failed.')).toBe('Request failed.');
    expect(authErrorMessage({}, 'Request failed.')).toBe('Request failed.');
    expect(authErrorMessage({ message: '   ' }, 'Request failed.')).toBe('Request failed.');
  }, 10_000);
});
