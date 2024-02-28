const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const extensionName = require("../manifest.json").name.replace(/[\s\/]/g, "-");

// Get current date
const date = new Date();
const formattedDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;

// Define the output directory and filename
const outputDir = path.resolve(__dirname, '..', 'build');
const outputFile = path.join(outputDir, `${extensionName}-${formattedDate}.zip`);

// Ensure the output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Delete old zip files
const oldZipFiles = fs.readdirSync(outputDir).filter(file => file.endsWith('.zip'));
for (const file of oldZipFiles) {
  fs.unlinkSync(path.join(outputDir, file));
}

// Define the 7z command
const command = `"Z:\\Programs\\7-Zip\\7z" a -tzip -r "${outputFile}" . -x!node_modules -x!.vscode -x!original -x!package.json -x!package-lock.json -x!README.md -x!extension.zip -x!.git -x!.gitignore`;

// Execute the command
execSync(command, { stdio: 'inherit' });