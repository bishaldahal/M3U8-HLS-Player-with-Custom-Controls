# Contributing

Thanks for helping improve the M3U8/HLS/DASH Player. This guide explains how to get set up and how changes get merged.

## Ground rules

- Be respectful. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- For anything larger than a small fix, **open an issue first** so we can agree on the approach.
- Report security problems privately (see [SECURITY.md](SECURITY.md)).

## Setup

```bash
nvm use               # Node version from .nvmrc
npm ci                # also installs the git hooks (husky)
npm run fetch:vendor  # pinned, sha256-verified player libraries -> public/vendor/
npm run build
npm run start:chrome  # or start:firefox
```

The architecture is described in [docs/architecture.md](docs/architecture.md) and the build in [docs/building.md](docs/building.md).

## Making changes

1. Fork the repository and create a branch from `master`, for example `fix/subtitle-color`.
2. Keep each change focused. Add or update tests in `tests/` for logic changes.
3. Make sure these all pass:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run build
   ```
4. Test the build in at least one Chromium browser and Firefox if your change can affect either.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). They drive the automated changelog and version bumps through release-please. A `commit-msg` hook checks the format.

```
feat(player): add A-B loop
fix(options): persist subtitle font family
docs: clarify DRM setup
```

| Type                                                       | Effect on release |
| ---------------------------------------------------------- | ----------------- |
| `fix`                                                      | patch             |
| `feat`                                                     | minor             |
| `feat!` / `BREAKING CHANGE:`                               | major             |
| `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `perf` | no release        |

## Pull requests

- Fill in the PR template and link the issue you're addressing.
- CI must pass: format, lint, typecheck, tests, build and `web-ext lint`.
- PRs are squash-merged, so the PR title must be a valid Conventional Commit.

## Updating vendor libraries

Player libraries are loaded from `public/vendor/`. They are not bundled. To bump one:

1. Change its version in [scripts/vendor.config.ts](scripts/vendor.config.ts).
2. Run `npm run fetch:vendor -- --update` to download it and refresh the hashes in `scripts/vendor.lock.json`.
3. Commit both files and describe the upgrade in the PR.
