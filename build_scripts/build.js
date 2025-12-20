/**
 * Build Script - Copy source files from npm/ to js/
 * This ensures the extension uses the latest source code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Files to copy from npm/ to js/
const FILES_TO_COPY = [
  'background.js',
  'content.js',
  'settings.js',
  'options.js',
  'popup.js',
  'shortcuts.js',
  'utils.js'
];

console.log('📦 Copying source files from npm/ to js/...\n');

let successCount = 0;
let errorCount = 0;

FILES_TO_COPY.forEach(file => {
  try {
    const sourcePath = path.join(rootDir, 'npm', file);
    const destPath = path.join(rootDir, 'js', file);
    
    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Warning: ${file} not found in npm/ folder`);
      return;
    }
    
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied ${file}`);
    successCount++;
  } catch (error) {
    console.error(`❌ Error copying ${file}:`, error.message);
    errorCount++;
  }
});

console.log(`\n📊 Summary: ${successCount} files copied, ${errorCount} errors`);

if (errorCount > 0) {
  process.exit(1);
}
