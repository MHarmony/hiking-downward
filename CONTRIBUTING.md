# Contributing to HikingDownward

Thank you for contributing to HikingDownward. This guide describes the development workflow for the repository. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Before You Start

For security vulnerabilities, do not open a public issue. Follow the private reporting process in [SECURITY.md](SECURITY.md).

For bugs, feature ideas, and questions that are not security-sensitive, search existing [GitHub issues](https://github.com/MHarmony/hiking-downward/issues) first. Open a new issue when no existing report applies, including enough context for someone else to reproduce or evaluate it.

## Development Requirements

Use the repository's supported toolchain:

- [Bun canary](https://bun.com/docs/installation#canary-builds) with built-in `bun lint`
  (verified with `1.4.4-canary.1+57fe60250`; stable `1.4.4` does not include it)
- [Node.js](https://nodejs.org/) `26.12.0`
- [Git](https://git-scm.com/)
- [PostgreSQL](https://www.postgresql.org/) for API and database work

The repository pins dependency versions and uses Bun's exact-install mode. From a fresh checkout:

```sh
bun install
bun playwright install --with-deps
```

The Playwright browser installation is required before running end-to-end tests. On a local machine, `bun playwright install` may be sufficient when system browser dependencies are already installed.

## Repository Structure

- `apps/frontend/` contains the Angular application.
- `apps/frontend-e2e/` contains Playwright end-to-end tests.
- `apps/api/` contains the Elysia application.
- `apps/api-e2e/` contains Playwright end-to-end tests.
- `coverage/` and `dist/` contain generated output and should not be committed.
- Nx manages project targets and task orchestration.

## Local Development

Start the frontend development server with:

```sh
bun nx serve @hiking-downward/frontend
```

The default local URL is `http://localhost:4200/`.

Start the API development server with:

```sh
bun nx serve @hiking-downward/api
```

The default local URL is `http://localhost:3000/`.

Before starting the API, configure PostgreSQL and the authentication services
described in the [README's Getting started section](README.md#getting-started).

When changing the database schema, generate a migration and apply migrations
with:

```sh
bun run db:generate
bun run db:migrate
```

## Formatting

Use Bun's built-in formatter (requires the Bun canary build listed under
[Development Requirements](#development-requirements)):

```sh
bun run format
bun run format:check
```

To format only the files you changed, pass their paths to `bun run format`.
For example:

```sh
bun run format libs/api/database/drizzle.config.mts
bun run format:check libs/api/database/drizzle.config.mts
```

Bun reads the formatter settings from the `[fmt]` section of
[bunfig.toml](bunfig.toml). It preserves the previous formatter options,
including Angular template parsing, Tailwind class sorting, and JSDoc
formatting; the `oxfmt` package is not needed. Run `bun fmt --doctor` to inspect
formatter configuration and native support.

Bun has no formatter language server. Workspace VS Code settings no longer
configure Oxc and disable format-on-save; use the commands above instead.

Nx's Angular application generator uses `formatter: "none"` so it does not
install another formatter. Format generated files with Bun afterward.

The migration does not reformat existing files or add formatting enforcement
to CI or hooks. A repository-wide check may report existing formatting
differences; keep formatting changes focused on the files you touch.

## Linting

Run all Nx lint targets, including the library package dependency checks:

```sh
bun run lint:all
```

The script is deliberately named `lint:all`, not `lint`: a `lint` script would
shadow Bun's built-in command. For a focused check, use Nx or the native CLI:

```sh
bun nx run @hiking-downward/database:lint
bun lint libs/api/database
bun lint --fix libs/api/database
bun lint --doctor
```

Bun reads the lint rules and overrides in [bunfig.toml](bunfig.toml), including
type-aware rules and type checking. Neither `oxlint` nor `oxlint-tsgolint` is
installed.
Playwright, Tailwind, Drizzle, and Nx module-boundary rules remain configured.
The previous native JSDoc rules run through `eslint-plugin-jsdoc` under the
`jsdoc` prefix because Bun does not implement native `jsdoc/*` rules.

ESLint remains installed for Tailwind's plugin and the separate
`@nx/dependency-checks` package manifest checks. The Nx library lint targets run
those manifest checks after Bun; a direct `bun lint` does not replace them.
Nx lint caches include the lint configuration, project metadata, lockfile,
TypeScript configuration, and Bun revision.
Agent skill examples and scripts are excluded from application linting, as
they were outside the previous Nx lint targets. Use Nx for module-boundary
checks so its project graph is available; the rule needs that graph even when
invoked through the native CLI.

Bun has no lint language server, so use the CLI or Nx targets instead of the
Oxc editor integration. Angular generators use `linter: "none"` to avoid
reinstalling Oxlint; add a `lint` target that runs `bun lint --no-script .` with
the generated project's directory as `cwd`. For libraries, also run ESLint
against `package.json` with `eslint.manifest.config.mts` (from a library
directory, pass `--config ../../../eslint.manifest.config.mts`). The
manifest-only ESLint configuration uses a non-default filename so it does not
change Bun's parser or source-file discovery.

CI uses a fresh Bun canary build because the stable `1.4.4` release has no
native linter. Verify `bun lint --help` after installing or upgrading Bun.

## Validate Changes

Run the checks relevant to your change before opening a pull request:

```sh
bun run typecheck
bun run lint:all
bun run test
bun run build
bun run e2e
```

The end-to-end command starts the frontend and api servers through Nx. If you are working on browser behavior, run the complete e2e suite rather than relying only on unit tests.

When a command fails, fix the underlying issue rather than weakening a lint rule, coverage threshold, or test. Include any known environmental limitation in the pull request description.

## Making Changes

1. Create a focused branch from `main`.
2. Keep changes small and cohesive. Avoid unrelated formatting or dependency updates.
3. Add or update tests for behavior changes.
4. Preserve existing Angular, Elysia, Nx, TypeScript, CSS, and Playwright patterns.
5. Keep public-facing text, accessibility behavior, and responsive layouts in mind for frontend changes.
6. Update documentation when commands, behavior, or contributor-facing workflows change.
7. Check the diff before committing and remove generated files, secrets, and debug output.

Do not commit credentials, tokens, private user data, local environment files, or generated build artifacts.

## Commit Messages

Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) format and are checked by commitlint. Use a lowercase type and a concise subject, for example:

```text
feat: add trail elevation summary
fix: preserve route title on refresh

```

Common types include `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, and `chore`. Use a scope when it adds useful context, such as `fix(frontend): ...`.

## Releases

Nx Release is configured for conventional versioning, changelog generation, signed release commits, and signed tags. Releases are currently performed manually by maintainers; there is no automated release workflow or package publishing.

Before creating a release, ensure your local GPG signing key is configured and available to Git:

```sh
git config --get user.signingkey
git config --get commit.gpgsign
git config --get tag.gpgSign
```

Maintainers should review the generated version and changelog, verify the signed commit and tag locally, and push them only after the normal validation tasks pass. Do not add private signing keys or passphrases to the repository or GitHub Actions secrets unless a separately reviewed release automation design is approved.

## Pull Requests

Open pull requests against `main` using the repository's GitHub template when one is available. A good pull request should:

- Explain what changed and why.
- Link related issues or discussions.
- Describe user-visible behavior and any migration or configuration impact.
- Include tests added or updated.
- Report the validation commands that passed, including any checks you could not run.
- Include screenshots or short recordings for meaningful UI changes.
- Call out security, privacy, accessibility, or performance considerations when relevant.

Keep pull requests reviewable. Separate unrelated fixes into separate pull requests, and respond to review feedback with follow-up commits rather than rewriting history after review has started unless the maintainers request otherwise.

## Review Expectations

Reviewers will look for correctness, maintainability, accessible behavior, test coverage, security implications, and consistency with the existing architecture. Contributors are expected to respond respectfully and to keep discussions technical and constructive, as described in the [Code of Conduct](CODE_OF_CONDUCT.md).

Maintainers may ask for changes, additional tests, or a narrower scope before merging. All required CI checks must pass before a pull request is merged.

## License

By contributing to this repository, you agree that your contributions are provided under the repository's [MIT License](LICENSE.md).
