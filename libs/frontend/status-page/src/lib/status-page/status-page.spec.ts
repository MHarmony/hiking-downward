import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { StatusPage } from '../status-page/status-page';

describe('StatusPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders explicit status content', () => {
    const fixture = TestBed.createComponent(StatusPage);
    fixture.componentRef.setInput('code', '404');
    fixture.componentRef.setInput('heading', 'Page not found');
    fixture.componentRef.setInput(
      'description',
      "Sorry, we couldn't find the page you're looking for.",
    );
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const heading = nativeElement.querySelector('h1');

    expect(nativeElement.textContent).toContain('404');
    expect(nativeElement.textContent).toContain('Page not found');
    expect(nativeElement.textContent).toContain(
      "Sorry, we couldn't find the page you're looking for.",
    );
    expect(heading).not.toBeNull();
  }, 10_000);

  it('supports custom status content and navigation links', () => {
    const fixture = TestBed.createComponent(StatusPage);
    fixture.componentRef.setInput('code', '403');
    fixture.componentRef.setInput('heading', 'Forbidden');
    fixture.componentRef.setInput('description', 'You do not have permission to view this page.');
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const heading = nativeElement.querySelector('h1');
    const homeLink = nativeElement.querySelector('a[href="/"]');
    const contactLink = nativeElement.querySelector('a[href="/contact"]');

    expect(nativeElement.textContent).toContain('403');
    expect(heading).not.toBeNull();
    expect(homeLink).not.toBeNull();
    expect(contactLink).not.toBeNull();

    if (heading === null || homeLink === null || contactLink === null) {
      throw new Error('Expected the status page to render heading and navigation links');
    }

    expect(heading.textContent).toContain('Forbidden');
    expect(homeLink.textContent).toContain('Go back home');
    expect(contactLink.textContent).toContain('Contact support');
    expect(nativeElement.textContent).toContain('You do not have permission to view this page.');
  }, 10_000);
});
