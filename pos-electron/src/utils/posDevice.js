import { apiUrl } from "./apiUrl";

const DEVICE_KEY_STORAGE = "posDeviceKey";

// ─── Device identity ──────────────────────────────────────────────────────────

/**
 * Returns a permanent UUID for this POS installation.
 * Created once on first run and kept in localStorage forever.
 * Survives logins/logouts; identifies the physical machine to the server.
 */
export function getOrCreateDeviceKey() {
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
 * safe to call on every login). Persists the assigned machineCode, branch
 * invoice prefix, and active FY boundaries to localStorage for offline use.
 *
 * Returns the server response object, or null if the call fails (network down,
 * no FY configured, etc.). Offline sales still work using the last persisted
 * machineCode; the server will reject or accept based on FY config at sync time.
 */
export async function registerMachine(tenantId, branchCode, machineName = "") {
  const token    = localStorage.getItem("jwtToken") || "";
  const deviceKey = getOrCreateDeviceKey();

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

    // Persist all fields keyed by branch so a multi-branch setup works correctly
    localStorage.setItem(`posMachineCode_${branchCode}`,    data.machineCode);
    localStorage.setItem(`posBranchPrefix_${branchCode}`,   data.branchInvoicePrefix);
    localStorage.setItem(`posFyCode_${branchCode}`,         data.fyCode);
    localStorage.setItem(`posFyStart_${branchCode}`,        data.fyStartDate);   // "YYYY-MM-DD"
    localStorage.setItem(`posFyEnd_${branchCode}`,          data.fyEndDate);     // "YYYY-MM-DD"

    // Sync sequence counter from server if no local counter exists.
    // This covers: new install, localStorage cleared, machine replacement.
    // We never overwrite an existing local counter — the local value is always
    // >= the server value (sales may not have synced yet).
    const seqKey = `posSeq_${branchCode}_${data.machineCode}_${data.fyCode}`;
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

/**
 * Returns the active financial year code for the branch.
 * If today is past the stored FY end date, appends "_NEXT" so the sequence
 * key differs from the expired FY — preventing stale numbers after a rollover
 * until the machine re-registers and gets the new FY from the server.
 */
function resolvedFyCode(branchCode) {
  const fyCode = localStorage.getItem(`posFyCode_${branchCode}`) || "00-00";
  const fyEnd  = localStorage.getItem(`posFyEnd_${branchCode}`);
  if (fyEnd && new Date() > new Date(fyEnd + "T23:59:59")) {
    return fyCode + "_NEXT";   // distinct key → sequence restarts until re-registration
  }
  return fyCode;
}

/**
 * Converts a full FY code like "2025-26" to the compact 4-char form "2526"
 * used inside voucher numbers.
 */
function compactFy(fyCode) {
  // "2025-26" → "202526" → last 4 chars → "2526"
  return fyCode.replace(/-/g, "").slice(-4) || fyCode;
}

/**
 * Generates the next unique voucher number for the given branch and
 * atomically increments the local counter.
 *
 * Format:  {branchInvoicePrefix}/{fyShort}/{machineCode}/{seqNo padded to 6}
 * Example: HQ/2526/M01/000042
 *
 * The FY short code is embedded so the same sequence number in different
 * financial years produces a different string — making a DB-level unique
 * constraint on (branch_code, voucher_number) safe to apply.
 *
 * Uniqueness scope: branch × FY × machine.
 * Sequence resets to 1 each new financial year.
 *
 * Returns { voucherNumber: string, numericSeq: number }
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
 * Generates the next unique voucher number for a stock transfer from the given
 * branch. Uses its own counter key (stSeq_…) so the sequence is independent
 * of POS invoices but follows the same format.
 *
 * Format:  ST/{fyShort}/{machineCode}/{seqNo padded to 6}
 * Example: ST/2526/M01/000007
 *
 * Returns { voucherNumber: string, numericSeq: number }
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

/**
 * Returns the stored machine info for a branch (for display / debugging).
 */
export function getMachineInfo(branchCode) {
  return {
    machineCode:         localStorage.getItem(`posMachineCode_${branchCode}`)  || "",
    branchInvoicePrefix: localStorage.getItem(`posBranchPrefix_${branchCode}`) || "",
    fyCode:              localStorage.getItem(`posFyCode_${branchCode}`)        || "",
    fyStart:             localStorage.getItem(`posFyStart_${branchCode}`)       || "",
    fyEnd:               localStorage.getItem(`posFyEnd_${branchCode}`)         || "",
  };
}
