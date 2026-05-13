// Copies the latest pos-electron installer into public/downloads/
// so CRA includes it in the production build at /downloads/TradeLink247-POS-Setup.exe
//
// Looks for pos-electron in two places:
//   1. ../pos-electron/  (local dev — sibling directory)
//   2. ./pos-electron/   (CI — subfolder of nexsol-admin)
const fs = require("fs");
const path = require("path");

const candidates = [
  path.resolve(__dirname, "../../pos-electron/release"), // sibling dir (local dev)
  path.resolve(__dirname, "../pos-electron/release"),    // subfolder (CI)
];

const releaseDir = candidates.find((p) => fs.existsSync(p));
if (!releaseDir) {
  console.error("pos-electron/release not found. Run 'npm run build:pos' first.");
  process.exit(1);
}

const exeFiles = fs.readdirSync(releaseDir).filter((f) => f.endsWith(".exe"));
if (!exeFiles.length) {
  console.error("No .exe found in", releaseDir, "— run 'npm run build:pos' first.");
  process.exit(1);
}

const destDir = path.resolve(__dirname, "../public/downloads");
fs.mkdirSync(destDir, { recursive: true });

const src = path.join(releaseDir, exeFiles[0]);
const dest = path.join(destDir, "TradeLink247-POS-Setup.exe");
fs.copyFileSync(src, dest);
console.log(`Copied  ${exeFiles[0]}`);
console.log(`     -> public/downloads/TradeLink247-POS-Setup.exe`);
