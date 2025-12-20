import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'));
const extensionName = manifest.name.replace(/[\s\/]/g, "-");

// Get current date
const date = new Date();
const formattedDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;

// Define the output directory and filename
const outputDir = path.join(projectRoot, 'build');
const outputFile = path.join(outputDir, `${extensionName}.Chromium.-${formattedDate}.zip`);

// Ensure the output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Delete old zip files
const oldZipFiles = fs.readdirSync(outputDir).filter(file => file.endsWith('.zip'));
for (const file of oldZipFiles) {
  fs.unlinkSync(path.join(outputDir, file));
}

// Create output stream
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
  zlib: { level: 9 }
});

// Handle stream events
output.on('close', () => {
  console.log(`Successfully created: ${outputFile} (${archive.pointer()} bytes)`);
});

archive.on('error', (err) => {
  console.error('Archive error:', err);
  process.exit(1);
});

output.on('error', (err) => {
  console.error('Output error:', err);
  process.exit(1);
});

// Pipe archive to output
archive.pipe(output);

// Add files with glob patterns to exclude specific items
archive.glob('**', {
  cwd: projectRoot,
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