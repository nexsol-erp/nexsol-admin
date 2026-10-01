const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const camera = require("../electron/camera");
const { Store } = require("../electron/store");
const { Sync } = require("../electron/sync");

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

test("a grabbed frame is accepted only when it is a JPEG", () => {
  assert.deepEqual(camera.jpegFromDataUrl("data:image/jpeg;base64," + JPEG.toString("base64")), JPEG);
  assert.equal(camera.jpegFromDataUrl("data:image/png;base64," + Buffer.from("PNG").toString("base64")), null);
  assert.equal(camera.jpegFromDataUrl(""), null);
});

test("IP camera: credentials in the address go as basic auth, errors are short", async () => {
  let seen;
  const ok = async (url, opts) => { seen = { url, opts }; return { ok: true, status: 200, arrayBuffer: async () => JPEG }; };
  const buf = await camera.fetchSnapshot("http://admin:p%40ss@10.0.0.5/snap.jpg", ok);
  assert.deepEqual(buf, JPEG);
  assert.equal(seen.url, "http://10.0.0.5/snap.jpg");
  assert.equal(seen.opts.headers.Authorization, "Basic " + Buffer.from("admin:p@ss").toString("base64"));
  await assert.rejects(camera.fetchSnapshot("rtsp://10.0.0.5/live", ok), /http/);
  await assert.rejects(camera.fetchSnapshot("http://10.0.0.5/x", async () => ({ ok: false, status: 401 })), /HTTP 401/);
  await assert.rejects(camera.fetchSnapshot("http://10.0.0.5/x", async () => ({ ok: true, status: 200, arrayBuffer: async () => Buffer.from("<html>") })), /JPEG/);
});

function storeWithWeighing() {
  const s = new Store(":memory:");
  s.replaceRates([{ id: "r", wheelType: "6 WHEEL", wheelRate: 100, voucherDate: "2026-01-01" }]);
  const row = s.saveWeighing({ vehicleNumber: "KL1", wheelType: "6 WHEEL", weight: 9000, branchCode: "WB1" });
  return { s, row };
}

test("the photo is kept with its weighing and uploads after the weighing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wbphoto-"));
  const { s, row } = storeWithWeighing();
  const file = camera.savePhoto(dir, row, JPEG);
  assert.ok(file.startsWith(path.join(dir, row.voucher_date.slice(0, 7))));
  s.setPhoto(row.id, file);
  assert.equal(s.pendingCount().photos, 1);
  assert.equal(s.pendingPhotos().length, 0, "waits for its weighing");

  const calls = [];
  let photoStatus = 404;
  const fetchImpl = async (url, opts) => {
    const p = url.replace("https://srv/api/T1", "");
    calls.push(p);
    if (p === "/weighbridge/photo") {
      const body = JSON.parse(opts.body);
      assert.equal(body.ddId, row.id);
      assert.deepEqual(Buffer.from(body.image, "base64"), JPEG);
      return { ok: photoStatus < 400, status: photoStatus, text: async () => "{}" };
    }
    return { ok: true, status: 200, text: async () => (p.startsWith("/wb-rates") || p.includes("resync") ? "[]" : "{}") };
  };
  const sync = new Sync(s, () => ({ apiServer: "https://srv", tenantId: "T1", token: "t", branchCode: "WB1" }), fetchImpl);
  await sync.push();
  assert.ok(calls.includes("/weighbridge/save"));
  assert.equal(s.pendingCount().photos, 1, "an older server keeps it waiting");
  photoStatus = 200;
  await sync.push();
  assert.equal(s.pendingCount().photos, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a photo whose file is gone is not retried forever", async () => {
  const { s, row } = storeWithWeighing();
  s.markSynced("weights", row.id);
  s.setPhoto(row.id, "/nonexistent/photo.jpg");
  const sync = new Sync(s, () => ({ apiServer: "https://srv", tenantId: "T1", token: "t", branchCode: "WB1" }), async () => { throw new Error("should not call"); });
  await sync.pushPhotos();
  assert.equal(s.pendingCount().photos, 0);
  assert.match(s.getWeighing(row.id).photo_error, /missing/);
});

test("photos kept on this PC only are never uploaded", () => {
  const { s, row } = storeWithWeighing();
  s.markSynced("weights", row.id);
  s.setPhoto(row.id, "/x/photo.jpg", false);
  assert.equal(s.pendingCount().photos, 0);
  assert.equal(s.pendingPhotos().length, 0);
  assert.equal(s.getWeighing(row.id).photo_path, "/x/photo.jpg");
});

test("the voucher prints the photo only when one is given", () => {
  const { voucherHtml } = require("../electron/voucher");
  const row = { voucher_number: "000001", vehicle_number: "KL1", lcd_number: 9000, amount: 100 };
  const data = "data:image/jpeg;base64," + JPEG.toString("base64");
  assert.match(voucherHtml(row, { photo: data }), /<img src="data:image\/jpeg;base64,/);
  assert.doesNotMatch(voucherHtml(row, {}), /<img/);
  assert.doesNotMatch(voucherHtml(row, { photo: 'x" onerror="alert(1)' }), /<img/);
});
