import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { App, hasLocalePrefix, localizedHref } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app).toBeTruthy();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('nav[aria-label="Language"]')).toBeNull();
  }, 10_000);

  it('renders locale links when localized builds are available', () => {
    const fixture = TestBed.createComponent(App);
    Object.defineProperty(fixture.componentInstance, 'showLocaleSwitcher', { value: true });
    fixture.detectChanges();

    const englishLink = fixture.nativeElement.querySelector(
      'nav a[hreflang="en-US"]',
    ) as HTMLAnchorElement;
    const spanishLink = fixture.nativeElement.querySelector(
      'nav a[hreflang="es"]',
    ) as HTMLAnchorElement;

    expect(englishLink.getAttribute('href')).toBe('/en/');
    expect(spanishLink.getAttribute('href')).toBe('/es/');
  }, 10_000);

  it('switches locale prefixes while preserving the current route and URL state', () => {
    expect(localizedHref('/en/settings/security', '?from=account', '#sessions', 'es')).toBe(
      '/es/settings/security?from=account#sessions',
    );
    expect(localizedHref('/es', '', '', 'en')).toBe('/en/');
    expect(localizedHref('/sign-in', '', '', 'es')).toBe('/es/sign-in');
  }, 10_000);

  it('recognizes only the supported localized URL prefixes', () => {
    expect(hasLocalePrefix('/')).toBe(false);
    expect(hasLocalePrefix('/en/')).toBe(true);
    expect(hasLocalePrefix('/es/settings')).toBe(true);
    expect(hasLocalePrefix('/fr/')).toBe(false);
  }, 10_000);
});
