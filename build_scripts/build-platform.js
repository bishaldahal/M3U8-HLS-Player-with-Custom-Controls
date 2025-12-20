/**
 * Platform-specific Build Script
 * Creates builds for Chrome and Firefox with appropriate manifests
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Get platform from command line args (chrome or firefox)
const platform = process.argv[2] || 'chrome';

if (!['chrome', 'firefox'].includes(platform)) {
  console.error('❌ Invalid platform. Use "chrome" or "firefox"');
  process.exit(1);
}

console.log(`\n🔨 Building for ${platform.toUpperCase()}...\n`);

// Copy the appropriate manifest file
const manifestSource = path.join(rootDir, `manifest-${platform}.json`);
const manifestDest = path.join(rootDir, 'manifest.json');

try {
  fs.copyFileSync(manifestSource, manifestDest);
  console.log(`✅ Copied manifest-${platform}.json to manifest.json`);
} catch (error) {
  console.error(`❌ Error copying manifest: ${error.message}`);
  process.exit(1);
}

// Create ZIP file
const date = new Date();
const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
const outputDir = path.join(rootDir, 'build');
const platformName = platform === 'chrome' ? 'Chromium' : 'Firefox';
const outputFile = path.join(outputDir, `M3U8-HLS-Player.${platformName}.${formattedDate}.zip`);

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Delete old zip files for this platform
const oldZipFiles = fs.readdirSync(outputDir).filter(file => 
  file.includes(platformName) && file.endsWith('.zip')
);
for (const file of oldZipFiles) {
  fs.unlinkSync(path.join(outputDir, file));
  console.log(`🗑️  Deleted old ${platformName} build: ${file}`);
}

// Create archive
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`\n✨ Successfully created ${platformName} build:`);
  console.log(`   📦 ${outputFile}`);
  console.log(`   📊 Size: ${(archive.pointer() / 1024).toFixed(2)} KB\n`);
});

archive.on('error', (err) => {
  console.error('❌ Archive error:', err);
  process.exit(1);
});

archive.pipe(output);

// Add files to archive
archive.glob('**', {
  cwd: rootDir,
  ignore: [
    'node_modules/**',
    '.vscode/**',
    'npm/**',
    'package.json',
    'package-lock.json',
    'README.md',
    'extension.zip',
    '.git/**',
    '.gitignore',
    'build_scripts/**',
    'build/**',
    '.github/**',
    '.gitattributes',
    'LICENSE',
    '.DS_Store',
    'manifest-chrome.json',
    'manifest-firefox.json'
  ]
});

archive.finalize();
