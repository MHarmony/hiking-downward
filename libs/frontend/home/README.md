# `@hiking-downward/home`

Placeholder homepage for HikingDownward frontend applications.

## Usage

Lazy-load `Home` at the application root:

```ts
import type { Route } from '@angular/router';

export const routes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: async () => import('@hiking-downward/home').then((m) => m.Home),
    title: 'HikingDownward',
  },
];
```

The page welcomes visitors and links to `/sign-in` and `/sign-up`. It uses
Tailwind utility classes with dark-mode variants.

## Development

Run package targets from the workspace root:

```sh
bun nx build @hiking-downward/home
bun nx lint @hiking-downward/home
bun nx typecheck @hiking-downward/home
bun nx typecheck:test @hiking-downward/home
bun nx test @hiking-downward/home
```
