const test = require("node:test");
const assert = require("node:assert/strict");
const { buildProfile, unescapeCtl, escapeCtl, PRESETS } = require("../electron/indicator/profiles");
const { FrameSplitter, decodeFrame, IndicatorSession } = require("../electron/indicator/parser");

// Feeds bytes one at a time, in one lump, and in odd-sized chunks: a correct parser gives
// the same readings however the serial driver happens to deliver them.
function readAllWays(profile, bytes) {
  const results = [];
  for (const chunking of [1, bytes.length, 5]) {
    const s = new IndicatorSession(profile);
    const got = [];
    s.on("reading", (r) => got.push(r.weight));
    for (let i = 0; i < bytes.length; i += chunking) s.feed(Buffer.from(bytes.slice(i, i + chunking), "latin1"));
    results.push(got);
  }
  assert.deepEqual(results[1], results[0], "one lump vs byte-by-byte");
  assert.deepEqual(results[2], results[0], "chunks of 5 vs byte-by-byte");
  return results[0];
}

test("control-character escapes round-trip", () => {
  assert.equal(unescapeCtl("<STX>12\\x41\\r\\n<ETX>"), "\x0212A\r\n\x03");
  assert.equal(escapeCtl("\x02001230\r"), "<STX>001230<CR>");
});

test("Qt default: STX + 6 digits + CR, the frame the Simulate button sends", () => {
  const p = buildProfile("qt-default");
  assert.deepEqual(readAllWays(p, "\x02001230\r\x02012500\r"), [1230, 12500]);
});

test("Qt default: STX arriving in the same read as the digits (the case Qt drops)", () => {
  const p = buildProfile("qt-default");
  const s = new IndicatorSession(p);
  const got = [];
  s.on("reading", (r) => got.push(r.weight));
  s.feed(Buffer.from("\x02001230\r", "latin1"));
  assert.deepEqual(got, [1230]);
});

test("Qt default: garbage and a cut-off frame before a good one", () => {
  const p = buildProfile("qt-default");
  assert.deepEqual(readAllWays(p, "xx\x0200\x02004560\r\r\n"), [4560]);
});

test("generic ASCII line with sign, unit and CRLF", () => {
  const p = buildProfile("ascii-line");
  assert.deepEqual(readAllWays(p, "  +012340 kg\r\n-000150kg\r\nGS  25.5 t\r\n"), [12340, -150, 25500]);
});

test("thousand separators and decimal comma", () => {
  assert.equal(decodeFrame("1,234 kg", buildProfile("ascii-line")).weight, 1234);
  assert.equal(decodeFrame("12,5", buildProfile("ascii-line", { decimalComma: true, resolution: 0.1 })).weight, 12.5);
});

test("implied decimals, multiplier and resolution", () => {
  assert.equal(decodeFrame("\x0212345", buildProfile("ascii-line", { impliedDecimals: 1, resolution: 0 })).weight, 1234.5);
  assert.equal(decodeFrame("1234", buildProfile("ascii-line", { multiplier: 10 })).weight, 12340);
  assert.equal(decodeFrame("12347", buildProfile("ascii-line", { resolution: 10 })).weight, 12350);
});

test("Yaohua / Keli '=' format with reversed digits", () => {
  const p = buildProfile("yaohua-reversed", { resolution: 0 });
  // 1250.0 kg is sent as "=0.05210", -12.5 as "=5.21000-"
  assert.deepEqual(readAllWays(p, "=0.05210=0.05210=5.21000-="), [1250, 1250, -12.5]);
});

test("Yaohua tf=0: STX sign 6 digits decimals XOR ETX", () => {
  const p = buildProfile("yaohua-tf0", { resolution: 0 });
  assert.deepEqual(readAllWays(p, "\x02+0125000AB\x03\x02-0001502CD\x03"), [12500, -1.5]);
});

test("Mettler Toledo continuous: decimal code, sign, motion", () => {
  const p = buildProfile("toledo-continuous", { resolution: 0 });
  // SWA 0x22 = decimal code 2 (no decimals), SWB 0x30 = kg, stable; weight 012340, tare 000000
  const stable = "\x02\x22\x30\x20012340000000\r";
  // SWB 0x3A = kg + negative + motion
  const moving = "\x02\x22\x3A\x20000150000000\r";
  // SWA 0x23 = one decimal: 012345 → 1234.5
  const decimal = "\x02\x23\x30\x20012345000000\r\x55";
  assert.deepEqual(readAllWays(p, stable + moving + decimal), [12340, -150, 1234.5]);

  const s = new IndicatorSession(p);
  const flags = [];
  s.on("reading", (r) => flags.push(r.stable));
  s.feed(Buffer.from(moving + stable, "latin1"));
  assert.deepEqual(flags, [false, true], "indicator's motion bit decides stability");
});

