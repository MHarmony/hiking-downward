import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  normalizeEmail,
  passwordsMatch,
  resetToken,
  shouldReportAuthFailure,
} from './password-reset.utils';

describe('password reset utilities', () => {
  it('normalizes arbitrary email input idempotently', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = normalizeEmail(value);
        expect(normalized).toBe(value.trim().toLowerCase());
        expect(normalizeEmail(normalized)).toBe(normalized);
      }),
    );
  }, 10_000);

  it('matches password confirmations exactly', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (password, confirmation) => {
        expect(passwordsMatch(password, confirmation)).toBe(password === confirmation);
        expect(passwordsMatch(password, password)).toBe(true);
      }),
    );
  }, 10_000);

  it('only yields a token when the link has one and no error', () => {
    fc.assert(
      fc.property(fc.option(fc.string()), fc.option(fc.string()), (token, error) => {
        const result = resetToken(token, error);
        expect(result).toBe(error === null && token !== null ? token : '');
      }),
    );
  }, 10_000);

  it('reports exactly the auth failure statuses that are operational failures', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000, max: 10_000 }), (status) => {
        expect(shouldReportAuthFailure(status)).toBe(status === 0 || status >= 500);
      }),
    );
  }, 10_000);
});
