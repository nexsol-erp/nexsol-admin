const test = require("node:test");
const assert = require("node:assert/strict");
const { Store } = require("../electron/store");
const { Sync } = require("../electron/sync");

function fakeServer(handlers) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const path = url.replace(/^https:\/\/srv\/api\/T1/, "");
    calls.push({ method: opts.method, path, body: opts.body ? JSON.parse(opts.body) : undefined });
    const key = `${opts.method} ${path.split("?")[0]}`;
    const h = handlers[key];
    if (!h) return { ok: false, status: 404, text: async () => "not found" };
    const out = await h(calls[calls.length - 1]);
    const status = out?.__status || 200;
    return { ok: status < 400, status, text: async () => JSON.stringify(out?.__body ?? out) };
  };
  return { calls, fetchImpl };
}

const auth = () => ({ apiServer: "https://srv", tenantId: "T1", token: "tok", branchCode: "WB1" });

function storeWithRates() {
  const s = new Store(":memory:");
  s.replaceRates([{ id: "r", wheelType: "6 WHEEL", wheelRate: 100, voucherDate: "2026-01-01" }]);
  return s;
}

test("uploads weighings with voucher number, round trip and dates", async () => {
  const s = storeWithRates();
  const row = s.saveWeighing({ vehicleNumber: "KL1", wheelType: "6 WHEEL", weight: 9000, branchCode: "WB1" });
  const srv = fakeServer({ "POST /weighbridge/save": () => ({ success: true }), "GET /wb-rates": () => [], "GET /weighbridge/resync-request": () => [] });
  const sync = new Sync(s, auth, srv.fetchImpl);
  const st = await sync.run();
  const save = srv.calls.find((c) => c.path === "/weighbridge/save");
  assert.equal(save.body.ddId, row.id);
  assert.equal(save.body.voucherNumber, "000001");
  assert.equal(save.body.roundTrip, 0);
  assert.equal(save.body.amount, 100);
  assert.equal(st.pending.weights, 0);
  assert.equal(st.online, true);
});

test("offline: rows stay queued and nothing is lost", async () => {
  const s = storeWithRates();
  s.saveWeighing({ vehicleNumber: "KL1", wheelType: "6 WHEEL", weight: 9000 });
  const sync = new Sync(s, auth, async () => { throw new Error("getaddrinfo ENOTFOUND"); });
  const st = await sync.run();
  assert.equal(st.online, false);
  assert.equal(st.pending.weights, 1);
});

test("expired login: asks to sign in, keeps rows", async () => {
  const s = storeWithRates();
  s.saveWeighing({ vehicleNumber: "KL1", wheelType: "6 WHEEL", weight: 9000 });
  const srv = fakeServer({ "POST /weighbridge/save": () => ({ __status: 401, __body: {} }) });
  const st = await new Sync(s, auth, srv.fetchImpl).run();
  assert.equal(st.needsLogin, true);
  assert.equal(st.pending.weights, 1);
});

test("a row the server rejects is kept with the reason and doesn't block the rest", async () => {
  const s = storeWithRates();
  const bad = s.saveWeighing({ vehicleNumber: "KL1", wheelType: "6 WHEEL", weight: 9000 });
  s.saveWeighing({ vehicleNumber: "KL2", wheelType: "6 WHEEL", weight: 9000 });
  const srv = fakeServer({
    "POST /weighbridge/save": (c) => (c.body.ddId === bad.id ? { __status: 500, __body: { error: "boom" } } : { success: true }),
    "GET /wb-rates": () => [],
    "GET /weighbridge/resync-request": () => [],
  });
  const st = await new Sync(s, auth, srv.fetchImpl).run();
  assert.equal(st.pending.weights, 1);
  assert.equal(s.getWeighing(bad.id).sync_error, "boom");
});

test("resync request re-sends that day and reports the count", async () => {
  const s = storeWithRates();
  const row = s.saveWeighing({ vehicleNumber: "KL1", wheelType: "6 WHEEL", weight: 9000 });
  s.markSynced("weights", row.id);
  const srv = fakeServer({
    "POST /weighbridge/save": () => ({ success: true }),
    "GET /wb-rates": () => [{ id: "n", wheelType: "6 WHEEL", wheelRate: 120, voucherDate: "2026-09-01" }],
    "GET /weighbridge/resync-request": () => [{ id: "rq1", resyncDate: row.voucher_date.slice(0, 10) }],
    "POST /weighbridge/resync-request/rq1/complete": () => ({}),
  });
  await new Sync(s, auth, srv.fetchImpl).run();
  const done = srv.calls.find((c) => c.path.endsWith("/complete"));
  assert.equal(done.body.queuedCount, 1);
  assert.equal(srv.calls.filter((c) => c.path === "/weighbridge/save").length, 1);
  assert.equal(s.rates()[0].wheelRate, 120, "rates refreshed from server");
});