test("Mettler Toledo on a port wrongly set to 8 bits still decodes", () => {
  const p = buildProfile("toledo-continuous");
  const withParityBit = "\x02\xA2\xB0\xA0" + Array.from("012340000000").map((c) => String.fromCharCode(c.charCodeAt(0) | 0x80)).join("") + "\r";
  assert.equal(decodeFrame(withParityBit.slice(1, -1), p).weight, 12340);
});

test("MT-SICS polled answer, stable and dynamic", () => {
  const p = buildProfile("mt-sics");
  assert.deepEqual(decodeFrame("S S      12340 kg", p), { weight: 12340, unit: "kg", stable: true, overload: false });
  assert.equal(decodeFrame("S D      12300 kg", p).stable, false);
  assert.equal(decodeFrame("ES", p), null);
});

test("A&D header format", () => {
  const p = buildProfile("and-st-gs");
  assert.deepEqual(decodeFrame("ST,GS,+012340kg", p), { weight: 12340, unit: "kg", stable: true, overload: false });
  assert.equal(decodeFrame("US,GS,+012300kg", p).stable, false);
  assert.equal(decodeFrame("OL,GS,+999999kg", p).overload, true);
});

test("SMA polled answer", () => {
  const p = buildProfile("sma-polled");
  // status, range, gross, motion, future, then the weight and unit
  assert.deepEqual(readAllWays(p, "\n 1G     12340.0kg \r\n 1G M   12360.0kg \r"), [12340, 12360]);
  assert.equal(decodeFrame(" 1GM    12340.0kg ", p).stable, false);
  assert.equal(decodeFrame("O1G     99999.0kg ", p).overload, true);
});

test("unit conversion to kg", () => {
  const p = buildProfile("ascii-line");
  assert.equal(decodeFrame("12.34 t", p).weight, 12340);
  assert.equal(decodeFrame("1000 lb", p).weight, 454);
  assert.equal(decodeFrame("1000 lb", buildProfile("ascii-line", { resolution: 0 })).weight, 453.592);
  assert.equal(decodeFrame("1000", buildProfile("ascii-line", { unit: "t" })).weight, 1000000);
});

test("stability by repetition when the indicator doesn't say", () => {
  const p = buildProfile("qt-default", { stableCount: 3, stableToleranceKg: 20 });
  const s = new IndicatorSession(p);
  const flags = [];
  s.on("reading", (r) => flags.push(r.stable));
  s.feed(Buffer.from("\x02012000\r\x02012500\r\x02012510\r\x02012490\r\x02012600\r", "latin1"));
  assert.deepEqual(flags, [false, false, false, true, false]);
});

test("bridge engaged: once above 500 kg, re-armed only at 0 (Qt rule)", () => {
  const p = buildProfile("qt-default");
  const s = new IndicatorSession(p);
  const engaged = [];
  s.on("engage", (e) => engaged.push(e.weight));
  s.feed(Buffer.from(["000100", "000600", "012000", "000300", "000000", "000900"].map((w) => "\x02" + w + "\r").join(""), "latin1"));
  assert.deepEqual(engaged, [600, 900]);
});

test("no-signal watchdog", () => {
  let t = 0;
  const s = new IndicatorSession(buildProfile("qt-default"), { now: () => t });
  const sig = [];
  s.on("signal", (e) => sig.push(e.ok));
  s.feed(Buffer.from("\x02000100\r", "latin1"));
  t = 5000;
  s.tick();
  s.tick();
  assert.deepEqual(sig, [true, false]);
});

test("frames that don't decode are reported for the monitor, not as weights", () => {
  const s = new IndicatorSession(buildProfile("qt-default"));
  const frames = [];
  const weights = [];
  s.on("frame", (f) => frames.push(f.ok));
  s.on("reading", (r) => weights.push(r.weight));
  s.feed(Buffer.from("\x02ERR\r\x02000500\r", "latin1"));
  assert.deepEqual(frames, [false, true]);
  assert.deepEqual(weights, [500]);
});

test("fixed-length framing", () => {
  const f = new FrameSplitter({ type: "fixed", start: "<STX>", length: 6 });
  assert.deepEqual(f.push("zz\x02001230\x020045"), ["001230"]);
  assert.deepEqual(f.push("60"), ["004560"]);
});

test("runaway input without delimiters doesn't grow the buffer forever", () => {
  const f = new FrameSplitter({ type: "delimited", start: "", end: "<CR>" });
  f.push("9".repeat(10000));
  assert.ok(f.buf.length <= 4096);
});

test("every preset builds and has a decoder", () => {
  for (const preset of PRESETS) {
    const p = buildProfile(preset.id);
    assert.ok(p.frame && p.decode && p.transport.baudRate, preset.id);
  }
});
