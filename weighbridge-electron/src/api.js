// window.WB (preload.js) wrapped so screens can await a value or catch an Error.
export async function wb(method, arg) {
  if (!window.WB || typeof window.WB[method] !== "function") throw new Error("Run this inside the Weighbridge app");
  const res = await window.WB[method](arg);
  if (!res || res.ok === false) throw new Error(res?.error || "Something went wrong");
  return res;
}

export const pad2 = (n) => String(n).padStart(2, "0");

// Local "yyyy-MM-dd HH:mm:ss", matching how the app stores dates.
export function stamp(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function showDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(s || "");
}

export function kg(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}
