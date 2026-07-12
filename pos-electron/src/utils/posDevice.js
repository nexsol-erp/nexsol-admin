import { apiUrl } from "./apiUrl";

const DEVICE_KEY_STORAGE = "posDeviceKey";

// ─── Device identity ──────────────────────────────────────────────────────────

/**
 * Returns the permanent UUID for this POS installation.
 *
 * Electron path: stored in app.getPath('userData')/device.key via IPC so it
 * survives localStorage clears (reinstalls, clearing browser storage, etc.).
 * Browser/dev fallback: localStorage only.
 */
async function getOrCreateDeviceKey() {
  if (window.POS?.getDeviceKey) {
    let key = await window.POS.getDeviceKey();
    if (key) {
      localStorage.setItem(DEVICE_KEY_STORAGE, key);
      return key;
    }
    // Not in file yet — migrate from localStorage or generate new
    key = localStorage.getItem(DEVICE_KEY_STORAGE) || crypto.randomUUID();
    await window.POS.setDeviceKey(key);
    localStorage.setItem(DEVICE_KEY_STORAGE, key);
    return key;
  }

  // Browser / dev fallback
  let key = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY_STORAGE, key);
  }
  return key;
}

// ─── Machine registration ─────────────────────────────────────────────────────

/**
 * Registers this machine with the server for the given branch (idempotent —
 * safe to call on every login / poll).
 *
 * Returns the server response, or null on network failure.
 *
 * Response.status:
 *   "PENDING"  — awaiting admin approval; POS must show a blocking screen.
 *   "REJECTED" — admin rejected this device; POS must show an error screen.
 *   "APPROVED" — normal operation; machineCode + FY data are populated.
 */
