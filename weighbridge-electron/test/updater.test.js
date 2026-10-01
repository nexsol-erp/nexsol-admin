const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Updater, compareVersions } = require("../electron/updater");

const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(1024 * 1024 + 10, 1)]);

function server({ version = "1.0.2", body = exe, length = body.length, latestStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith("/latest.json")) {
      return { ok: latestStatus < 400, status: latestStatus, json: async () => ({ version, url: "/api/updates/weighbridge/download" }) };
    }
    return { ok: true, status: 200, headers: { get: () => String(length) }, arrayBuffer: async () => body };
  };
  return { calls, fetchImpl };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "wb-upd-"));
const make = (srv, dir, current = "1.0.1") =>
  new Updater({ currentVersion: current, serverUrl: () => "https://srv", fetchImpl: srv.fetchImpl, dir });

test("compares versions numerically", () => {
  assert.equal(compareVersions("1.0.10", "1.0.9"), 1);
  assert.equal(compareVersions("1.0.1", "1.0.1"), 0);
  assert.equal(compareVersions("1.0", "1.0.1"), -1);
});

test("downloads a newer version and reports it ready", async () => {
  const dir = tmp();
  const srv = server();
  const u = make(srv, dir);
  const st = await u.check();
  assert.equal(st.status, "ready");
  assert.equal(st.version, "1.0.2");
  assert.ok(fs.existsSync(path.join(dir, "TradeLink247-Weighbridge-Setup-1.0.2.exe")));
  assert.deepEqual(srv.calls, ["https://srv/api/updates/weighbridge/latest.json", "https://srv/api/updates/weighbridge/download"]);
});

test("same or older version on the server: nothing to do", async () => {
  const srv = server({ version: "1.0.1" });
  assert.equal((await make(srv, tmp()).check()).status, "none");
  assert.equal(srv.calls.length, 1);
  assert.equal((await make(server({ latestStatus: 404 }), tmp()).check()).status, "none", "nothing published yet");
});

test("a broken or short download is not kept", async () => {
  const dir = tmp();
  let st = await make(server({ body: Buffer.from("<html>not found</html>") }), dir).check();
  assert.equal(st.status, "error");
  st = await make(server({ length: exe.length + 5 }), dir).check();
  assert.match(st.error, /incomplete/);
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith(".exe")), []);
});

test("an installer already downloaded is reused, older ones are removed", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "TradeLink247-Weighbridge-Setup-1.0.0.exe"), exe);
  await make(server(), dir).check();
  const again = server();
  assert.equal((await make(again, dir).check()).status, "ready");
  assert.equal(again.calls.length, 1, "no second download");
  assert.deepEqual(fs.readdirSync(dir), ["TradeLink247-Weighbridge-Setup-1.0.2.exe"]);
});
