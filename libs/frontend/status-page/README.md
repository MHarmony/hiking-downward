# `@seahawk/status-page`

Shared status-page components for HikingDownward frontend applications.

## Usage

```ts
export const routes: Routes = [
  {
    path: '401',
    loadComponent: async () => import('@seahawk/status-page').then((m) => m.Unauthorized),
    title: 'HikingDownward - 401',
  },
  {
    path: '403',
    loadComponent: async () => import('@seahawk/status-page').then((m) => m.Forbidden),
    title: 'HikingDownward - 403',
  },
  {
    path: '**',
    loadComponent: async () => import('@seahawk/status-page').then((m) => m.NotFound),
    title: 'HikingDownward - 404',
  },
];
```

The library exposes a shared `StatusPage` presentational component plus the
thin route-driven wrappers `NotFound`, `Unauthorized`, and `Forbidden`. Each
component renders a status code, heading, explanatory message, and the standard
links back home (`/`) and to `/contact`.

`StatusPage` requires `code`, `heading`, and `description` inputs. The
`heading` input controls the visible level-one heading; route `title` values
control the browser document title independently.

Build the library from the workspace root with:

```sh
bun nx build @seahawk/status-page
```
