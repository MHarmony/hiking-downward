import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ContactUs } from './contact-us';

describe('ContactUs', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactUs],
    }).compileComponents();
  });

  it('renders the contact support overview with both support channels', () => {
    const fixture = TestBed.createComponent(ContactUs);
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const heading = nativeElement.querySelector('h1');
    const intro = nativeElement.querySelector('p');
    const sectionHeadings = Array.from(nativeElement.querySelectorAll('h2'));
    const emailLink = nativeElement.querySelector('a[href="mailto:contact@hikingdownward.com"]');
    const issueLink = nativeElement.querySelector(
      'a[href="https://github.com/MHarmony/hiking-downward/issues"]',
    );
    const svgIcons = nativeElement.querySelectorAll('svg');

    expect(fixture.componentInstance).toBeInstanceOf(ContactUs);
    expect(heading).not.toBeNull();
    expect(intro).not.toBeNull();
    expect(emailLink).not.toBeNull();
    expect(issueLink).not.toBeNull();

    if (!heading || !intro || !emailLink || !issueLink) {
      throw new Error('Expected the contact support page to render its required content');
    }

    const sectionTexts = sectionHeadings.map((node) => (node.textContent ?? '').trim());

    expect(heading.textContent).toContain('Contact support');
    expect(intro.textContent).toContain('Have a question or need assistance?');
    expect(sectionTexts).toEqual(['General support', 'Bug reports']);
    expect(emailLink.textContent).toContain('Email support');
    expect(issueLink.textContent).toContain('Report a bug');
    expect(nativeElement.textContent).toContain('Send us an email for any general inquiries.');
    expect(nativeElement.textContent).toContain(
      'Report any bugs or issues you encounter while using our platform.',
    );
    expect(svgIcons).toHaveLength(2);

    if (svgIcons.length < 2) {
      throw new Error('Expected both support cards to render an icon');
    }

    const firstIcon = svgIcons[0];
    const secondIcon = svgIcons[1];

    if (!firstIcon || !secondIcon) {
      throw new Error('Expected both support icons to be present');
    }

    expect(firstIcon.getAttribute('aria-hidden')).toBe('true');
    expect(secondIcon.getAttribute('aria-hidden')).toBe('true');
  }, 10_000);
});
