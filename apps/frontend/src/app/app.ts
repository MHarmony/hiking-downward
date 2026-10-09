import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** A locale supported by the frontend's localized production builds. */
export type FrontendLocale = 'en' | 'es';

/**
 * Checks whether a pathname belongs to one of the localized production builds.
 *
 * @param pathname - The URL pathname to inspect.
 * @returns `true` when the pathname begins with a supported locale prefix.
 */
export function hasLocalePrefix(pathname: string): boolean {
  return /^\/(?:en|es)(?:\/|$)/u.test(pathname);
}

/**
 * Builds a localized URL while preserving its path, query string, and fragment.
 *
 * @param pathname - The current URL pathname.
 * @param search - The current URL query string, including its leading `?` when present.
 * @param hash - The current URL fragment, including its leading `#` when present.
 * @param locale - The locale to apply to the URL.
 * @returns The localized URL with the supplied route state preserved.
 */
export function localizedHref(
  pathname: string,
  search: string,
  hash: string,
  locale: FrontendLocale,
): string {
  const pathWithoutLocale = pathname.replace(/^\/(?:en|es)(?=\/|$)/u, '') || '/';
  return `/${locale}${pathWithoutLocale}${search}${hash}`;
}

@Component({
  imports: [RouterOutlet],
  selector: 'hiking-downward-root',
  styleUrl: './app.css',
  templateUrl: './app.ng.html',
})
/** Root Angular component for the HikingDownward application shell. */
/* v8 ignore start */
export class App {
  /* v8 ignore stop */
  readonly #document = inject(DOCUMENT);
  /** Whether the current URL has a supported locale prefix and should show the locale switcher. */
  private readonly showLocaleSwitcher = hasLocalePrefix(this.#document.location.pathname);

  /**
   * Builds a URL for the requested locale using the current route state.
   *
   * @param locale - The locale to use in the URL.
   * @returns The localized URL.
   */
  private localeHref(locale: FrontendLocale): string {
    const { pathname, search, hash } = this.#document.location;
    return localizedHref(pathname, search, hash, locale);
  }
}
