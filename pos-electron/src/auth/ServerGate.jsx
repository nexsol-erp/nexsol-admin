import React, { useEffect, useState } from "react";
import { Alert } from "antd";
import { ServerSetupPage } from "./ServerSetup";
import { confirmServer, switchServer, hostOf } from "./serverSwitch";
import { log, warn } from "../utils/logger";

/**
 * Makes sure the POS knows its server before anything else renders.
 *  - Never-used PC with no server from the launcher: show the "Connect to server" screen.
 *  - PC already in use on the default server (older install): confirm that server silently.
 *  - Launcher passed a different server, or the current server says it has moved: switch,
 *    unless bills or transfers are still waiting to sync, in which case keep the current
 *    server and say why (the switch is retried on the next start).
 */
export default function ServerGate({ children }) {
  const state = window.POS?.serverState;
  const [needsSetup] = useState(
    () => !!state && !state.confirmed && !localStorage.getItem("tenancyId")
  );
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!state || needsSetup) return;
    let cancelled = false;

    const tryMove = async (config, why) => {
      log("serverGate:", why, "->", config.apiServer);
      const res = await switchServer(config);
      if (cancelled || res.ok) return;
      const target = hostOf(config.apiServer);
      if (res.unsynced > 0) {
        setNotice(`This POS is moving to ${target}. ${res.unsynced} bill(s) or stock transfer(s) must sync to ` +
          `${hostOf(state.apiServer)} first; the move happens on the next start after they sync.`);
      } else {
        setNotice(`This POS should move to ${target}, but it couldn't switch: ` +
          (res.error || "couldn't check for bills waiting to sync") + ".");
      }
    };

    (async () => {
      if (!state.confirmed) {
        // In use on the build default before server choice existed: keep it, silently.
        await confirmServer({ apiServer: state.apiServer, wsServer: state.wsServer, aiServer: state.aiServer });
        return;
      }
      if (state.pendingSwitch) {
        const res = await window.POS.server.check(state.pendingSwitch);
        if (cancelled) return;
        if (res?.ok) await tryMove(res.config, "launcher asked for another server");
        else warn("serverGate: launcher's server did not answer:", res?.error);
        return;
      }
      if (navigator.onLine) {
        const moved = await window.POS.server.checkMoved();
        if (!cancelled && moved) await tryMove(moved, "server has moved");
      }
    })();

    return () => { cancelled = true; };
  }, [state, needsSetup]);

  if (needsSetup) return <ServerSetupPage suggestion={state.apiServer} />;

  return (
    <>
      {notice && (
        <Alert type="warning" showIcon banner closable message={notice} onClose={() => setNotice("")}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10000 }} />
      )}
      {children}
    </>
  );
}
