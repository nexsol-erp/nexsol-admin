# TradeLink247 Weighbridge

Windows desktop app for the weighbridge PC. It reads the live weight from the indicator,
works out the charge, prints the weighment voucher and uploads every weighing to the
TradeLink247 server. It replaces the weighbridge screen of the old Qt app and keeps its rules:

- A new weighing is charged the newest rate for the wheel type (Rates tab).
- Using a previous weighing that was not a return (`round_trip = 0`) is free: the vehicle is
  coming back to be weighed the other way. Using one that was already a return, or a tare
  weight, is charged in full.
- Saving a return marks the vehicle's other open weighings closed, so a first weighing can be
  returned free only once.
- Once a vehicle has a wheel type (from a weighing or tare here, or on the server from any
  branch), the operator can't pick another. It is changed only in the web admin's Vehicle Wheel
  Type screen; the app picks the change up when the vehicle is next entered, or within ten minutes.
- Voucher numbers are 6 digits and continue from the branch's last voucher on the server.

Everything is saved on the PC first (SQLite in `%APPDATA%\TradeLink247 Weighbridge`) and uploaded
in the background, so the counter keeps working when the internet is down. The sync badge in the
header shows what is still waiting to upload. Resync Records in the web admin can ask the PC to
upload a day again.

## Install

Download the installer from the web admin's Downloads page (`/api/updates/weighbridge/download`),
run it, enter the server address, sign in and pick the branch. The first sign-in pulls the rates,
the last voucher number and the branch's recent weighings and tare weights.

## Updates

The app checks the server for a newer version when it starts and every four hours. A newer
installer downloads in the background; a bar then offers **Restart to update**, and otherwise it
installs silently when the app is closed. Weighings, settings and the indicator setup are kept.
Settings > Branch & data has **Check for updates**. PCs installed for all users may show a Windows
permission prompt during the update. Versions before 1.0.2 don't check, so install 1.0.2 by hand once.

## Commissioning an indicator

All indicator handling is configuration, in Settings > Indicator (admins only):

1. **Preset.** Pick the closest one. Every field it fills can then be changed.

   | Preset | Typical makes |
   | --- | --- |
   | Current sites (STX + digits + CR) | What the Qt app read: most Indian continuous-output indicators |
   | Generic ASCII line | Essae, Leo, Avery, Rice Lake, Cardinal in continuous ASCII mode |
   | Yaohua / Keli "=" reversed digits | Yaohua XK3190-A9/A12/A12E/A27E/DS1, Keli D2008 and clones |
   | Yaohua tf=0 | Yaohua XK3190 set to continuous format tf=0 |
   | Mettler Toledo continuous | IND131/310/560/570/780, Jaguar, 8142 and Toledo-compatible (7E1) |
   | Mettler Toledo MT-SICS | Polled with `SI` |
   | A&D header format | `ST,GS,+001234kg` style: A&D AD-4402/4406/4407 and others |
   | SMA standard | Polled with `W<CR>` |
   | Custom | Anything else |

2. **Connection.** Serial (COM port, baud, data bits, parity, stop bits, DTR/RTS) or network
   (IP and port of a serial-to-Ethernet converter or a networked indicator). The app reconnects on
   its own every few seconds if the cable or network drops.
3. **Output mode.** Continuous (the indicator streams) or polled (the app sends a command, such as
   `SI<CR><LF>` or `W<CR>`, on a timer).
4. **Framing.** Start and end markers (`<STX>`, `<ETX>`, `<CR>`, `<LF>`, `=`, `\x02` …; use `|`
   for alternatives such as `<CR>|<LF>`) or a fixed message length.
5. **Decoder.**
   - *Pattern*: a regular expression with a `(?<weight>…)` group and optional `sign`, `unit`,
     `status` and `over` groups. Stable, moving and overload are matched on `status` or `over`.
     *Digits sent reversed* handles indicators that send the least significant digit first.
   - *Fixed positions*: sign, weight and decimals at fixed offsets.
   - *Toledo status bytes*: reads decimals, sign, motion and overload from the three status bytes.
6. **After decoding.** Unit when none is sent, implied decimals, decimal comma, multiplier,
   rounding, readings needed for stable and their tolerance, empty-bridge band, the weight that
   counts as a vehicle on the bridge (Weight-Count report), and how long before "No signal".

Turn on **Show live data** to see exactly what the indicator sends; lines the current settings
cannot read are marked BAD. Paste a message into **Test** to try settings before saving. A working
setup can be exported to a file and imported on other PCs with the same indicator.

Save is blocked unless the reading is fresh, stable (can be turned off in Settings > Weighing),
not overloaded and above the empty-bridge band.

## Printing

Settings > Printing: printer, paper (A5 or 80 mm roll), copies, header lines and footer. Every
voucher is also saved as a PDF under `Documents\TradeLink247 Weighbridge\Vouchers`. Reprint is on
the Weighing tab and the Daily Report.

## Development

```bash
npm install
npm test          # parser, charging rule, local store and sync (node ABI better-sqlite3)
npm run dev       # Vite on :5174 + Electron
npm run dist:win  # NSIS installer in release/
```

`npm test` needs better-sqlite3 built for Node; `electron .` needs it built for Electron. After
`npm run dist:win` or `electron-builder install-app-deps`, run `npm rebuild better-sqlite3` before
testing again.

CI (`.github/workflows/weighbridge.yml`) tests pull requests, and on main builds the installer on
Windows and publishes it to `/home/deploy/tradelink-pos/weighbridge` with `latest.txt` last. The
backend serves it from `weighbridge.app.dir`. Bump `version` in package.json for each release.
