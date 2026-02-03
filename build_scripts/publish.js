import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platform = process.argv[2] || "chrome";
const outputDir = path.resolve(__dirname, "..", "build");

const date = new Date();
const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const platformName = platform === "firefox" ? "Firefox" : "Chromium";
const outputFile = path.join(outputDir, `M3U8-HLS-Player.${platformName}.${formattedDate}.zip`);

const notesFile = path.resolve(__dirname, "developer_notes.txt");
const developerNotes = fs.existsSync(notesFile) 
  ? fs.readFileSync(notesFile, "utf8") 
  : "Minor Bug Fixes";

async function publishChromeWebStore() {
  const { CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN, CHROME_EXTENSION_ID } = process.env;
  
  if (!CHROME_CLIENT_ID || !CHROME_CLIENT_SECRET || !CHROME_REFRESH_TOKEN || !CHROME_EXTENSION_ID) {
    throw new Error("Missing Chrome Web Store credentials");
  }

  if (!fs.existsSync(outputFile)) {
    throw new Error(`Build file not found: ${outputFile}`);
  }

  const { default: chromeWebstoreUpload } = await import("chrome-webstore-upload");
  const store = chromeWebstoreUpload({
    extensionId: CHROME_EXTENSION_ID,
    clientId: CHROME_CLIENT_ID,
    clientSecret: CHROME_CLIENT_SECRET,
    refreshToken: CHROME_REFRESH_TOKEN,
  });

  const zipStream = fs.createReadStream(outputFile);
  await store.uploadExisting(zipStream);
  await store.publish();
  
  console.log("✅ Published to Chrome Web Store");
}

async function publishFirefox() {
  const { WEB_EXT_API_KEY, WEB_EXT_API_SECRET } = process.env;
  
  if (!WEB_EXT_API_KEY || !WEB_EXT_API_SECRET) {
    throw new Error("Missing Firefox API credentials");
  }

  const webExt = (await import("web-ext")).default;
  await webExt.cmd.sign({
    sourceDir: path.resolve(__dirname, ".."),
    artifactsDir: outputDir,
    apiKey: WEB_EXT_API_KEY,
    apiSecret: WEB_EXT_API_SECRET,
    amoBaseUrl: "https://addons.mozilla.org/api/v5/",
    channel: "listed",
    uploadSource: true,
  });
  
  console.log("✅ Published to Firefox Add-ons");
}

async function publishEdge() {
  const { EdgeAddonsAPI } = await import("@plasmohq/edge-addons-api");
  const client = new EdgeAddonsAPI({
    productId: process.env.PRODUCT_ID,
    clientId: process.env.CLIENT_ID,
    apiKey: process.env.EDGE_API_KEY,
  });

  await client.submit({ 
    filePath: outputFile, 
    notes: developerNotes 
  });
  
  console.log("✅ Published to Edge Add-ons");
}

// Main execution
(async () => {
  try {
    if (platform === "firefox") {
      await publishFirefox();
    } else if (platform === "chrome-webstore") {
      await publishChromeWebStore();
    } else {
      await publishEdge();
    }
  } catch (error) {
    console.error("❌", error.message || error);
    process.exit(1);
  }
})();
