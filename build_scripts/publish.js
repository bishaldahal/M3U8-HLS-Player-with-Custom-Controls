const fs = require("fs");
const path = require("path");

const extensionName = require("../manifest.json").name.replace(/[\s\/]/g, "-");
const date = new Date();
const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const outputDir = path.resolve(__dirname, "..", "build");
const outputFile = path.join(outputDir, `${extensionName}.Chromium.-${formattedDate}.zip`);

// Read developer notes from a file
const notesFile = path.resolve(__dirname, "..", "build_scripts", "developer_notes.txt");
let developerNotes = "Minor Bug Fixes";
if (fs.existsSync(notesFile)) {
  developerNotes = fs.readFileSync(notesFile, "utf8");
  console.log( developerNotes);
}

// Use dynamic import to import the EdgeWebstoreClient
import("@plasmo-corp/ewu").then(({ EdgeWebstoreClient }) => {
  const client = new EdgeWebstoreClient({
    productId: process.env.PRODUCT_ID,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    accessTokenUrl: process.env.ACCESS_TOKEN_URL,
  });

  client.submit({
    filePath: outputFile,
    notes: developerNotes,
  });
});