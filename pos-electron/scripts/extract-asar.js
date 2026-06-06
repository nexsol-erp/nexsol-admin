/**
 * extract-asar.js
 *
 * After `vite build`, packages the application into app.asar and produces:
 *   release/update/TradeLink247-POS-<version>.asar
 *   release/update/TradeLink247-POS-<version>.asar.sha256
 *   release/update/update-manifest.json
 *
 * Upload TradeLink247-POS-<version>.asar to the server as an APPLICATION_UPDATE.
 * This is ~5–30 MB instead of the 150 MB+ full installer.
 */

const { execSync } = require("child_process");
const crypto       = require("crypto");
const fs           = require("fs");
const path         = require("path");

const pkg     = require("../package.json");
const version = pkg.version;

const distDir  = path.resolve(__dirname, "../dist");
const electronDir = path.resolve(__dirname, "../electron");
const outDir   = path.resolve(__dirname, "../release/update");
const asarName = `TradeLink247-POS-${version}.asar`;
const asarPath = path.join(outDir, asarName);

// Ensure asar cli is available
try { execSync("npx asar --version", { stdio: "ignore" }); }
catch { console.error("asar not found — run: npm install -g @electron/asar"); process.exit(1); }

fs.mkdirSync(outDir, { recursive: true });

// Build a staging folder with what goes inside app.asar
const stagingDir = path.join(outDir, ".staging");
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true });
fs.mkdirSync(stagingDir, { recursive: true });

// Copy dist (React build) and electron folder + package.json into staging
fs.cpSync(distDir,      path.join(stagingDir, "dist"),     { recursive: true });
fs.cpSync(electronDir,  path.join(stagingDir, "electron"), { recursive: true });
fs.copyFileSync(
  path.resolve(__dirname, "../package.json"),
  path.join(stagingDir, "package.json")
);

console.log("Packing app.asar from", stagingDir);
execSync(`npx asar pack "${stagingDir}" "${asarPath}"`, { stdio: "inherit" });

// Cleanup staging
fs.rmSync(stagingDir, { recursive: true });

// SHA-256 checksum
const hash    = crypto.createHash("sha256");
const content = fs.readFileSync(asarPath);
hash.update(content);
const checksum = hash.digest("hex");

const sha256File = asarPath + ".sha256";
fs.writeFileSync(sha256File, checksum);

// Update manifest JSON
const fileSize = fs.statSync(asarPath).size;
const manifest = {
  version,
  platform:      "WINDOWS",
  releaseType:   "APPLICATION_UPDATE",
  fileName:      asarName,
  fileSize,
  checksum,
  releaseDate:   new Date().toISOString().split("T")[0],
};
fs.writeFileSync(
  path.join(outDir, "update-manifest.json"),
  JSON.stringify(manifest, null, 2)
);

const mb = (fileSize / (1024 * 1024)).toFixed(1);
console.log(`\nUpdate package ready:`);
console.log(`  File    : release/update/${asarName}`);
console.log(`  Size    : ${mb} MB`);
console.log(`  SHA-256 : ${checksum}`);
console.log(`  Manifest: release/update/update-manifest.json`);
