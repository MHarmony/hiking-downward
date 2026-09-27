# `@hiking-downward/contact-us`

Standalone contact-support page for HikingDownward frontend applications.

## Usage

Lazy-load `ContactUs` from the application router:

```ts
import type { Route } from '@angular/router';

export const routes: Route[] = [
  {
    path: 'contact',
    loadComponent: async () => import('@hiking-downward/contact-us').then((m) => m.ContactUs),
    title: 'HikingDownward - Contact Us',
  },
];
```

The component provides links to email `contact@hikingdownward.com` for general
support and to the HikingDownward GitHub issue tracker for bug reports. These
destinations are fixed by the component and are not configurable inputs.

The page is responsive, uses Tailwind utility classes with dark-mode variants,
and exposes decorative icons appropriately to assistive technology.

## Development

Run package targets from the workspace root:

```sh
bun nx build @hiking-downward/contact-us
bun nx lint @hiking-downward/contact-us
bun nx typecheck @hiking-downward/contact-us
bun nx typecheck:test @hiking-downward/contact-us
bun nx test @hiking-downward/contact-us
```
