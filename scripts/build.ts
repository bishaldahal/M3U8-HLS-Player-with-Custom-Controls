/**
 * Builds the extension for one or more browsers into dist/<browser>.
 *
 *   tsx scripts/build.ts           # chrome + firefox
 *   tsx scripts/build.ts firefox   # single target
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type InlineConfig } from 'vite';
import { buildManifest, type Browser } from '../src/manifest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS: Browser[] = ['chrome', 'firefox'];

const requested = process.argv
  .slice(2)
  .filter((a): a is Browser => (BROWSERS as string[]).includes(a));
const browsers = requested.length > 0 ? requested : BROWSERS;

/** Background + content scripts are emitted as self-contained IIFEs (no imports). */
function scriptConfig(outDir: string, entry: string, name: string): InlineConfig {
  return {
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    build: {
      outDir,
      emptyOutDir: false,
      target: 'es2022',
      lib: {
        entry: resolve(ROOT, entry),
        formats: ['iife'],
        name,
        fileName: () => `js/${name}.js`,
      },
    },
  };
}

async function buildFor(browser: Browser, version: string): Promise<void> {
  const outDir = join(ROOT, 'dist', browser);
  process.env.TARGET = browser;

  await build({ configFile: join(ROOT, 'vite.config.ts'), logLevel: 'warn' });
  await build(scriptConfig(outDir, 'src/content/index.ts', 'content'));
  await build(scriptConfig(outDir, 'src/background/index.ts', 'background'));

  const manifest = buildManifest(browser, version);
  await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✓ ${browser} → ${outDir}`);
}

async function main(): Promise<void> {
  if (!existsSync(join(ROOT, 'public', 'vendor'))) {
    console.error('public/vendor is missing. Run `npm run fetch:vendor` first.');
    process.exit(1);
  }
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { version: string };
  for (const browser of browsers) await buildFor(browser, pkg.version);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
