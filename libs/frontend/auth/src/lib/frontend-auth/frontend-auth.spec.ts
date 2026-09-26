import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AUTH_BASE_URL, FrontendAuth } from './frontend-auth';

describe('FrontendAuth', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_BASE_URL, useValue: 'https://auth.example.test' }],
    });
  });

  it('creates the configured Better Auth client', () => {
    const service = TestBed.inject(FrontendAuth);

    expect(service).toBeInstanceOf(FrontendAuth);
    expect(service.authClient).toBeDefined();
  }, 10_000);

  it('provides the local default base URL when no override is configured', () => {
    TestBed.resetTestingModule();

    expect(TestBed.inject(AUTH_BASE_URL)).toBe('http://localhost:3000');
  }, 10_000);
});
