const { spawn } = require("child_process");
const path = require("path");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronExe = path.join(__dirname, "../node_modules/electron/dist/electron.exe");

const child = spawn(electronExe, ["."], {
  stdio: "inherit",
  windowsHide: false,
  env,
  cwd: path.join(__dirname, ".."),
});

child.on("close", (code) => process.exit(code ?? 0));
