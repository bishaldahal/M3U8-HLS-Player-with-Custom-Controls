/**
 * Third-party ES modules shipped with the extension.
 *
 * These are fetched from jsDelivr's `+esm` endpoint (pre-bundled ESM) and written to
 * `public/vendor/`. Bump a version here, then run `npm run fetch:vendor -- --update`
 * to refresh `scripts/vendor.lock.json`.
 */
export interface VendorPackage {
  /** npm package name */
  name: string;
  /** exact version (no ranges) */
  version: string;
  /** output filename in public/vendor */
  file: string;
}

export const VENDOR_PACKAGES: VendorPackage[] = [
  { name: 'hls.js', version: '1.6.15', file: 'hls.js' },
  { name: 'dashjs', version: '5.1.1', file: 'dashjs.js' },
  { name: 'custom-media-element', version: '1.4.5', file: 'custom-media-element.js' },
  { name: 'media-tracks', version: '0.3.4', file: 'media-tracks.js' },
  { name: 'media-chrome', version: '3.1.1', file: 'media-chrome.js' },
  { name: 'hls-video-element', version: '1.5.10', file: 'hls-video-element.js' },
  { name: 'dash-video-element', version: '0.3.1', file: 'dash-video-element.js' },
];

export const vendorUrl = (pkg: VendorPackage) =>
  `https://cdn.jsdelivr.net/npm/${pkg.name}@${pkg.version}/+esm`;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rewrites bare / jsDelivr-relative specifiers (e.g. `"/npm/hls.js@1.6.15/+esm"`, `"dashjs"`)
 * to the local `/vendor/<file>` copies, for both static and dynamic imports.
 */
export function rewriteImports(source: string, packages = VENDOR_PACKAGES): string {
  let out = source;
  for (const pkg of packages) {
    const spec = `(?:/npm/${escapeRegExp(pkg.name)}(?:@[^"']*)?|${escapeRegExp(pkg.name)})`;
    out = out
      .replace(new RegExp(`from\\s*["']${spec}["']`, 'g'), `from"/vendor/${pkg.file}"`)
      .replace(
        new RegExp(`import\\(\\s*["']${spec}["']\\s*\\)`, 'g'),
        `import("/vendor/${pkg.file}")`,
      );
  }
  return out;
}