export async function registerMachine(tenantId, branchCode, machineName = "") {
  const token     = localStorage.getItem("jwtToken") || "";
  const deviceKey = await getOrCreateDeviceKey();

  try {
    const res = await fetch(apiUrl(`/api/${tenantId}/pos-machines/register`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ branchCode, deviceKey, machineName }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Always persist status and machineId so the UI can display them
    if (data.status)    localStorage.setItem(`posMachineStatus_${branchCode}`, data.status);
    if (data.machineId) localStorage.setItem(`posMachineId_${branchCode}`,     data.machineId);

    if (data.status !== "APPROVED") return data; // PENDING or REJECTED — stop here

    // Approved — persist FY + machine details for offline use
    if (data.machineCode)         localStorage.setItem(`posMachineCode_${branchCode}`,  data.machineCode);
    if (data.branchInvoicePrefix) localStorage.setItem(`posBranchPrefix_${branchCode}`, data.branchInvoicePrefix);
    if (data.fyCode)              localStorage.setItem(`posFyCode_${branchCode}`,        data.fyCode);
    if (data.fyStartDate)         localStorage.setItem(`posFyStart_${branchCode}`,       data.fyStartDate);
    if (data.fyEndDate)           localStorage.setItem(`posFyEnd_${branchCode}`,         data.fyEndDate);

    const seqKey   = `posSeq_${branchCode}_${data.machineCode}_${data.fyCode}`;
    const localSeq = parseInt(localStorage.getItem(seqKey) || "0", 10);
    if (localSeq === 0 && data.lastSequence > 0) {
      localStorage.setItem(seqKey, String(data.lastSequence));
    }

    return data;
  } catch {
    return null;
  }
}

// ─── Machine selection helpers ────────────────────────────────────────────────

/**
 * Returns all APPROVED machines for a branch so a pending terminal can pick one.
 */
export async function fetchApprovedMachines(tenantId, branchCode) {
  const token = localStorage.getItem("jwtToken") || "";
  try {
    const res = await fetch(
      apiUrl(`/api/${tenantId}/pos-machines/approved?branchCode=${encodeURIComponent(branchCode)}`),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Claims an existing APPROVED machine code for this terminal.
 * The device_key on that machine record is updated to point at this terminal.
 * On success, persists all FY + machine data exactly like registerMachine does.
 */
export async function claimMachine(tenantId, branchCode, machineCode) {
  const token     = localStorage.getItem("jwtToken") || "";
  const deviceKey = await getOrCreateDeviceKey();

  try {
    const res = await fetch(apiUrl(`/api/${tenantId}/pos-machines/claim`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ branchCode, machineCode, deviceKey }),
    });
    if (!res.ok) {
      try { const err = await res.json(); console.error("[claimMachine]", err?.error || res.status); } catch {}
      return null;
    }
    const data = await res.json();
    if (data.error) { console.error("[claimMachine]", data.error); return null; }

    // Persist exactly like an APPROVED register response
    localStorage.setItem(`posMachineStatus_${branchCode}`, "APPROVED");
    localStorage.setItem(`posMachineId_${branchCode}`,     data.machineId   || "");
    localStorage.setItem(`posMachineCode_${branchCode}`,   data.machineCode || machineCode);
    if (data.branchInvoicePrefix) localStorage.setItem(`posBranchPrefix_${branchCode}`, data.branchInvoicePrefix);
    if (data.fyCode)              localStorage.setItem(`posFyCode_${branchCode}`,        data.fyCode);
    if (data.fyStartDate)         localStorage.setItem(`posFyStart_${branchCode}`,       data.fyStartDate);
    if (data.fyEndDate)           localStorage.setItem(`posFyEnd_${branchCode}`,         data.fyEndDate);

    const seqKey   = `posSeq_${branchCode}_${data.machineCode}_${data.fyCode}`;
    const localSeq = parseInt(localStorage.getItem(seqKey) || "0", 10);
    if (localSeq === 0 && data.lastSequence > 0) {
      localStorage.setItem(seqKey, String(data.lastSequence));
    }
    return data;
  } catch {
    return null;
  }
}

// ─── Voucher number generation ────────────────────────────────────────────────

function resolvedFyCode(branchCode) {
  const raw    = localStorage.getItem(`posFyCode_${branchCode}`);
  const fyCode = (raw && raw !== "null") ? raw : "00-00";
  const fyEnd  = localStorage.getItem(`posFyEnd_${branchCode}`);
  if (fyEnd && new Date() > new Date(fyEnd + "T23:59:59")) {
    return fyCode + "_NEXT";
  }
  return fyCode;
}

function compactFy(fyCode) {
  return fyCode.replace(/-/g, "").slice(-4) || fyCode;
}

/**
 * Generates the next unique voucher number for the given branch.
 * Format: {prefix}/{fyShort}/{machineCode}/{seqNo padded to 6}
 * Example: HQ/2526/M01/000042
 */
export function generateVoucherNumber(branchCode) {
  const machineCode = localStorage.getItem(`posMachineCode_${branchCode}`) || "M00";
  const prefix      = localStorage.getItem(`posBranchPrefix_${branchCode}`) || branchCode || "POS";
  const fyCode      = resolvedFyCode(branchCode);
  const fyShort     = compactFy(fyCode);

  const seqKey  = `posSeq_${branchCode}_${machineCode}_${fyCode}`;
  const current = parseInt(localStorage.getItem(seqKey) || "0", 10);
  const next    = current + 1;
  localStorage.setItem(seqKey, String(next));

  return {
    voucherNumber: `${prefix}/${fyShort}/${machineCode}/${String(next).padStart(6, "0")}`,
    numericSeq:    next,
  };
}

/**
 * Generates the next unique voucher number for a stock transfer.
 * Format: ST/{fyShort}/{machineCode}/{seqNo padded to 6}
 * Example: ST/2526/M01/000007
 */
export function generateTransferVoucherNumber(branchCode) {
  const machineCode = localStorage.getItem(`posMachineCode_${branchCode}`) || "M00";
  const fyCode      = resolvedFyCode(branchCode);
  const fyShort     = compactFy(fyCode);

  const seqKey  = `stSeq_${branchCode}_${machineCode}_${fyCode}`;
  const current = parseInt(localStorage.getItem(seqKey) || "0", 10);
  const next    = current + 1;
  localStorage.setItem(seqKey, String(next));

  return {
    voucherNumber: `ST/${fyShort}/${machineCode}/${String(next).padStart(6, "0")}`,
    numericSeq:    next,
  };
}

/** Returns the stored machine info for a branch (for display / debugging). */
export function getMachineInfo(branchCode) {
  return {
    machineCode:         localStorage.getItem(`posMachineCode_${branchCode}`)  || "",
    branchInvoicePrefix: localStorage.getItem(`posBranchPrefix_${branchCode}`) || "",
    fyCode:              localStorage.getItem(`posFyCode_${branchCode}`)        || "",
    fyStart:             localStorage.getItem(`posFyStart_${branchCode}`)       || "",
    fyEnd:               localStorage.getItem(`posFyEnd_${branchCode}`)         || "",
    status:              localStorage.getItem(`posMachineStatus_${branchCode}`) || "APPROVED",
  };
}
