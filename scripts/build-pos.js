// Builds the pos-electron installer.
// Finds pos-electron in either ../pos-electron (local dev) or ./pos-electron (CI subfolder).
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const candidates = [
  path.resolve(__dirname, "../../pos-electron"), // sibling dir (local dev)
  path.resolve(__dirname, "../pos-electron"),    // subfolder (CI)
];

const posDir = candidates.find((p) => fs.existsSync(p));
if (!posDir) {
  console.error("pos-electron directory not found.");
  process.exit(1);
}

console.log("Building Cashier POS from:", posDir);
execSync("npm run dist:win", { cwd: posDir, stdio: "inherit" });
