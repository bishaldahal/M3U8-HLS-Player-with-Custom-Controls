import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '..', 'icons', 'icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

const outputFolder = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
    const outPath = path.join(outputFolder, `icon${size}.png`);
    sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outPath)
        .then(() => console.log(`Generated: ${outPath}`))
        .catch(err => console.error(err));
});
