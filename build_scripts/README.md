# Build Scripts

## Development

```bash
npm run build              # Build source files
npm run build:chrome       # Build Chrome/Edge version
npm run build:firefox      # Build Firefox version
npm run build:all          # Build both
```

## Publishing

```bash
npm run publish:chrome     # Publish to Edge store
npm run publish:firefox    # Publish to Firefox add-ons
```

Requires environment variables:
- Chrome/Edge: `CLIENT_ID`, `CLIENT_SECRET`, `PRODUCT_ID`, `ACCESS_TOKEN_URL`
- Firefox: `WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET`

## Why Platform-Specific Builds?

Firefox doesn't support:
- `declarativeContent` permission
- ES modules in service workers (`type: "module"`)

The build system automatically uses the correct manifest for each platform.
