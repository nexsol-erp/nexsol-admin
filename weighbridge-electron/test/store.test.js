const test = require("node:test");
const assert = require("node:assert/strict");
const { Store, ValidationError, normalizeVehicle } = require("../electron/store");
const { rateFor, quote } = require("../electron/charge");

function fresh() {
  const s = new Store(":memory:");
  s.replaceRates([
    { id: "r1", wheelType: "6 WHEEL", wheelRate: 80, voucherDate: "2026-01-01T00:00:00.000+00:00" },
    { id: "r2", wheelType: "6 WHEEL", wheelRate: 100, voucherDate: "2026-06-01T00:00:00.000+00:00" },
    { id: "r3", wheelType: "10 WHEEL", wheelRate: 150, voucherDate: "2026-06-01T00:00:00.000+00:00" },
    { id: "r4", wheelType: "10 WHEEL", wheelRate: 0, voucherDate: "2026-09-01T00:00:00.000+00:00" },
  ]);
  return s;
}

let clock = new Date("2026-09-30T08:00:00");
const tick = () => (clock = new Date(clock.getTime() + 60000));
const base = { wheelType: "6 WHEEL", branchCode: "WB1", userId: "op" };
const weigh = (s, extra) => s.saveWeighing({ ...base, vehicleNumber: "KL07AB1234", weight: 12000, now: tick(), ...extra });

test("newest positive rate per wheel type wins (Qt getRateBasedonWheelType)", () => {
  const s = fresh();
  assert.equal(rateFor(s.allRates(), "6 WHEEL"), 100);
  assert.equal(rateFor(s.allRates(), "10 WHEEL"), 150, "a newer 0 rate is ignored");
  assert.deepEqual(s.rates().map((r) => r.wheelRate), [150, 100]);
});

test("charging decision table", () => {
  assert.equal(quote(100, { kind: "none" }).amount, 100);
  assert.equal(quote(100, { kind: "previous", roundTrip: 0 }).amount, 0);
  assert.equal(quote(100, { kind: "previous", roundTrip: 1 }).amount, 100);
  assert.equal(quote(100, { kind: "tare" }).amount, 100);
});

test("first weighing is charged, its return is free, a second return is charged", () => {
  const s = fresh();
  const first = weigh(s, { weight: 5000 });
  assert.equal(first.amount, 100);
  assert.equal(first.round_trip, 0);
  assert.equal(first.voucher_number, "000001");

  const back = weigh(s, { weight: 17000, source: { kind: "previous", id: first.id } });
  assert.equal(back.amount, 0, "free return");
  assert.equal(back.round_trip, 1);
  assert.equal(back.first_weight, 5000);
  assert.equal(s.getWeighing(first.id).round_trip, 1, "return closes the first weighing");

  const again = weigh(s, { weight: 17100, source: { kind: "previous", id: first.id } });
  assert.equal(again.amount, 100, "the first weighing was already used");
});

test("a new first weighing closes the vehicle's older open weighings", () => {
  const s = fresh();
  const a = weigh(s);
  const b = weigh(s);
  assert.equal(s.getWeighing(a.id).round_trip, 1);
  assert.equal(s.getWeighing(b.id).round_trip, 0, "only the newest stays open");
  assert.equal(weigh(s, { source: { kind: "previous", id: a.id } }).amount, 100);
});

test("tare weight is charged in full and counts as a round trip", () => {
  const s = fresh();
  const t = s.saveTare({ vehicleNumber: "kl 07 ab 1234", tareWeight: 6500, branchCode: "WB1", now: tick() });
  assert.equal(t.vehicle_number, "KL07AB1234");
  assert.equal(t.voucher_number, "000001", "WT has its own series");
  const w = weigh(s, { weight: 20000, source: { kind: "tare", id: t.id } });
  assert.equal(w.amount, 100);
  assert.equal(w.first_weight, 6500);
  assert.equal(w.round_trip, 1);
});

test("quote on screen matches what save stores", () => {
  const s = fresh();
  const first = weigh(s, { weight: 5000 });
  const q = s.quote({ vehicleNumber: "KL07AB1234", wheelType: "6 WHEEL", source: { kind: "previous", id: first.id }, weight: 17000 });
  assert.deepEqual([q.amount, q.firstWeight, q.netWeight, q.roundTrip], [0, 5000, 12000, 1]);
});

test("save refuses what the Qt screen refused", () => {
  const s = fresh();
  assert.throws(() => weigh(s, { weight: 0 }), ValidationError);
  assert.throws(() => weigh(s, { vehicleNumber: " - " }), ValidationError);
  assert.throws(() => weigh(s, { wheelType: "" }), ValidationError);
  assert.throws(() => weigh(s, { wheelType: "3 WHEEL" }), /No rate/);
  const other = s.saveWeighing({ ...base, vehicleNumber: "TN01X1", weight: 5000, now: tick() });
  assert.throws(() => weigh(s, { source: { kind: "previous", id: other.id } }), /this vehicle/);
  assert.equal(s.lastVoucher("WB"), 1, "refused saves don't use up a voucher number");
});

test("voucher numbers continue the branch's sequence", () => {
  const s = fresh();
  s.ensureSeriesAtLeast("WB", 4521);
  s.ensureSeriesAtLeast("WB", 12);
  assert.equal(weigh(s).voucher_number, "004522");
});

test("outbox, resync and server import", () => {
  const s = fresh();
  const a = weigh(s);
  s.addEngage({ weight: 800, branchCode: "WB1" });
  assert.deepEqual(s.pendingCount(), { weights: 1, tares: 0, engage: 1 });
  s.markSynced("weights", a.id);
  assert.equal(s.pendingCount().weights, 0);
  assert.equal(s.requeueDate(a.voucher_date), 1);

  const imported = s.importFromServer({
    weights: [
      { ddId: a.id, vehicleNumber: "KL07AB1234", lcdNumber: 1 },
      { ddId: "qt-1", vehicleNumber: "tn 22 z 9", voucherNumber: "000900", voucherDate: "2026-09-29T04:30:00.000+00:00", lcdNumber: 7000, amount: 100, roundTrip: 0, wheelType: "10 WHEEL" },
    ],
    tares: [{ id: 5, vehicleNumber: "TN22Z9", tareWeight: 6000, voucherNumber: "000003", branchCode: "WB1" }],
  });
  assert.deepEqual(imported, { weights: 1, tares: 1 });
  assert.equal(s.getWeighing(a.id).lcd_number, 12000, "local row not overwritten");
  assert.equal(s.wheelTypeOf("TN22Z9"), "10 WHEEL");
  assert.deepEqual(s.importFromServer({ tares: [{ id: 5, vehicleNumber: "TN22Z9", tareWeight: 6000, voucherNumber: "000003", branchCode: "WB1" }] }), { weights: 0, tares: 0 });
  // An open first weighing made on the old Qt screen still gives a free return here.
  const h = s.history("TN22Z9");
  const back = s.saveWeighing({ ...base, wheelType: "10 WHEEL", vehicleNumber: "TN22Z9", weight: 15000, source: { kind: "previous", id: h.weights[0].id }, now: tick() });
  assert.equal(back.amount, 0);
});

test("report totals and last voucher", () => {
  const s = fresh();
  weigh(s);
  weigh(s);
  const r = s.report("2000-01-01", "2100-01-01");
  assert.equal(r.count, 2);
  assert.equal(r.total, 200);
  assert.equal(r.lastVoucher, "000002");
});

test("vehicle numbers are normalised like the Qt validator", () => {
  assert.equal(normalizeVehicle(" kl-07 ab 1234 "), "KL07AB1234");
});
