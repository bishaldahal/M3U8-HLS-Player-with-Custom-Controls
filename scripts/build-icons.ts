/** Regenerates the PNG toolbar/store icons from public/icons/icon.svg. */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ICONS = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'public', 'icons');
const SIZES = [16, 32, 48, 128];

const svg = await readFile(join(ICONS, 'icon.svg'));
await Promise.all(
  SIZES.map(async (size) => {
    const out = join(ICONS, `icon${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`✓ ${out}`);
  }),
);
