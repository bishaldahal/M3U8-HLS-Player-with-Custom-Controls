/**
 * Packages dist/<browser> into artifacts/<name>-<browser>-v<version>.zip, plus a
 * source archive (required by addons.mozilla.org for reviewing built code).
 */
import archiver from 'archiver';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACTS = join(ROOT, 'artifacts');
const NAME = 'm3u8-hls-player';

const SOURCE_FILES = [
  'src/**',
  'public/icons/**',
  'scripts/**',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  '.nvmrc',
  'README.md',
  'docs/**',
];

function zip(output: string, add: (archive: archiver.Archiver) => void): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const stream = createWriteStream(output);
    const archive = archiver('zip', { zlib: { level: 9 } });
    stream.on('close', () => {
      console.log(`✓ ${output} (${(archive.pointer() / 1024).toFixed(0)} KB)`);
      resolvePromise();
    });
    archive.on('error', reject);
    archive.on('warning', reject);
    archive.pipe(stream);
    add(archive);
    void archive.finalize();
  });
}

async function main(): Promise<void> {
  const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  await mkdir(ARTIFACTS, { recursive: true });

  for (const browser of ['chrome', 'firefox']) {
    const dir = join(ROOT, 'dist', browser);
    if (!existsSync(dir)) throw new Error(`${dir} not found. Run \`npm run build\` first.`);
    await zip(join(ARTIFACTS, `${NAME}-${browser}-v${version}.zip`), (a) =>
      a.directory(dir, false),
    );
  }

  await zip(join(ARTIFACTS, `${NAME}-source-v${version}.zip`), (a) => {
    for (const pattern of SOURCE_FILES) a.glob(pattern, { cwd: ROOT, dot: false });
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
