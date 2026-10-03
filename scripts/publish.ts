/**
 * Uploads a built package to a browser store. Credentials come from environment variables
 * (GitHub Actions secrets in CI). Run `npm run build && npm run zip` first.
 *
 *   tsx scripts/publish.ts chrome | edge | firefox
 *
 * Release notes for Edge are read from RELEASE_NOTES (falls back to a generic message).
 */
import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Store = 'chrome' | 'edge' | 'firefox';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACTS = join(ROOT, 'artifacts');

function requireEnv(...names: string[]): Record<string, string> {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return Object.fromEntries(names.map((n) => [n, process.env[n] as string]));
}

async function artifact(kind: 'chrome' | 'firefox' | 'source'): Promise<string> {
  const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  const file = join(ARTIFACTS, `m3u8-hls-player-${kind}-v${version}.zip`);
  if (!existsSync(file)) throw new Error(`${file} not found. Run \`npm run zip\` first.`);
  return file;
}

async function publishChrome(): Promise<void> {
  const env = requireEnv(
    'CHROME_EXTENSION_ID',
    'CHROME_CLIENT_ID',
    'CHROME_CLIENT_SECRET',
    'CHROME_REFRESH_TOKEN',
  );
  const { default: chromeWebstoreUpload } = await import('chrome-webstore-upload');
  const store = chromeWebstoreUpload({
    extensionId: env.CHROME_EXTENSION_ID,
    clientId: env.CHROME_CLIENT_ID,
    clientSecret: env.CHROME_CLIENT_SECRET,
    refreshToken: env.CHROME_REFRESH_TOKEN,
  });
  await store.uploadExisting(createReadStream(await artifact('chrome')));
  await store.publish();
}

async function publishEdge(): Promise<void> {
  const env = requireEnv('PRODUCT_ID', 'CLIENT_ID', 'EDGE_API_KEY');
  const { EdgeAddonsAPI } = await import('@plasmohq/edge-addons-api');
  const client = new EdgeAddonsAPI({
    productId: env.PRODUCT_ID,
    clientId: env.CLIENT_ID,
    apiKey: env.EDGE_API_KEY,
  });
  await client.submit({
    filePath: await artifact('chrome'),
    notes: process.env.RELEASE_NOTES || 'Bug fixes and improvements.',
  });
}

async function publishFirefox(): Promise<void> {
  const env = requireEnv('WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET');
  const { default: webExt } = await import('web-ext');
  await webExt.cmd.sign({
    sourceDir: join(ROOT, 'dist', 'firefox'),
    artifactsDir: ARTIFACTS,
    apiKey: env.WEB_EXT_API_KEY,
    apiSecret: env.WEB_EXT_API_SECRET,
    amoBaseUrl: 'https://addons.mozilla.org/api/v5/',
    channel: 'listed',
    uploadSourceCode: await artifact('source'),
  });
}

const PUBLISHERS: Record<Store, () => Promise<void>> = {
  chrome: publishChrome,
  edge: publishEdge,
  firefox: publishFirefox,
};

const store = process.argv[2] as Store | undefined;
if (!store || !(store in PUBLISHERS)) {
  console.error(`Usage: tsx scripts/publish.ts <${Object.keys(PUBLISHERS).join('|')}>`);
  process.exit(1);
}

PUBLISHERS[store]()
  .then(() => console.log(`✓ Published to ${store}`))
  .catch((error: unknown) => {
    console.error(`✗ ${store}:`, error instanceof Error ? error.message : error);
    // got's HTTPError keeps the store's explanation in the response body.
    const response = (error as { response?: { url?: string; body?: unknown } }).response;
    if (response) console.error(`  ${response.url ?? ''}\n  ${String(response.body ?? '')}`);
    process.exit(1);
  });
