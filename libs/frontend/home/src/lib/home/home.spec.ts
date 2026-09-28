import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Home } from './home';

describe('Home', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    });
  });

  it('welcomes visitors with a single top-level heading', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const headings = fixture.nativeElement.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent.trim()).toBe('Welcome to HikingDownward');
    expect(fixture.nativeElement.querySelector('img').getAttribute('alt')).toBe(
      'Stick figure hiking toward a mountain',
    );
  }, 10_000);

  it('links to sign in and sign up', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    const links = [...fixture.nativeElement.querySelectorAll('a')] as HTMLAnchorElement[];
    expect(
      links.map((link) => [(link.textContent ?? '').trim(), link.getAttribute('href')]),
    ).toEqual([
      ['Sign in', '/sign-in'],
      ['Create an account →', '/sign-up'],
    ]);
  }, 10_000);
});
