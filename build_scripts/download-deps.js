/**
 * Download dependencies from jsDelivr CDN
 * These are ES module bundles that will be saved locally for the extension
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = join(__dirname, '..', 'js', 'vendor');

// CDN URLs for dependencies
const DEPENDENCIES = {
  'hls.js': 'https://cdn.jsdelivr.net/npm/hls.js/+esm',
  'custom-media-element.js': 'https://cdn.jsdelivr.net/npm/custom-media-element/+esm',
  'media-chrome.js': 'https://cdn.jsdelivr.net/npm/media-chrome@3.1.1/+esm', // Pinned to 3.1.1 for compatibility
  'hls-video-element.js': 'https://cdn.jsdelivr.net/npm/hls-video-element/+esm',
  'media-tracks.js': 'https://cdn.jsdelivr.net/npm/media-tracks/+esm',
};

// Import path rewrites - map CDN imports to local paths
const IMPORT_REWRITES = [
  // hls.js imports
  { from: /from\s*["'](\/npm\/hls\.js@[^"']+|hls\.js)["']/g, to: 'from"/js/vendor/hls.js"' },
  // custom-media-element imports
  { from: /from\s*["'](\/npm\/custom-media-element@?[^"']*|custom-media-element)["']/g, to: 'from"/js/vendor/custom-media-element.js"' },
  // media-chrome imports
  { from: /from\s*["'](\/npm\/media-chrome@?[^"']*|media-chrome)["']/g, to: 'from"/js/vendor/media-chrome.js"' },
  // media-tracks imports
  { from: /from\s*["'](\/npm\/media-tracks@?[^"']*|media-tracks)["']/g, to: 'from"/js/vendor/media-tracks.js"' },
  // hls-video-element imports
  { from: /from\s*["'](\/npm\/hls-video-element@?[^"']*|hls-video-element)["']/g, to: 'from"/js/vendor/hls-video-element.js"' },
];

async function downloadFile(url, filename) {
  console.log(`📥 Downloading ${filename}...`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    let content = await response.text();
    
    // Rewrite import paths to use local vendor files
    for (const rewrite of IMPORT_REWRITES) {
      content = content.replace(rewrite.from, rewrite.to);
    }
    
    const filePath = join(VENDOR_DIR, filename);
    await writeFile(filePath, content, 'utf-8');
    
    console.log(`✅ Saved ${filename} (${(content.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to download ${filename}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Downloading dependencies from jsDelivr CDN...\n');
  
  // Create vendor directory if it doesn't exist
  if (!existsSync(VENDOR_DIR)) {
    await mkdir(VENDOR_DIR, { recursive: true });
    console.log(`📁 Created ${VENDOR_DIR}\n`);
  }
  
  const results = await Promise.all(
    Object.entries(DEPENDENCIES).map(([filename, url]) => 
      downloadFile(url, filename)
    )
  );
  
  const successCount = results.filter(Boolean).length;
  const totalCount = results.length;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📦 Downloaded ${successCount}/${totalCount} dependencies`);
  
  if (successCount < totalCount) {
    console.error('⚠️  Some downloads failed. Please check your network connection.');
    process.exit(1);
  }
  
  console.log('✨ All dependencies downloaded successfully!\n');
}

main().catch(console.error);
