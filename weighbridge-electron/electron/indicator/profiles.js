// Indicator profiles: everything that differs between weighbridge indicator makes lives
// in one plain JSON-able object, so a new model is commissioned on site from the
// Settings screen (or by importing a profile file) without a new build.
//
// A profile has four parts:
//   transport  how bytes arrive: a serial port, or a TCP socket (serial-to-Ethernet
//              converters and network indicators)
//   poll       optional: a command the indicator needs before it answers
//   frame      how the byte stream is cut into messages
//   decode     how the weight, unit, sign and stable flag are read out of one message
//
// Control characters are written with escapes so they survive JSON and text boxes:
// \x02, \r, \n, \t, or the names <STX> <ETX> <CR> <LF> <ENQ> <ACK> <NUL> <ESC>.

const NAMED = {
  NUL: "\x00", SOH: "\x01", STX: "\x02", ETX: "\x03", EOT: "\x04", ENQ: "\x05",
  ACK: "\x06", CR: "\r", LF: "\n", ESC: "\x1b", NAK: "\x15", SP: " ",
};

// "<STX>\\x41\\r" → "\x02A\r". Unknown escapes are left as typed.
function unescapeCtl(s) {
  if (typeof s !== "string" || !s) return "";
  return s
    .replace(/<([A-Z]{2,3})>/g, (m, n) => (NAMED[n] !== undefined ? NAMED[n] : m))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

// The reverse, for showing raw bytes and for writing presets readably.
function escapeCtl(s) {
  const names = Object.fromEntries(Object.entries(NAMED).filter(([k]) => k !== "SP").map(([k, v]) => [v, k]));
  let out = "";
  for (const ch of String(s || "")) {
    const c = ch.charCodeAt(0);
    if (names[ch]) out += `<${names[ch]}>`;
    else if (c < 0x20 || c >= 0x7f) out += "\\x" + c.toString(16).padStart(2, "0").toUpperCase();
    else out += ch;
  }
  return out;
}

const SERIAL_DEFAULTS = {
  type: "serial",
  path: "COM1",
  baudRate: 9600,
  dataBits: 8,
  parity: "none",   // none | even | odd | mark | space
  stopBits: 1,      // 1 | 1.5 | 2
  flowControl: "none", // none | hardware (RTS/CTS) | software (XON/XOFF)
  dtr: true,        // some indicators take power or a "ready" signal from DTR/RTS
  rts: true,
  host: "",         // for type "tcp"
  port: 4001,
};

// A plain ASCII number anywhere in the message, with optional sign and unit.
const GENERIC_WEIGHT = "(?<sign>[-+])?\\s*(?<weight>\\d+(?:[.,]\\d+)?)\\s*(?<unit>kg|KG|Kg|t|T|lb|LB|lbs|g)?";

const PRESETS = [
  {
    id: "qt-default",
    name: "Current sites (STX + digits + CR)",
    makes: "What the Qt weighbridge screen reads today: most Indian continuous-output indicators",
    transport: { baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 },
    mode: "continuous",
    frame: { type: "delimited", start: "<STX>", end: "<CR>" },
    decode: { type: "regex", pattern: GENERIC_WEIGHT },
  },
  {
    id: "ascii-line",
    name: "Generic ASCII line (any text ending in CR or LF)",
    makes: "Essae, Leo, Avery, Rice Lake, Cardinal and most indicators in continuous ASCII mode",
    transport: { baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 },
    mode: "continuous",
    frame: { type: "delimited", start: "", end: "<CR>|<LF>" },
    decode: { type: "regex", pattern: GENERIC_WEIGHT },
  },
  {
    id: "yaohua-reversed",
    name: "Yaohua / Keli XK3190 continuous \"=\" (reversed digits)",
    makes: "Yaohua XK3190-A9, A12, A12E, A27E, DS1 (tf=1/2), Keli D2008 and clones",
    transport: { baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 },
    mode: "continuous",
    frame: { type: "delimited", start: "=", end: "=" },
    decode: { type: "regex", pattern: "(?<sign>-)?(?<weight>\\d+(?:\\.\\d+)?)", reverse: true },
  },
  {
    id: "yaohua-tf0",
    name: "Yaohua XK3190 tf=0 (STX sign 6 digits decimals XOR ETX)",
    makes: "Yaohua XK3190-A9/A12/A15 set to continuous format tf=0",
    transport: { baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 },
    mode: "continuous",
    frame: { type: "delimited", start: "<STX>", end: "<ETX>" },
    decode: { type: "fixed", signAt: 0, weightAt: 1, weightLength: 6, decimalsAt: 7 },
  },
  {
    id: "toledo-continuous",
    name: "Mettler Toledo continuous (status bytes)",
    makes: "Mettler Toledo IND131/IND310/IND560/IND570/IND780, Jaguar, 8142 and Toledo-compatible indicators",
    transport: { baudRate: 9600, dataBits: 7, parity: "even", stopBits: 1 },
    mode: "continuous",
    // STX, 3 status bytes, 6 weight digits, 6 tare digits, CR, optional checksum.
    frame: { type: "delimited", start: "<STX>", end: "<CR>" },
    decode: { type: "toledo", unitFromStatus: false },
  },
  {
    id: "mt-sics",
    name: "Mettler Toledo MT-SICS (polled, SI command)",
    makes: "Mettler Toledo indicators and terminals with MT-SICS",
    transport: { baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 },
    mode: "poll",
    poll: { command: "SI<CR><LF>", intervalMs: 300 },
    frame: { type: "delimited", start: "", end: "<CR><LF>" },
    decode: {
      type: "regex",
      pattern: "^S\\s+(?<status>[SD])\\s+(?<sign>-)?\\s*(?<weight>\\d+(?:\\.\\d+)?)\\s*(?<unit>kg|t|lb|g)?",
      stablePattern: "^S$",
      motionPattern: "^D$",
    },
  },
  {
    id: "and-st-gs",
    name: "A&D / header format (ST,GS,+001234kg)",
    makes: "A&D AD-4402/AD-4406/AD-4407, Avery Weigh-Tronix, Essae and others using ST/US/OL headers",
    transport: { baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 },
    mode: "continuous",
    frame: { type: "delimited", start: "", end: "<CR><LF>" },
    decode: {
      type: "regex",
      pattern: "(?<status>ST|US|OL|QT|WT)\\s*,\\s*(?:GS|NT|TR|G|N)?\\s*,?\\s*(?<sign>[-+])?\\s*(?<weight>\\d+(?:\\.\\d+)?)\\s*(?<unit>kg|t|lb|g)?",
      stablePattern: "^(ST|QT)$",
      motionPattern: "^US$",
      overloadPattern: "^OL$",
    },
  },
  {
    id: "sma-polled",
    name: "SMA standard (polled W<CR>)",
    makes: "Indicators following the SMA scale protocol: Rice Lake, Cardinal, Fairbanks, Avery",
    transport: { baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 },
    mode: "poll",
    poll: { command: "W<CR>", intervalMs: 300 },
    frame: { type: "delimited", start: "<LF>", end: "<CR>" },
    decode: {
      // <LF> s r n m f xxxxxx.xxx uuu <CR>: s = scale status (Z zero, O overload, E error,
      // space ok), r = range, n = gross/net, m = motion (M) or space, f = future use.
      type: "regex",
      pattern: "^(?<over>.)(?:.)(?:.)(?<status>.)(?:.)\\s*(?<sign>-)?\\s*(?<weight>\\d+(?:\\.\\d+)?)\\s*(?<unit>kg|lb|t|g)?",
      stablePattern: "^ $",
      motionPattern: "^M$",
      overloadPattern: "^O$",
    },
  },
  {
    id: "custom",
    name: "Custom (set every field yourself)",
    makes: "Any other indicator: use the raw data monitor to work out its format",
    transport: { baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1 },
    mode: "continuous",
    frame: { type: "delimited", start: "", end: "<CR>|<LF>" },
    decode: { type: "regex", pattern: GENERIC_WEIGHT },
  },
];

// Settings that apply after decoding, whatever the indicator.
const COMMON_DEFAULTS = {
  unit: "kg",              // unit to assume when the message carries none
  impliedDecimals: 0,      // "001234" with 1 implied decimal → 123.4
  decimalComma: false,     // "123,4" means 123.4
  multiplier: 1,           // extra scaling, e.g. 10 for an indicator that reports in 10 kg
  resolution: 1,           // round the kg value to this step (1, 5, 10, 20 kg)
  stableCount: 3,          // readings in a row within tolerance count as stable
  stableToleranceKg: 0,
  zeroBandKg: 0,           // |weight| at or below this counts as an empty bridge
  engageThresholdKg: 500,  // Qt sends "bridge engaged" the first time weight exceeds 500 kg
  noSignalMs: 3000,        // no valid reading for this long → "No signal"
};

function presetById(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}

// A full profile from a preset plus whatever the site overrode.
function buildProfile(presetId, overrides = {}) {
  const p = presetById(presetId);
  const o = overrides || {};
  return {
    presetId: p.id,
    name: o.name || p.name,
    transport: { ...SERIAL_DEFAULTS, ...p.transport, ...(o.transport || {}) },
    mode: o.mode || p.mode,
    poll: { command: "", intervalMs: 500, ...(p.poll || {}), ...(o.poll || {}) },
    frame: { ...p.frame, ...(o.frame || {}) },
    decode: { ...p.decode, ...(o.decode || {}) },
    ...COMMON_DEFAULTS,
    ...pick(p, Object.keys(COMMON_DEFAULTS)),
    ...pick(o, Object.keys(COMMON_DEFAULTS)),
  };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") out[k] = obj[k];
  return out;
}

module.exports = {
  PRESETS,
  SERIAL_DEFAULTS,
  COMMON_DEFAULTS,
  GENERIC_WEIGHT,
  presetById,
  buildProfile,
  unescapeCtl,
  escapeCtl,
};
