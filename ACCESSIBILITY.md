# Accessibility

## Standard

HikingDownward targets **full conformance with WCAG 2.2 Level AAA** for its web content and user journeys. This target includes all applicable Level A, AA, and AAA success criteria; AAA does not replace the lower levels.

This document defines the product and release standard. It is not a claim that the current application conforms. Do not describe a page, feature, or release as WCAG 2.2 AAA conformant until it has been evaluated against every applicable criterion and all WCAG conformance requirements.

The authoritative requirements are the [WCAG 2.2 specification](https://www.w3.org/TR/WCAG22/) and the [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/). If this document conflicts with W3C, follow W3C.

## Scope

This standard applies to all user-facing HikingDownward content and complete user journeys, including:

- English (`en-US`) and Spanish (`es`) experiences.
- Public and authenticated pages, forms, dialogs, notifications, and account workflows.
- Responsive layouts and supported input methods, including keyboard, touch, pointer, and assistive technology.
- Media, documents, embedded services, and other content presented as part of a HikingDownward journey.
- Future trail, route, elevation, and map experiences.

A conformance evaluation must assess complete pages and complete processes, not isolated components. It must cover every in-scope locale and state, including validation errors, empty states, loading states, and success or failure results. Accessibility-supported use of web technologies and WCAG's non-interference requirements also apply.

## Product Requirements

### Perceivable content

- Give informative images text alternatives that communicate their purpose. Mark decorative images so assistive technology can ignore them.
- Do not use color, shape, position, sound, or visual styling as the sole way to convey information or instructions.
- Meet AAA text contrast: at least **7:1** for normal text and **4.5:1** for large text, subject only to WCAG's defined exceptions. Check every theme, state, locale, and interactive state.
- Provide a user-controlled visual presentation for blocks of text that meets WCAG 1.4.8. Do not use images of text except for decoration or where the specific presentation is essential.
- Support zoom, text resizing, text spacing, reflow, orientation changes, and high-contrast/forced-color modes without loss of information or functionality.
- Provide the alternatives required by WCAG for all in-scope audio and video. Where prerecorded synchronized media is used, include sign-language interpretation and extended audio description where applicable; provide equivalent alternatives for live audio-only content.

### Operable interaction

- Make every feature operable by keyboard without timing-dependent keystrokes. Do not create keyboard traps; provide a visible, logical focus order and a focus indicator meeting WCAG 2.4.13.
- Ensure focused controls are not obscured by sticky headers, dialogs, banners, or other author-created content.
- Do not make dragging, multi-point gestures, pointer precision, or device motion the only way to complete an action. Provide single-pointer and keyboard alternatives as applicable.
- Use a **44 x 44 CSS pixel** minimum target as the default for pointer controls. Any smaller target must meet a WCAG 2.5.5 exception and be documented during review.
- Avoid flashing content. Keep interaction-triggered motion disableable unless essential, and respect `prefers-reduced-motion`.
- Avoid time limits and unsolicited context changes. If a time limit is essential, meet the applicable WCAG requirements for adjustment, warnings, interruption control, timeout notice, and recovery without data loss.
- Provide ways to identify a user's location within a set of pages and to bypass repeated content.

### Understandable content and flows

- Set the correct page language and mark passages in another language. Keep all user-facing text, validation messages, instructions, and accessible names localized in both supported locales.
- Use clear headings and labels, consistent navigation and identification, and predictable behavior. Changes of context should happen only on user request or be user-controllable.
- Explain unusual terms, abbreviations, and ambiguous pronunciations. Keep instructions and error messages in plain language; when content exceeds WCAG's AAA reading-level threshold, provide a simpler alternative.
- Provide context-sensitive help and keep repeated help mechanisms in a consistent relative order.
- Identify input errors in text and provide correction suggestions when known. For every form submission, provide review, correction, confirmation, or reversal as appropriate to prevent errors.
- Do not require cognitive-function tests during authentication. Support password managers, autofill, and copy/paste; provide accessible authentication methods and alternatives consistent with WCAG 3.3.9.
- Do not require users to re-enter information already provided in the same process unless WCAG permits it.

### Maps and outdoor information

When a feature uses a map or spatial display, the map must not be the only way to discover or use its information. Provide an equivalent keyboard- and screen-reader-accessible list, search, or structured text view. Important route information such as distance, elevation, surface, hazards, and directions must not be conveyed only by color, position, or visual inspection of a map. Any map action that depends on dragging or precise pointer movement needs an alternative.

## Implementation Guidance

- Prefer semantic HTML and native controls. Use ARIA only when native HTML cannot express the required name, role, state, or relationship; keep ARIA state synchronized with behavior.
- Give every control a programmatic name. Associate form labels, instructions, and errors with their fields; expose invalid state and announce dynamically updated status without moving focus unnecessarily.
- Maintain a meaningful heading hierarchy, landmarks, reading order, and focus order. Ensure the DOM order remains meaningful when CSS is unavailable or content reflows.
- Do not remove browser focus indicators without replacing them with a more visible indicator that meets WCAG 2.4.13.
- Ensure layouts remain usable at 200% text zoom and at WCAG 2.2 AA reflow dimensions, including narrow mobile viewports. AAA is the overall target; lower-level criteria remain mandatory.
- Keep content and interaction behavior consistent across locales. Test translated strings for clipping, overflow, and changed reading order.

## Verification and Release Gate

Automated checks are useful but do not establish conformance on their own. Every significant feature and release must combine automated and manual checks.

1. Run the project's lint, typecheck, unit, build, and end-to-end checks.
2. Run an automated accessibility engine such as axe-core against rendered pages and key states. Fix all violations and review any reported needs-review items.
3. Test all functionality with keyboard only, including dialogs, menus, forms, map alternatives, and recovery from errors. Verify focus visibility, order, and that no focused item is obscured.
4. Test representative journeys with screen readers, including NVDA with Firefox or Chrome and VoiceOver with Safari. Include sign-up, sign-in, verification, password reset, two-factor authentication, and account settings.
5. Check both locales at narrow mobile widths, 200% zoom, text-spacing overrides, forced colors/high contrast, and reduced motion. Check text contrast against every relevant background and state.
6. Evaluate applicable AAA media, readability, timing, help, authentication, and focus requirements manually. Record the WCAG success-criterion IDs and evidence for each finding.
7. Before claiming AAA conformance, evaluate all in-scope pages and complete processes against every applicable WCAG 2.2 A, AA, and AAA success criterion, including third-party content and WCAG conformance requirements. A passing Lighthouse or axe score alone is not sufficient.

Any applicable failure blocks an AAA conformance claim. Track barriers with the affected page or flow, locale, WCAG criterion, reproduction steps, impact, and an accessible alternative or fix. A temporary exception is not conformance; document its owner and resolution plan, and do not claim AAA while it remains unresolved.

## Reporting

Report accessibility barriers through the channels in [SUPPORT.md](SUPPORT.md). Include the page or flow, locale, steps to reproduce, assistive technology and browser when relevant, and the affected WCAG criterion if known. Do not include passwords, verification links, or other private account information.

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WCAG-EM: Website Accessibility Conformance Evaluation Methodology](https://www.w3.org/TR/WCAG-EM/)
