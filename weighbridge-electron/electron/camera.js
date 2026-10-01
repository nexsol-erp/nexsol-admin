// Weighbridge camera: a photo is taken when a weighing is saved and kept with it, on the PC
// (<userData>/photos/<yyyy-MM>/) and, once the weighing has uploaded, on the server.
//
// Two kinds of camera:
//   webcam  a USB / built-in camera. The Weighing screen shows it live and grabs the frame
//           at the moment of saving (renderer, canvas → JPEG), sent with the save.
//   url     an IP camera's snapshot address (http://…/snapshot.jpg). The main process
//           fetches one JPEG at the moment of saving. user:password@ in the address is sent
//           as basic auth.

const path = require("path");
const fs = require("fs");

const DEFAULT_CAMERA = { source: "none", deviceId: "", deviceLabel: "", url: "" };
const MAX_PHOTO_BYTES = 1500 * 1024;

const isJpeg = (b) => Buffer.isBuffer(b) && b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

// "data:image/jpeg;base64,…" or bare base64 → Buffer, or null when it isn't a usable JPEG.
function jpegFromDataUrl(s) {
  if (!s || typeof s !== "string") return null;
  const b64 = s.startsWith("data:") ? s.slice(s.indexOf(",") + 1) : s;
  if (b64.length > MAX_PHOTO_BYTES * 1.4) return null;
  const buf = Buffer.from(b64, "base64");
  return isJpeg(buf) && buf.length <= MAX_PHOTO_BYTES ? buf : null;
}

// One JPEG from an IP camera snapshot address. Throws with a short reason.
async function fetchSnapshot(url, fetchImpl, timeoutMs = 4000) {
  let u;
  try { u = new URL(String(url || "").trim()); } catch (_) { throw new Error("The camera address is not valid"); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("The camera address must start with http:// or https://");
  const headers = {};
  if (u.username || u.password) {
    headers.Authorization = "Basic " + Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64");
    u.username = "";
    u.password = "";
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(u.toString(), { headers, signal: ctl.signal });
    if (!res.ok) throw new Error(`The camera answered HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isJpeg(buf)) throw new Error("The camera did not send a JPEG picture");
    if (buf.length > MAX_PHOTO_BYTES) throw new Error("The camera picture is too large");
    return buf;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The camera did not answer in time");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Writes the photo next to the others of its month; returns the file path.
function savePhoto(dir, row, buf) {
  const month = String(row.voucher_date || "").slice(0, 7) || new Date().toISOString().slice(0, 7);
  const folder = path.join(dir, month);
  fs.mkdirSync(folder, { recursive: true });
  const safe = (s) => String(s || "").replace(/[^A-Za-z0-9_-]/g, "");
  const file = path.join(folder, `${safe(row.voucher_number) || "WB"}_${safe(row.vehicle_number)}_${safe(row.id).slice(0, 8)}.jpg`);
  fs.writeFileSync(file, buf);
  return file;
}

module.exports = { DEFAULT_CAMERA, MAX_PHOTO_BYTES, jpegFromDataUrl, fetchSnapshot, savePhoto, isJpeg };