test("seed continues voucher numbers and imports history", async () => {
  const s = storeWithRates();
  const srv = fakeServer({
    "GET /weighbridge/last-voucher": (c) => ({ lastNumber: c.path.includes("type=WB") ? 4521 : 33 }),
    "GET /weighbridge/sync": () => ({ weights: [{ ddId: "q1", vehicleNumber: "KL9", lcdNumber: 5000, roundTrip: 0 }], tares: [] }),
    "GET /wb-rates": () => [],
  });
  const out = await new Sync(s, auth, srv.fetchImpl).seed();
  assert.deepEqual(out, { imported: { weights: 1, tares: 0 }, lastWB: 4521, lastWT: 33 });
  assert.equal(s.saveWeighing({ vehicleNumber: "KL9", wheelType: "6 WHEEL", weight: 1 }).voucher_number, "004522");
});
test("looks up a vehicle's wheel type on the server and remembers it", async () => {
  const s = storeWithRates();
  const srv = fakeServer({
    "GET /weighbridge/wheel-type/MH12Q7": () => ({ vehicleNumber: "MH12Q7", wheelType: "10 WHEEL", source: "history", lastDate: "2026-09-01 10:00:00" }),
    "GET /weighbridge/wheel-type/KL01A1": () => ({ vehicleNumber: "KL01A1", wheelType: "6 WHEEL", source: "set", updatedAt: "2026-10-01 05:00:00" }),
    "GET /weighbridge/wheel-type/NONE1": () => ({ vehicleNumber: "NONE1", wheelType: "", source: "none" }),
  });
  const sync = new Sync(s, auth, srv.fetchImpl);
  assert.equal(await sync.lookupWheelType("MH12Q7"), "10 WHEEL");
  assert.equal(s.wheelTypeOf("MH12Q7"), "10 WHEEL");
  s.saveWeighing({ vehicleNumber: "KL01A1", wheelType: "6 WHEEL", weight: 9000, branchCode: "WB1" });
  assert.equal(await sync.lookupWheelType("KL01A1"), "6 WHEEL");
  assert.equal(await sync.lookupWheelType("NONE1"), "");
  assert.equal(s.wheelTypeOf("NONE1"), "");
});

test("pulls wheel types changed in the web admin, from where it left off", async () => {
  const s = storeWithRates();
  s.replaceRates([
    { id: "a", wheelType: "6 WHEEL", wheelRate: 100, voucherDate: "2026-01-01" },
    { id: "b", wheelType: "10 WHEEL", wheelRate: 150, voucherDate: "2026-01-01" },
  ]);
  s.saveWeighing({ vehicleNumber: "KL07AB1234", wheelType: "6 WHEEL", weight: 9000, branchCode: "WB1" });
  const srv = fakeServer({
    "GET /weighbridge/wheel-types/changes": () => ({ installed: true, rows: [
      { vehicleNumber: "KL07AB1234", wheelType: "10 WHEEL", updatedAt: "2026-10-01 05:20:11.123456" },
    ] }),
  });
  const sync = new Sync(s, auth, srv.fetchImpl);
  assert.equal(await sync.pullWheelTypes(), 1);
  assert.equal(s.wheelTypeOf("KL07AB1234"), "10 WHEEL");
  await sync.pullWheelTypes();
  assert.equal(srv.calls.at(-1).path, "/weighbridge/wheel-types/changes?since=2026-10-01%2005%3A20%3A11.123456");

  const old = new Sync(storeWithRates(), auth, fakeServer({}).fetchImpl);
  assert.equal(await old.pullWheelTypes(), 0, "a server without the feature is ignored");
});

test("a failing resync request check doesn't mark the PC offline", async () => {
  const s = storeWithRates();
  s.saveWeighing({ vehicleNumber: "KL1", wheelType: "6 WHEEL", weight: 9000, branchCode: "WB1" });
  const srv = fakeServer({
    "POST /weighbridge/save": () => ({ success: true }),
    "GET /wb-rates": () => [],
    "GET /weighbridge/resync-request": () => ({ __status: 500, __body: { error: "relation wb_resync_request does not exist" } }),
  });
  const sync = new Sync(s, auth, srv.fetchImpl);
  const warns = [];
  sync.on("warn", (m) => warns.push(m));
  const st = await sync.run({ forcePull: true });
  assert.equal(st.online, true);
  assert.equal(st.pending.weights, 0);
  assert.match(warns[0], /wb_resync_request/);
});
