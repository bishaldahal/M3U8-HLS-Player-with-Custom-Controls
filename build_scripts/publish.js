import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const platform = process.argv[2] || "chrome";
const date = new Date();
const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1)
  .toString()
  .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
const outputDir = path.resolve(__dirname, "..", "build");
const platformName = platform === "firefox" ? "Firefox" : "Chromium";
const outputFile = path.join(
  outputDir,
  `M3U8-HLS-Player.${platformName}.${formattedDate}.zip`
);

const notesFile = path.resolve(__dirname, "developer_notes.txt");
let developerNotes = "Minor Bug Fixes";
if (fs.existsSync(notesFile)) {
  developerNotes = fs.readFileSync(notesFile, "utf8");
  console.log(developerNotes);
}

if (platform === "firefox") {
  // Firefox publishing
  const WEB_EXT_API_KEY = process.env.WEB_EXT_API_KEY;
  const WEB_EXT_API_SECRET = process.env.WEB_EXT_API_SECRET;

  if (!WEB_EXT_API_KEY || !WEB_EXT_API_SECRET) {
    console.error(
      "❌ Missing Firefox API credentials (WEB_EXT_API_KEY, WEB_EXT_API_SECRET)"
    );
    process.exit(1);
  }

  console.log("📦 Publishing to Firefox Add-ons...");

  import("web-ext").then(({ default: webExt }) => {
    webExt.cmd
      .sign({
        sourceDir: path.resolve(__dirname, ".."),
        artifactsDir: outputDir,
        apiKey: WEB_EXT_API_KEY,
        apiSecret: WEB_EXT_API_SECRET,
        channel: "listed",
        uploadSource: true,
        approvalNotes: "Automated release ${{ github.ref_name }} - ${{ github.sha }}. See changelog for details."
      })
      .then((result) => {
        console.log("✅ Published to Firefox Add-ons");
      })
      .catch((error) => {
        console.error("❌ Firefox publish failed:", error);
        process.exit(1);
      });
  });
} else {
  // Edge/Chrome publishing
  console.log("📦 Publishing to Edge Add-ons...");

  import("@plasmohq/edge-addons-api").then(({ EdgeAddonsAPI }) => {
    const client = new EdgeAddonsAPI({
      productId: process.env.PRODUCT_ID,
      clientId: process.env.CLIENT_ID,
      apiKey: process.env.EDGE_API_KEY,
    });

    client
      .submit({
        filePath: outputFile,
        notes: developerNotes,
      })
      .then(() => {
        console.log("✅ Published to Edge Add-ons");
      })
      .catch((error) => {
        console.error("❌ Edge publish failed:", error);
        process.exit(1);
      });
  });
}
