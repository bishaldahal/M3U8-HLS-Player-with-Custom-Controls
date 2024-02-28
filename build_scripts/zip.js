const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const extensionName = require("../manifest.json").name.replace(/[\s\/]/g, "_");

// Get current date
const date = new Date();
const formattedDate = `${date.getFullYear()}-${
  date.getMonth() + 1
}-${date.getDate()}`;

// Define the output directory and filename
const outputDir = path.join(__dirname, "..", "build");
const outputFile = path.join(outputDir, `${extensionName}-${formattedDate}.zip`);

// Ensure the output directory exists
fs.mkdirSync(outputDir, { recursive: true });

// Define the 7z command
const command = `"Z:\\Programs\\7-Zip\\7z" a -tzip -r "${outputFile}" . -x!node_modules -x!.vscode -x!original -x!package.json -x!package-lock.json -x!README.md -x!extension.zip -x!.git -x!.gitignore`;

// Execute the command
execSync(command, { stdio: "inherit" });
