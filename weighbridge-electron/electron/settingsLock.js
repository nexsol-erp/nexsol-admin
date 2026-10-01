// Locks the Settings tab once the PC is set up. The first save in Settings (indicator, printing,
// weighing, a branch change) marks the PC as set up; Settings stay open for the rest of that run
// and are locked from the next start. Only the web admin (Weighbridge PCs) opens them again.
// That opening lasts until Settings are saved on the PC and the app is restarted: the PC reports
// the save, and the server closes the opening.
//
// The lock applies only once the server has said it supports it (V078), so a PC is never locked
// with no way to open it. Offline, the last answer from the server stands.
//
// Rates have their own switch (V079): the Rates tab is view only unless the web admin has allowed
// rate changes on this PC. It stays as the web admin left it; a save doesn't close it.

const { EventEmitter } = require("events");
const crypto = require("crypto");
const { ValidationError } = require("./store");

const KEY = "settingsLock";

class SettingsLock extends EventEmitter {
  // checkin(body) -> server reply { installed, settingsUnlocked, unlockedAt, unlockedBy }
  constructor(store, { checkin, info = () => ({}), log = () => {} }) {
    super();
    this.store = store;
    this.checkin = checkin;
    this.info = info;
    this.log = log;
    this.savedThisRun = false;
    this.busy = null;
    if (!store.getSetting("terminalId", "")) store.setSetting("terminalId", crypto.randomUUID());
    const s = store.getSetting(KEY, null);
    if (!s) {
      // PCs set up before the lock existed: an indicator or weighing setup counts as set up.
      const setUp = !!(store.getSetting("indicator", null) || store.getSetting("weighing", null));
      this._save({ setupDone: setUp, serverSupports: false, unlocked: false, unlockedAt: null, unlockedBy: null, usedUnlockAt: null });
    }
  }

  get terminalId() { return this.store.getSetting("terminalId", ""); }

  _get() { return this.store.getSetting(KEY, {}) || {}; }
  _save(s) { this.store.setSetting(KEY, s); }

  locked() {
    const s = this._get();
    return !this.savedThisRun && !!s.setupDone && !!s.serverSupports && !s.unlocked;
  }

  state() {
    const s = this._get();
    return {
      locked: this.locked(),
      terminalId: this.terminalId,
      setupDone: !!s.setupDone,
      serverSupports: !!s.serverSupports,
      unlocked: !!s.unlocked,
      unlockedBy: s.unlockedBy || null,
      // open now only because something was saved this run: locks at the next start
      locksOnRestart: this.savedThisRun && !!s.serverSupports && !s.unlocked,
      // rates are managed from the web admin (V079); ratesUnlocked = this PC may change them
      ratesManaged: this._ratesManaged(),
      ratesUnlocked: !!s.ratesUnlocked,
    };
  }

  _ratesManaged() {
    const s = this._get();
    return !!s.serverSupports && !!s.ratesSupported;
  }

  // May this PC change rates? Servers without V079 keep the old rule: admins only.
  ratesAllowed(isAdmin) {
    return this._ratesManaged() ? !!this._get().ratesUnlocked : !!isAdmin;
  }

  requireRates(isAdmin) {
    if (this.ratesAllowed(isAdmin)) return;
    throw new ValidationError(this._ratesManaged()
      ? "Rates are locked on this PC. Change them in the web admin (Weighbridge Rates), or ask an admin to allow rate changes here."
      : "Only an admin can change this");
  }

  // Throws when Settings may not be changed now.
  require() {
    if (this.locked()) throw new ValidationError("Settings are locked. Ask an admin to allow changes in the web admin (Weighbridge PCs).");
  }

  // A Settings save went through: the PC is set up, and an opening from the web is used up.
  saved() {
    const s = this._get();
    const next = { ...s, setupDone: true };
    if (s.unlocked) {
      next.unlocked = false;
      next.usedUnlockAt = s.unlockedAt || "";
    }
    this.savedThisRun = true;
    this._save(next);
    this._emit();
    if (next.usedUnlockAt) this.refresh().catch(() => {});
  }

  // Asks the server; resolves to the state. Errors (offline, signed out, older server) keep the last answer.
  refresh() {
    if (this.busy) return this.busy;
    this.busy = (async () => {
      const sent = this._get().usedUnlockAt || null;
      try {
        const r = await this.checkin({ terminalId: this.terminalId, ...this.info(), settingsUsed: sent || undefined });
        const s = this._get();
        const pending = s.usedUnlockAt || null;
        const next = { ...s };
        if (r && r.installed === false) {
          next.serverSupports = false;
          next.unlocked = false;
          next.ratesSupported = false;
          next.ratesUnlocked = false;
        } else if (r) {
          next.ratesSupported = !!r.ratesSupported;
          next.ratesUnlocked = !!r.ratesUnlocked;
          next.serverSupports = true;
          // an opening this PC has already used stays closed, whatever an earlier reply said
          next.unlocked = !!r.settingsUnlocked && !(pending && pending === r.unlockedAt);
          next.unlockedAt = r.unlockedAt || null;
          next.unlockedBy = r.unlockedBy || null;
        }
        if (sent && pending === sent) next.usedUnlockAt = null;
        this._save(next);
      } catch (e) {
        this.log("WARN", "terminal check-in", e.message);
      } finally {
        this.busy = null;
      }
      this._emit();
      return this.state();
    })();
    return this.busy;
  }

  _emit() { this.emit("state", this.state()); }
}

module.exports = { SettingsLock };
