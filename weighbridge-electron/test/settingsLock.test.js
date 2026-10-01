const test = require("node:test");
const assert = require("node:assert/strict");
const { Store } = require("../electron/store");
const { SettingsLock } = require("../electron/settingsLock");

// A server that keeps one PC's opening like WbTerminalStore does.
function fakeServer({ installed = true } = {}) {
  const srv = { installed, unlocked: false, unlockedAt: null, calls: [], down: false };
  srv.checkin = async (body) => {
    srv.calls.push(body);
    if (srv.down) throw new Error("offline");
    if (!srv.installed) return { installed: false, settingsUnlocked: false };
    if (body.settingsUsed && srv.unlocked && body.settingsUsed === srv.unlockedAt) srv.unlocked = false;
    return { installed: true, settingsUnlocked: srv.unlocked, unlockedAt: srv.unlockedAt, unlockedBy: srv.unlocked ? "hcadmin" : null };
  };
  srv.open = (at) => { srv.unlocked = true; srv.unlockedAt = at; };
  return srv;
}

// A restart: same database, new SettingsLock.
const restart = (store, srv) => new SettingsLock(store, { checkin: srv.checkin, info: () => ({ branchCode: "WB1" }) });

test("a new PC stays open until its first save, then locks from the next start", async () => {
  const store = new Store(":memory:");
  const srv = fakeServer();
  let lock = restart(store, srv);
  await lock.refresh();
  assert.equal(lock.locked(), false);
  lock.require();
  lock.saved();
  assert.equal(lock.locked(), false, "the run that saved stays open");
  assert.equal(lock.state().locksOnRestart, true);
  lock = restart(store, srv);
  await lock.refresh();
  assert.equal(lock.locked(), true);
  assert.throws(() => lock.require(), /locked/);
  assert.ok(srv.calls[0].terminalId);
  assert.equal(srv.calls.at(-1).terminalId, srv.calls[0].terminalId, "the PC keeps its id");
});

test("the web admin opens it; saving and restarting locks it again", async () => {
  const store = new Store(":memory:");
  const srv = fakeServer();
  let lock = restart(store, srv);
  lock.saved();
  lock = restart(store, srv);
  await lock.refresh();
  assert.equal(lock.locked(), true);
  srv.open("2026-10-01 10:00:00.123");
  await lock.refresh();
  assert.equal(lock.locked(), false, "opens without a restart");
  assert.equal(lock.state().unlockedBy, "hcadmin");
  lock.saved();
  await lock.refresh();
  assert.equal(srv.unlocked, false, "the server closed the opening");
  assert.equal(srv.calls.some((c) => c.settingsUsed === "2026-10-01 10:00:00.123"), true);
  assert.equal(lock.locked(), false, "still open for this run");
  lock = restart(store, srv);
  await lock.refresh();
  assert.equal(lock.locked(), true);
});

test("an opening used offline is reported later, and a newer opening is kept", async () => {
  const store = new Store(":memory:");
  const srv = fakeServer();
  let lock = restart(store, srv);
  lock.saved();
  srv.open("2026-10-01 10:00:00.0");
  lock = restart(store, srv);
  await lock.refresh();
  assert.equal(lock.locked(), false);
  srv.down = true;
  lock.saved();
  await lock.refresh();
  lock = restart(store, srv);
  await lock.refresh();
  assert.equal(lock.locked(), true, "offline, the used opening stays closed on the PC");
  // the admin opens it again before the PC is back online
  srv.open("2026-10-01 11:00:00.0");
  srv.down = false;
  await lock.refresh();
  assert.equal(srv.calls.at(-1).settingsUsed, "2026-10-01 10:00:00.0");
  assert.equal(srv.unlocked, true, "the newer opening is not closed by the old report");
  assert.equal(lock.locked(), false);
  await lock.refresh();
  assert.equal(srv.calls.at(-1).settingsUsed, undefined, "reported once");
});

test("never locks against a server without the feature", async () => {
  const store = new Store(":memory:");
  const srv = fakeServer({ installed: false });
  let lock = restart(store, srv);
  lock.saved();
  lock = restart(store, srv);
  await lock.refresh();
  assert.equal(lock.locked(), false);
  // never heard from a server at all
  const s2 = new Store(":memory:");
  const down = fakeServer();
  down.down = true;
  lock = restart(s2, down);
  lock.saved();
  lock = restart(s2, down);
  await lock.refresh();
  assert.equal(lock.locked(), false);
});

test("a PC set up before the lock existed counts as set up", async () => {
  const store = new Store(":memory:");
  store.setSetting("indicator", { presetId: "qt-default", overrides: {} });
  const srv = fakeServer();
  const lock = restart(store, srv);
  await lock.refresh();
  assert.equal(lock.locked(), true);
});
