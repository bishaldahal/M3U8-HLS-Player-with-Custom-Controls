import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = resolve(import.meta.dirname, 'src');
const target = process.env.TARGET === 'firefox' ? 'firefox' : 'chrome';

/**
 * Builds the extension pages (player, popup, options, shortcuts).
 * The background and content scripts are built separately as single-file IIFEs by
 * scripts/build.ts, because MV3 content scripts cannot use ES module imports.
 *
 * Vendor web components under /vendor are served from public/ and never bundled.
 */
export default defineConfig({
  root,
  publicDir: resolve(import.meta.dirname, 'public'),
  base: '/',
  build: {
    outDir: resolve(import.meta.dirname, 'dist', target),
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      input: {
        player: resolve(root, 'player.html'),
        popup: resolve(root, 'popup.html'),
        options: resolve(root, 'options.html'),
        shortcuts: resolve(root, 'shortcuts.html'),
      },
      external: [/^\/vendor\//],
    },
  },
});
