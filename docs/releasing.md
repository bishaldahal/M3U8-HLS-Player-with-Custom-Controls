# Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please) and [.github/workflows/release.yml](../.github/workflows/release.yml).

1. Merge PRs to `master` with Conventional Commit titles.
2. release-please opens or updates a **release PR** that bumps `package.json`, `.release-please-manifest.json` and `CHANGELOG.md`.
3. Merging the release PR creates the tag and GitHub release. The workflow then:
   - builds and zips both targets and attaches the zips to the release
   - runs the `publish` job for Chrome, Edge and Firefox in the `store-publish` environment

## One-time setup

1. In **Settings → Actions → General**, allow GitHub Actions to create pull requests.
2. Create an environment named **`store-publish`**. Adding required reviewers is recommended, so every store upload needs manual approval.
3. Add these secrets to the environment:

| Secret                                                                                    | Store                                                                                                           |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` | [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)                                    |
| `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`                                       | [Edge Add-ons API](https://learn.microsoft.com/microsoft-edge/extensions-chromium/publish/api/using-addons-api) |
| `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`                                                        | [AMO API keys](https://addons.mozilla.org/developers/addon/api/key/)                                            |

If a store's secrets are missing, its matrix job fails and the other stores still publish.

## Manual publish

```bash
npm run build && npm run zip
CHROME_EXTENSION_ID=... npm run publish:chrome
```
