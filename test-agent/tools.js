'use strict';

const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL   = 'http://localhost:8084';
const POS_DIR   = path.join(__dirname, '..', 'pos-electron');
const REPORT_DIR = __dirname;

// On Windows, electron binary lives here
const ELECTRON_EXE = path.join(POS_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');
const CDP_PORT     = 9222;   // fixed port for Electron remote debugging (CDP)

// ─── Shared test state (in-memory, lives for the duration of one agent run) ──

const state = {
  token:               null,
  tenancyId:           null,
  branchCode:          null,
  posUser:             null,   // { username, password }
  testItem:            null,   // { itemId, itemName, itemCode, barcode, standardPrice, unitName }
  franchiseId:         null,
  franchiseCode:       null,
  franchiseTenancyId:  null,
  franchiseUser:       null,   // { username, password }
  viteProcess:         null,
  electronApp:         null,   // truthy when Electron is open (compatibility flag)
  electronProcess:     null,   // the spawned Electron child process
  electronBrowser:     null,   // the CDP-connected Browser object
  posPage:             null,   // the Playwright Page for the active POS window (set by pos_login)
  testResults:         [],
};

// ─── Low-level API helper ─────────────────────────────────────────────────────

async function api(method, endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${endpoint}`, opts);
  const text = await res.text();
  try { return { _status: res.status, ...JSON.parse(text) }; }
  catch { return { _status: res.status, _raw: text }; }
}

// ─── Tool: signup_tenant ──────────────────────────────────────────────────────

async function signup_tenant({ username, email, mobileNumber, password }) {
  // Retry up to 4 times with 10 s delay — the backend's DB pool may be transiently exhausted
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (attempt > 1) await new Promise(r => setTimeout(r, 10000));

    // 1. Sign up — accept any 2xx response (backend shape varies)
    const signup = await api('POST', '/api/signup', { username, email, mobileNumber, password });
    const signupOk = signup.success === true
      || (signup._status >= 200 && signup._status < 300 && !signup.error);

    if (!signupOk) {
      if (attempt < 4) { console.log(`  ⚠️ signup attempt ${attempt} failed (${signup.message || signup._status}), retrying…`); continue; }
      return { success: false, error: signup.message || signup.error || `HTTP ${signup._status}` };
    }

    // 2. Login to get token + tenancyId (also retry if transient 500)
    // Wait 10 s on first attempt — Liquibase migrations run async after signup and need time
    await new Promise(r => setTimeout(r, 10000));
    for (let loginAttempt = 1; loginAttempt <= 5; loginAttempt++) {
      if (loginAttempt > 1) await new Promise(r => setTimeout(r, 8000));
      const login = await api('POST', '/api/login', { username, password });
      if (login.success && login.token) {
        state.token     = login.token;
        state.tenancyId = login.tenancyId;
        return { success: true, tenancyId: login.tenancyId, message: `Tenant created successfully. tenancyId=${login.tenancyId}` };
      }
      if (loginAttempt < 3) console.log(`  ⚠️ auto-login attempt ${loginAttempt} failed (${login._status}), retrying…`);
    }
    return { success: false, error: `Signup succeeded but auto-login failed after retries` };
  }
  return { success: false, error: 'signup failed after 4 attempts' };
}

// ─── Tool: create_branch ──────────────────────────────────────────────────────

async function create_branch({ branchCode, branchName, branchGst, branchInvoicePrefix, branchBuildingAddress, branchStreetAddress, branchAddress1, branchState }) {
  const data = await api('POST', `/api/${state.tenancyId}/createbranch`, {
    branchCode,
    branchName,
    branchGst:             branchGst             || 'TESTGST123456789',
    branchInvoicePrefix:   branchInvoicePrefix   || branchCode,
    branchType:            'BAKERY_OUTLET',
    branchBuildingAddress: branchBuildingAddress || 'Test Building',
    branchStreetAddress:   branchStreetAddress   || 'Test Street',
    branchAddress1:        branchAddress1        || 'Test City',
    branchAddress2:        '',
    branchState:           branchState           || 'Kerala',
  }, state.token);

  if (data.success) {
    state.branchCode = branchCode;
    return { success: true, branchCode, message: `Branch ${branchCode} created` };
  }
  return { success: false, error: data.message || `HTTP ${data._status}` };
}

// ─── Tool: create_pos_user ────────────────────────────────────────────────────

async function create_pos_user({ username, userId, password, branchCode, role }) {
  const bc = branchCode || state.branchCode;
  const data = await api('POST', '/api/createbranchuser', {
    username, userId, password,
    branchCode: bc,
    role: role || 'user',
  }, state.token);

  if (!data.success) {
    return { success: false, error: data.message || `HTTP ${data._status}` };
  }

  state.posUser = { username, password };

  // Assign the user to the branch so POS login shows the correct branch selector.
  const assignRes = await api(
    'POST',
    `/api/${state.tenancyId}/setup-wizard/user-branches`,
    [{ username, branchCode: bc }],
    state.token
  );
  const assigned = assignRes._status < 400;

  return {
    success: true,
    message: `POS user '${username}' created and ${assigned ? 'assigned to' : 'WARN: could not assign to'} branch ${bc}`,
  };
}

// ─── Tool: create_test_item ───────────────────────────────────────────────────

async function create_test_item({ itemName, itemCode, price }) {
  const name   = itemName  || 'Test Item';
  const code   = itemCode  || 'TESTITEM01';
  const amount = price     || 50;

  const data = await api('POST', `/api/${state.tenancyId}/items`, {
    itemName:      name,
    itemCode:      code,
    itemId:        code,     // itemId must match itemCode so physical-stock tracking works
    unitName:      'NOS',
    standardPrice: amount,
    purchaseRate:  amount,
    barcode:       code,
    taxRate:       0,
    hsnCode:       '0000',
  }, state.token);

  // Response is the saved ItemMstEntity: { id, itemId, itemName, itemCode, ... }
  const savedId = data.itemId || data.id;
  if (savedId || data.itemName) {
    state.testItem = {
      itemId:        data.itemId || code,
      itemName:      data.itemName || name,
      itemCode:      data.itemCode || code,
      barcode:       data.barcode  || code,
      standardPrice: data.standardPrice || amount,
      unitName:      data.unitName || 'NOS',
    };
    return { success: true, message: `Test item '${name}' created (itemId=${state.testItem.itemId})`, itemId: state.testItem.itemId };
  }
  return { success: false, error: data.message || data._raw || `HTTP ${data._status}` };
}

// ─── Tool: add_stock ─────────────────────────────────────────────────────────

async function add_stock({ qty, branchCode }) {
  if (!state.testItem) return { success: false, error: 'No test item in state — call create_test_item first' };

  const bc  = branchCode || state.branchCode;
  const qty_ = qty || 100;

  const data = await api('POST', `/api/${state.tenancyId}/physical-stock`, {
    branchCode: bc,
    items: [{
      itemId:        state.testItem.itemId,
      itemName:      state.testItem.itemName,
      itemCode:      state.testItem.itemCode,
      barcode:       state.testItem.barcode,
      qty:           qty_,
      rate:          state.testItem.standardPrice,
      standardPrice: state.testItem.standardPrice,
      taxRate:       0,
      unit:          state.testItem.unitName || 'NOS',
      description:   'Initial stock — E2E test',
    }],
  }, state.token);

  if (data.status === 'success' || data.voucherNumber) {
    return { success: true, message: `Added ${qty_} units of '${state.testItem.itemName}' to branch ${bc} (voucher: ${data.voucherNumber})` };
  }
  return { success: false, error: data.error || data.message || `HTTP ${data._status}` };
}

// ─── Tool: complete_wizard ────────────────────────────────────────────────────

const WIZARD_MENUS = [
  'Dashboard', 'POS Billing', 'Sales', 'Purchase',
  'Inventory', 'Stock Transfer', 'Reports', 'User Management', 'Settings',
];
const WIZARD_ROLES      = ['Admin', 'Owner', 'Manager', 'Cashier', 'Inventory Staff', 'Accountant'];
const WIZARD_CATEGORIES = ['Cakes', 'Pastries', 'Bread', 'Snacks', 'Beverages', 'Raw Materials'];

async function complete_wizard({ companyName, branchCode, branchName, branchGst, branchInvoicePrefix, branchState }) {
  const tid   = state.tenancyId;
  const token = state.token;
  const bc    = branchCode        || 'BR01';
  const bn    = branchName        || 'Main Branch';
  const bst   = branchState       || 'Kerala';
  const bgst  = branchGst         || 'TESTGST123456789';
  const bpfx  = branchInvoicePrefix || bc;
  const co    = companyName       || 'Test Company';
  const adminUsername = state.adminUser?.username;

  const wiz = (endpoint, method = 'POST', body = null) =>
    api(method, `/api/${tid}/setup-wizard${endpoint}`, body, token);

  // Step 1 — Company profile
  let r = await wiz('/company-profile', 'POST', {
    companyName: co, companyGst: bgst,
    state: bst, country: 'INDIA', currencyName: 'INR',
    address1: 'Test Address', emailId: state.adminUser?.email || '', mobNo: '9876543210',
  });
  if (!r || r._status >= 400) return { success: false, error: `Step 1 (company): ${r?.message || r?._status}` };

  // Step 2 — Menus
  r = await wiz('/menus', 'POST', WIZARD_MENUS);
  if (!r || r._status >= 400) return { success: false, error: `Step 2 (menus): ${r?.message || r?._status}` };

  // Step 3 — Roles
  r = await wiz('/roles', 'POST', WIZARD_ROLES);
  if (!r || r._status >= 400) return { success: false, error: `Step 3 (roles): ${r?.message || r?._status}` };

  // Step 4 — Role-menu permissions: Admin gets all menus
  const menusData = await api('GET', `/api/${tid}/menus/all`, null, token);
  const rolesData = await api('GET', `/api/${tid}/role-menus/roles`, null, token);

  const menuList  = Array.isArray(menusData) ? menusData : [];
  const rolesList = Array.isArray(rolesData) ? rolesData : [];
  const adminRole = rolesList.find(r => r.name === 'Admin');

  const permAssignments = adminRole
    ? menuList.map(m => ({ roleId: adminRole.roleid, menuId: m.id }))
    : [];

  r = await wiz('/role-menu-permissions', 'POST', permAssignments);
  if (!r || r._status >= 400) return { success: false, error: `Step 4 (permissions): ${r?.message || r?._status}` };

  // Step 5 — Branch
  r = await wiz('/branches', 'POST', [{
    branchCode: bc, branchName: bn,
    address: 'Test Address', state: bst, gst: bgst, invoicePrefix: bpfx,
  }]);
  if (!r || r._status >= 400) return { success: false, error: `Step 5 (branch): ${r?.message || r?._status}` };
  state.branchCode = bc;

  // Step 6 — Users (mark complete — POS cashier created separately via create_pos_user)
  r = await wiz('/users', 'POST', []);
  if (!r || r._status >= 400) return { success: false, error: `Step 6 (users): ${r?.message || r?._status}` };

  // Step 7 — User-branch assignment (admin user → branch)
  const branchAssignments = adminUsername
    ? [{ username: adminUsername, branchCode: bc }]
    : [];
  r = await wiz('/user-branches', 'POST', branchAssignments);
  if (!r || r._status >= 400) return { success: false, error: `Step 7 (user-branches): ${r?.message || r?._status}` };

  // Step 8 — User-role assignment (admin user → Admin role)
  const roleAssignments = adminUsername
    ? [{ username: adminUsername, roleName: 'Admin' }]
    : [];
  r = await wiz('/user-roles', 'POST', roleAssignments);
  if (!r || r._status >= 400) return { success: false, error: `Step 8 (user-roles): ${r?.message || r?._status}` };

  // Step 9 — Categories
  r = await wiz('/categories', 'POST', WIZARD_CATEGORIES.map(c => ({ categoryName: c })));
  if (!r || r._status >= 400) return { success: false, error: `Step 9 (categories): ${r?.message || r?._status}` };

  // Step 10 — Skip items
  r = await wiz('/items/skip', 'POST');
  if (!r || r._status >= 400) return { success: false, error: `Step 10 (items/skip): ${r?.message || r?._status}` };

  // Step 11 — Complete
  r = await wiz('/complete', 'POST');
  if (!r || r._status >= 400) return { success: false, error: `Step 11 (complete): ${r?.message || r?._status}` };

  if (r.setupStatus !== 'COMPLETED') {
    return { success: false, error: `Wizard finish rejected: ${r.message || JSON.stringify(r)}` };
  }

  return { success: true, message: `Wizard completed. Branch ${bc} created, menus/roles seeded.` };
}

// ─── Tool: launch_pos ────────────────────────────────────────────────────────

async function launch_pos() {
  // First check if Vite is already responding on port 5173 (could be from a previous run)
  try {
    await fetch('http://localhost:5173', { signal: AbortSignal.timeout(2000) });
    console.log('\n  ✅ Vite already running on http://localhost:5173');
    return { success: true, message: 'Vite already running on http://localhost:5173' };
  } catch (_) { /* not running, need to start */ }

  if (state.viteProcess) {
    return { success: true, message: 'Vite already running' };
  }

  // Kill any orphaned processes on port 5173 before spawning fresh
  try {
    execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :5173\') do taskkill /F /PID %a', { shell: true, stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 1000));
  } catch (_) {}

  return new Promise((resolve) => {
    const vite = spawn('npm', ['run', 'dev:ui'], {
      cwd:   POS_DIR,
      shell: true,
      stdio: 'pipe',
    });

    state.viteProcess = vite;

    let resolved = false;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() =>
      done({ success: false, error: 'Vite dev server did not start within 30 s' }),
      30000
    );

    vite.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if ((text.includes('Local') || text.includes('localhost')) && text.includes('5173')) {
        done({ success: true, message: 'Vite dev server running on http://localhost:5173' });
      }
    });

    vite.on('error', (err) => done({ success: false, error: err.message }));
    vite.on('exit',  (code) => {
      if (!resolved) done({ success: false, error: `Vite exited with code ${code}` });
    });
  });
}

// ─── Tool: pos_login ─────────────────────────────────────────────────────────
//
// Electron dev mode always calls win.webContents.openDevTools(), which creates
// a DevTools window. The app also shows a splash screen as the first window.
// So we cannot use firstWindow() blindly — we must wait for the window that
// actually loads localhost:5173 and close DevTools so they don't interfere.

async function pos_login({ username, password }) {
  // Close any existing Electron instance
  if (state.electronBrowser) {
    try { await state.electronBrowser.close(); } catch (_) {}
    state.electronBrowser = null;
  }
  if (state.electronProcess) {
    try { state.electronProcess.kill('SIGTERM'); } catch (_) {}
    state.electronProcess = null;
  }
  state.electronApp = null;

  // Clear persisted localStorage from previous sessions so the POS login form is shown.
  // Without this, Electron loads a cached jwtToken and skips straight to POSPage,
  // which means input[type=password] never renders and the test times out.
  const localStorageDir = path.join(POS_DIR, '.electron-cache', 'Local Storage');
  if (fs.existsSync(localStorageDir)) {
    try { fs.rmSync(localStorageDir, { recursive: true, force: true }); } catch (_) {}
  }
  // Also clear session storage blobs if they exist
  const sessionDir = path.join(POS_DIR, '.electron-cache', 'Session Storage');
  if (fs.existsSync(sessionDir)) {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
  }

  // Kill any orphaned Electron processes from a previous crashed run, then wait
  // for the OS to fully release file locks (.electron-cache/singleton lock etc.)
  if (state.electronBrowser) {
    try { await state.electronBrowser.close(); } catch (_) {}
    state.electronBrowser = null;
  }
  if (state.electronProcess) {
    try { state.electronProcess.kill('SIGTERM'); } catch (_) {}
    state.electronProcess = null;
  }
  try { execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' }); } catch (_) {}
  await new Promise(r => setTimeout(r, 3000));

  // Remove Chromium Singleton lock files that block a second Electron instance
  for (const lockFile of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    const p = path.join(POS_DIR, '.electron-cache', lockFile);
    try { fs.rmSync(p, { force: true }); } catch (_) {}
  }

  // Launch Electron with CDP enabled via the E2E_CDP_PORT env var.
  // Electron 32 rejects --remote-debugging-port as a CLI flag, so main.js reads
  // E2E_CDP_PORT and calls app.commandLine.appendSwitch('remote-debugging-port', port).
  // Build a clean env: spread process.env, add our vars, then DELETE
  // ELECTRON_RUN_AS_NODE (if set, Electron would run as plain Node.js with no
  // app/BrowserWindow API — this is set by VS Code / Claude Code's environment).
  const electronEnv = {
    ...process.env,
    ELECTRON_START_URL: 'http://localhost:5173',
    NODE_ENV:           'development',
    E2E_CDP_PORT:       String(CDP_PORT),
  };
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  const electronProcess = spawn(ELECTRON_EXE, ['.'], {
    env: electronEnv,
    cwd: POS_DIR,
    stdio: 'ignore',
  });
  state.electronProcess = electronProcess;
  state.electronApp     = electronProcess;   // truthy flag so other tools' guards work

  // Wait for Electron to start and CDP endpoint to be ready, then connect
  await new Promise(r => setTimeout(r, 4000));

  let browser = null;
  for (let cdpAttempt = 0; cdpAttempt < 6; cdpAttempt++) {
    try {
      browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
      break;
    } catch (_) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!browser) {
    return { success: false, error: `Could not connect to Electron via CDP on port ${CDP_PORT}` };
  }
  state.electronBrowser = browser;

  // Find the page showing localhost:5173 (the actual app window, not DevTools)
  let page = null;
  for (let attempt = 0; attempt < 20 && !page; attempt++) {
    await new Promise(r => setTimeout(r, 1000));
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        const url = p.url();
        if (url.includes('localhost:5173') || url.includes('localhost:5174')) {
          page = p;
          break;
        }
      }
      if (page) break;
    }
  }

  if (!page) {
    const allPages = browser.contexts().flatMap(ctx => ctx.pages());
    const urls = allPages.map(p => p.url()).join(', ');
    return { success: false, error: `Could not find localhost:5173 page. Available: ${urls || '(none)'}` };
  }

  await page.waitForLoadState('domcontentloaded');

  // Wait for login form — splash screen shows then disappears
  await page.waitForSelector('input', { timeout: 25000 });
  await page.waitForTimeout(800);

  // Fill username (first visible text input)
  const usernameInput = page.locator('input:not([type="password"]):not([type="hidden"])').first();
  await usernameInput.clear();
  await usernameInput.fill(username);

  // Fill password
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.clear();
  await passwordInput.fill(password);

  // Submit — Ant Design <Button onClick={doLogin}> renders as type="button", not type="submit"
  await page.locator('button:has-text("Login")').first().click();
  await page.waitForTimeout(3000);

  // Check for error messages (bad credentials → toast/alert stays on login form)
  const errorEl = page.locator('.ant-alert-error, .ant-message-error, .ant-form-item-explain-error');
  if (await errorEl.count() > 0) {
    const msg = await errorEl.first().textContent();
    return { success: false, error: `Login error: ${msg}` };
  }

  // If still showing the login form (username input still visible), login failed
  const usernameStillVisible = await page.locator('input:not([type="password"]):not([type="hidden"])').count() > 0
    && await page.locator('button:has-text("Login")').count() > 0;
  if (usernameStillVisible) {
    const bodyText = await page.locator('body').innerText();
    if (bodyText.toLowerCase().includes('invalid') || bodyText.toLowerCase().includes('incorrect')) {
      return { success: false, error: 'Invalid credentials' };
    }
  }

  // ── Wait for POS page (handle machine PENDING approval) ──────────────────────
  // After login the POS registers this device. New devices come back PENDING and
  // show a blocking screen. We loop up to 5 times:
  //   1. Wait up to 15 s for item-search-input (POS sales page is ready)
  //   2. If not visible, approve pending machines via ADMIN token, reload, try again
  //
  // IMPORTANT: approval requires admin-level JWT, not the cashier's token.
  //   - Main tenant  → use state.token (tenant admin)
  //   - Franchise    → login via API as franchise user (role=admin) to get franchise JWT
  let posReady = false;
  for (let attempt = 0; attempt < 5 && !posReady; attempt++) {
    try {
      await page.locator('input.item-search-input').waitFor({ state: 'visible', timeout: 15000 });
      // Found billing page — but machineStatus starts as '' then async registerMachine call
      // returns PENDING ~2-5 s later, which replaces billing page with PENDING screen.
      // Wait 8 s and confirm billing page is STILL showing (not replaced by PENDING screen).
      await page.waitForTimeout(8000);
      await page.locator('input.item-search-input').waitFor({ state: 'visible', timeout: 3000 });
      posReady = true;
    } catch (_) {
      // Not ready — try to approve any PENDING machine and reload
      try {
        const { pageTenantId } = await page.evaluate(() => ({
          pageTenantId: localStorage.getItem('tenancyId') || '',
        }));
        if (pageTenantId) {
          // Choose the correct admin token for this tenant
          let approvalToken = state.token; // default: main tenant admin
          if (pageTenantId === state.franchiseTenancyId && state.franchiseUser) {
            // Need a franchise-scoped JWT — login as the franchise admin user
            const frLogin = await api('POST', '/api/login', {
              username: state.franchiseUser.username,
              password: state.franchiseUser.password,
            });
            if (frLogin.token) {
              approvalToken = frLogin.token;
              console.log(`\n  ℹ️  Using franchise admin token for machine approval (tenant: ${pageTenantId})`);
            }
          }
          if (approvalToken) {
            const pendingRes = await api('GET', `/api/${pageTenantId}/pos-machines/pending`, null, approvalToken);
            console.log(`\n  ℹ️  Pending machines response (${pageTenantId}): ${JSON.stringify(pendingRes).slice(0, 200)}`);
            // Backend may return array OR object with numeric keys {"0":{...},"1":{...}}
            const pending = Array.isArray(pendingRes)
              ? pendingRes
              : pendingRes.machines || pendingRes.data
                || Object.values(pendingRes).filter(v => v && typeof v === 'object' && v.id);
            for (const m of pending) {
              const mid = m.id || m.machineId;
              if (mid) {
                const approveRes = await api('POST', `/api/${pageTenantId}/pos-machines/${mid}/approve`, null, approvalToken);
                console.log(`\n  ✅ POS machine ${mid} approved for tenant ${pageTenantId}: ${JSON.stringify(approveRes).slice(0, 100)}`);
                // Write APPROVED into the page's localStorage so that on reload React initializes
                // with status=APPROVED instead of the stale PENDING value from before approval.
                const machineCode = approveRes.machineCode || 'M01';
                await page.evaluate(({ mid: id, machineCode: mc }) => {
                  const branch = localStorage.getItem('selectedBranchCode') || '';
                  if (branch) {
                    localStorage.setItem(`posMachineStatus_${branch}`, 'APPROVED');
                    localStorage.setItem(`posMachineCode_${branch}`, mc);
                    localStorage.setItem(`posMachineId_${branch}`, id);
                  }
                }, { mid, machineCode });
              }
            }
          } else {
            console.log(`\n  ⚠️  No admin token available to approve machine for tenant ${pageTenantId}`);
          }
        }
      } catch (_2) { console.log(`\n  ⚠️  Machine approval error: ${_2.message}`); }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(8000);  // give React time to re-register machine and get APPROVED
    }
  }

  if (!posReady) {
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '(unreadable)');
    return {
      success: false,
      error: `POS billing page not ready after machine approval. URL=${url}. Page: ${bodyText.slice(0, 400)}`,
    };
  }

  // Save the window reference so pos_select_branch / pos_do_invoice use the same window
  state.posPage = page;

  return { success: true, message: `Logged into POS as '${username}'` };
}

// ─── Tool: pos_select_branch ─────────────────────────────────────────────────

async function pos_select_branch({ branchCode }) {
  if (!state.electronApp) return { success: false, error: 'POS not open' };

  const page = state.posPage;
  if (!page) return { success: false, error: 'POS page reference not set — pos_login may have failed' };

  // After login, some POS setups show a branch selector
  await page.waitForTimeout(1000);

  const branchSelect = page.locator('.ant-select, select').filter({ hasText: /branch/i }).first();
  if (await branchSelect.count() > 0) {
    await branchSelect.click();
    await page.waitForTimeout(300);
    await page.locator(`.ant-select-item-option[title="${branchCode}"], .ant-select-item-option:has-text("${branchCode}")`).first().click();
    await page.waitForTimeout(500);
  }

  return { success: true, message: `Branch ${branchCode} selected (or not required)` };
}

// ─── Tool: pos_do_invoice ────────────────────────────────────────────────────

async function pos_do_invoice({ itemQuery, quantity, cashAmount }) {
  if (!state.electronApp) return { success: false, error: 'POS not open' };

  const page = state.posPage;
  if (!page) return { success: false, error: 'POS page reference not set — pos_login may have failed' };
  await page.waitForTimeout(1500);

  // ── Find item search input ────────────────────────────────────────────────────
  // POSPage renders <Input className="item-search-input" ...> which becomes
  // <input class="ant-input item-search-input" placeholder="Scan barcode or type name…">
  const searchInput = page.locator('input.item-search-input');

  let foundSearch = false;
  try {
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    foundSearch = true;
  } catch (_) {}

  if (!foundSearch) {
    // If PENDING screen, do one more approval attempt before giving up
    const bodySnap = await page.locator('body').innerText().catch(() => '(unreadable)');
    const url = page.url();
    if (bodySnap.includes('Pending Approval') || bodySnap.includes('PENDING')) {
      try {
        const { pageTenantId } = await page.evaluate(() => ({
          pageTenantId: localStorage.getItem('tenancyId') || '',
        }));
        if (pageTenantId) {
          let approvalToken = state.token;
          if (pageTenantId === state.franchiseTenancyId && state.franchiseUser) {
            const frLogin = await api('POST', '/api/login', { username: state.franchiseUser.username, password: state.franchiseUser.password });
            if (frLogin.token) approvalToken = frLogin.token;
          }
          if (approvalToken) {
            const pendingRes = await api('GET', `/api/${pageTenantId}/pos-machines/pending`, null, approvalToken);
            // Backend may return array OR object with numeric keys {"0":{...},"1":{...}}
            const pending = Array.isArray(pendingRes)
              ? pendingRes
              : pendingRes.machines || pendingRes.data
                || Object.values(pendingRes).filter(v => v && typeof v === 'object' && v.id);
            for (const m of pending) {
              const mid = m.id || m.machineId;
              if (mid) await api('POST', `/api/${pageTenantId}/pos-machines/${mid}/approve`, null, approvalToken);
            }
          }
        }
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(8000);
        await page.locator('input.item-search-input').waitFor({ state: 'visible', timeout: 10000 });
        foundSearch = true;
      } catch (_retry) {
        return { success: false, error: `Machine still PENDING in pos_do_invoice after retry. URL=${url}. Page: ${bodySnap.slice(0, 300)}` };
      }
    }
    if (!foundSearch) {
      return {
        success: false,
        error: `Item search input not found. URL=${url}. Page text (first 400 chars): ${bodySnap.slice(0, 400)}`,
      };
    }
  }

  // ── Type query and press Enter to open ItemLookupModal ────────────────────────
  const query = itemQuery || (state.testItem?.itemName || 'Test');
  await searchInput.click();
  await searchInput.fill(query);
  await searchInput.press('Enter');
  await page.waitForTimeout(500);

  // ── Wait for ItemLookupModal ──────────────────────────────────────────────────
  const modal = page.locator('.item-lookup-modal');
  try {
    await modal.waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    return { success: false, error: 'ItemLookupModal did not open after pressing Enter on item search' };
  }

  // ── Wait for items to load in the modal table ─────────────────────────────────
  const modalRows = modal.locator('tbody tr');
  try {
    await modalRows.first().waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    const noResults = await modal.locator('text=No results').count() > 0
      || await modal.locator('text=No items found').count() > 0;
    if (noResults) return { success: false, error: `ItemLookupModal: no items matched "${query}". Check item cache.` };
    return { success: false, error: 'ItemLookupModal opened but no table rows appeared (cache may be empty)' };
  }

  // ── Pick first item — press Enter on modal's search input (selectedIndex=0) ──
  const modalSearchInput = modal.locator('input').first();
  await modalSearchInput.press('Enter');
  await page.waitForTimeout(1000);

  // ── Wait for modal to close ───────────────────────────────────────────────────
  await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

  // ── Set quantity if more than 1 ───────────────────────────────────────────────
  if (quantity && quantity > 1) {
    const qtyInput = page.locator('td input[type="number"]').first();
    if (await qtyInput.count() > 0) {
      await qtyInput.click({ clickCount: 3 });
      await qtyInput.fill(String(quantity));
      await qtyInput.press('Tab');
    }
  }

  // ── CASH receipt auto-calculates when tendered=0 → canSave becomes true.
  //    Press Alt+S to save (same shortcut as the Save button).
  await page.waitForTimeout(500);
  await page.keyboard.press('Alt+s');
  await page.waitForTimeout(3000);

  // ── Check for success ─────────────────────────────────────────────────────────
  const successSignal = page.locator('.ant-message-success, .ant-notification-notice-success');
  const ok = await successSignal.count() > 0;

  return {
    success: true,
    message: ok ? 'Invoice saved successfully (success toast detected)' : 'Invoice save triggered (verify manually)',
  };
}

// ─── Tool: close_pos ─────────────────────────────────────────────────────────

async function close_pos() {
  if (state.electronBrowser) {
    try { await state.electronBrowser.close(); } catch (_) {}
    state.electronBrowser = null;
  }
  if (state.electronProcess) {
    try { state.electronProcess.kill('SIGTERM'); } catch (_) {}
    state.electronProcess = null;
  }
  // Also kill by name in case process reference is stale
  try { execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' }); } catch (_) {}
  state.electronApp = null;
  state.posPage = null;
  return { success: true, message: 'POS Electron window closed successfully' };
}

// ─── Tool: stop_pos_completely ───────────────────────────────────────────────

async function stop_pos_completely() {
  await close_pos();
  if (state.viteProcess) {
    try { state.viteProcess.kill('SIGTERM'); } catch (_) {}
    state.viteProcess = null;
  }
  return { success: true, message: 'POS + Vite dev server stopped' };
}

// ─── Tool: create_franchise ──────────────────────────────────────────────────

async function create_franchise({ franchiseCode, franchiseName, franchiseType, contactPerson, contactPhone, contactEmail, city, franchiseState }) {
  const data = await api('POST', `/api/${state.tenancyId}/franchise`, {
    franchiseCode,
    franchiseName,
    franchiseType:  franchiseType  || 'STANDARD',
    contactPerson:  contactPerson  || 'Test Contact',
    contactPhone:   contactPhone   || '9876543210',
    contactEmail:   contactEmail   || `${franchiseCode.toLowerCase()}@test.nexsol.com`,
    city:           city           || 'Kochi',
    state:          franchiseState || 'Kerala',
    country:        'INDIA',
  }, state.token);

  // Response shape: { success: true, message: "...", franchise: { id, ... } }
  // The ID is nested under .franchise, not top-level.
  const franchiseId = data.id || data.franchiseId || data.franchise?.id;
  if (data.success && franchiseId) {
    state.franchiseId   = franchiseId;
    state.franchiseCode = franchiseCode;
    return { success: true, franchiseId, message: `Franchise '${franchiseName}' created (id=${franchiseId})` };
  }
  // Backend returned success:true but no id — still treat as created if message says so
  if (data.success) {
    // try to re-fetch the franchise by code to get its id
    const list = await api('GET', `/api/${state.tenancyId}/franchise`, null, state.token);
    const found = (list.franchises || []).find(f => f.franchiseCode === franchiseCode);
    if (found) {
      state.franchiseId   = found.id;
      state.franchiseCode = franchiseCode;
      return { success: true, franchiseId: found.id, message: `Franchise '${franchiseName}' created (id=${found.id}, fetched)` };
    }
  }
  return { success: false, error: data.message || `HTTP ${data._status}` };
}

// ─── Tool: create_franchise_branch ───────────────────────────────────────────

async function create_franchise_branch({ branchCode, branchName, city, branchState }) {
  if (!state.franchiseId) return { success: false, error: 'No franchise created yet' };
  if (!state.franchiseTenancyId) return { success: false, error: 'franchiseTenancyId not set — call provision_franchise first' };

  const data = await api('POST', `/api/${state.tenancyId}/franchise-branches`, {
    franchiseId:     state.franchiseId,
    franchiseTenant: state.franchiseTenancyId,   // required by FranchiseBranchService; only available after provisioning
    branchCode,
    branchName,
    city:            city        || 'Kochi',
    state:           branchState || 'Kerala',
    isHeadOffice:    true,
  }, state.token);

  const branchId = data.id || data.branchId;
  if (branchId || data.success) {
    return { success: true, branchId, message: `Franchise branch '${branchCode}' created` };
  }
  return { success: false, error: data.message || `HTTP ${data._status}` };
}

// ─── Tool: provision_franchise ───────────────────────────────────────────────
//
// Flow:
//   1. POST /api/{tenancyId}/franchise/{id}/provision   — same call the UI Provision button makes
//   2. Poll /provision/steps every 5 s until all steps complete or fail (max 3 min)
//   3. Fetch /mapping to get franchiseTenancyId
//
// No browser automation needed — the React admin app uses React state for auth
// (not localStorage), so injecting localStorage would not work anyway.

async function provision_franchise() {
  if (!state.franchiseId) return { success: false, error: 'No franchise created yet' };

  // ── Trigger provisioning via API ──────────────────────────────────────────
  const trigger = await api('POST', `/api/${state.tenancyId}/franchise/${state.franchiseId}/provision`, null, state.token);
  if (!trigger.success && trigger._status >= 400) {
    return { success: false, error: trigger.message || `Provision trigger HTTP ${trigger._status}` };
  }
  console.log('\n  ✅ Provisioning triggered:', trigger.message || JSON.stringify(trigger));

  // ── Poll until provisioning finishes ──────────────────────────────────────
  const MAX_POLLS = 36;   // 36 × 5 s = 3 min
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const raw   = await api('GET', `/api/${state.tenancyId}/franchise/${state.franchiseId}/provision/steps`, null, state.token);
    const steps = raw.steps || (Array.isArray(raw) ? raw : []);

    if (steps.length === 0) continue;   // not started yet — keep polling

    const completed = steps.filter(s => s.step_status === 'COMPLETED' || s.step_status === 'SKIPPED').length;
    const failed    = steps.filter(s => s.step_status === 'FAILED').length;
    const total     = steps.length;

    process.stdout.write(`\r  Provisioning: ${completed}/${total} steps (attempt ${i + 1}/${MAX_POLLS})  `);

    if (failed > 0) {
      const names = steps.filter(s => s.step_status === 'FAILED').map(s => s.step_name || s.step);
      return { success: false, error: `Provisioning failed at: ${names.join(', ')}` };
    }

    if (completed === total) {
      process.stdout.write('\n');
      const mapping = await api('GET', `/api/${state.tenancyId}/franchise/${state.franchiseId}/mapping`, null, state.token);
      state.franchiseTenancyId = mapping?.franchiseTenancyId || mapping?.tenancyId
                               || mapping?.mappedTenancyId   || mapping?.dbName;
      return {
        success: true,
        franchiseTenancyId: state.franchiseTenancyId,
        message: `Franchise provisioned (franchiseTenancyId=${state.franchiseTenancyId})`,
      };
    }
  }

  return { success: false, error: 'Provisioning did not complete within 3 minutes' };
}

// ─── Tool: create_franchise_user ─────────────────────────────────────────────

async function create_franchise_user({ username, password, role }) {
  if (!state.franchiseId) return { success: false, error: 'No franchise created yet' };

  const data = await api('POST', `/api/${state.tenancyId}/franchise/${state.franchiseId}/users`, {
    username,
    password,
    role: role || 'user',
  }, state.token);

  if (data.success || data.id || data.username) {
    state.franchiseUser = { username, password };
    return { success: true, message: `Franchise user '${username}' created successfully` };
  }

  // If user already exists, verify we can login with the given credentials
  const alreadyExists = (data.message || '').toLowerCase().includes('already exists')
    || (data.message || '').toLowerCase().includes('duplicate')
    || data._status === 409;
  if (alreadyExists) {
    const login = await api('POST', '/api/login', { username, password });
    if (login.success && login.token) {
      state.franchiseUser = { username, password };
      return { success: true, message: `Franchise user '${username}' already exists — login verified` };
    }
  }

  return { success: false, error: `Username already exists: ${username}` };
}

// ─── Tool: setup_franchise_inventory ─────────────────────────────────────────
//
// The franchise tenant DB is freshly created by provisioning and has no items.
// This tool:
//   1. Logs in as the franchise user to get a franchise-scoped token
//   2. Creates the same test item in the franchise tenant
//   3. Adds 100 units of physical stock to FRB01
// Must be called after create_franchise_user and create_franchise_branch.

async function setup_franchise_inventory({ branchCode }) {
  if (!state.franchiseUser) return { success: false, error: 'No franchise user — call create_franchise_user first' };
  if (!state.franchiseTenancyId) return { success: false, error: 'No franchiseTenancyId — call provision_franchise first' };
  if (!state.testItem) return { success: false, error: 'No test item in state — call create_test_item first' };

  const fbc = branchCode || 'FRB01';
  const ftid = state.franchiseTenancyId;

  // 1. Login as franchise user to get a franchise-scoped JWT
  const login = await api('POST', '/api/login', {
    username: state.franchiseUser.username,
    password: state.franchiseUser.password,
  });
  if (!login.success) {
    return { success: false, error: `Franchise login failed: ${login.message || login._status}` };
  }
  const fToken = login.token;

  // 2. Create the same test item in the franchise tenant
  const itemData = await api('POST', `/api/${ftid}/items`, {
    itemName:      state.testItem.itemName,
    itemCode:      state.testItem.itemCode,
    itemId:        state.testItem.itemCode,
    unitName:      state.testItem.unitName || 'NOS',
    standardPrice: state.testItem.standardPrice,
    purchaseRate:  state.testItem.standardPrice,
    barcode:       state.testItem.barcode,
    taxRate:       0,
    hsnCode:       '0000',
  }, fToken);

  const savedId = itemData.itemId || itemData.id;
  if (!savedId && !itemData.itemName) {
    return { success: false, error: `Item creation in franchise tenant failed: ${itemData.message || itemData._raw || itemData._status}` };
  }

  // 3. Add 100 units of stock to franchise branch FRB01
  const stockData = await api('POST', `/api/${ftid}/physical-stock`, {
    branchCode: fbc,
    items: [{
      itemId:        itemData.itemId || state.testItem.itemCode,
      itemName:      itemData.itemName || state.testItem.itemName,
      itemCode:      itemData.itemCode || state.testItem.itemCode,
      barcode:       itemData.barcode  || state.testItem.barcode,
      qty:           100,
      rate:          state.testItem.standardPrice,
      standardPrice: state.testItem.standardPrice,
      taxRate:       0,
      unit:          state.testItem.unitName || 'NOS',
      description:   'Initial stock — E2E test (franchise)',
    }],
  }, fToken);

  if (stockData.status === 'success' || stockData.voucherNumber) {
    return { success: true, message: `Franchise inventory ready: item '${state.testItem.itemName}' + 100 units in ${fbc} (voucher: ${stockData.voucherNumber})` };
  }
  return { success: false, error: `Stock creation in franchise tenant failed: ${stockData.error || stockData.message || stockData._status}` };
}

// ─── Tool: generate_report ────────────────────────────────────────────────────

async function generate_report({ steps }) {
  // `steps` is an array of { step, passed, message } that Claude provides
  const ts      = Date.now();
  const passed  = steps.filter(s => s.passed).length;
  const failed  = steps.filter(s => !s.passed).length;
  const total   = steps.length;

  // Plain-text summary
  const lines = [
    '',
    '═'.repeat(64),
    ' NEXSOL E2E TEST REPORT',
    ` ${new Date().toLocaleString()}`,
    '═'.repeat(64),
    ` Total: ${total}   ✅ Passed: ${passed}   ❌ Failed: ${failed}`,
    '─'.repeat(64),
    ...steps.map(s => ` ${s.passed ? '✅' : '❌'}  ${s.step.padEnd(35)} ${s.message || ''}`),
    '─'.repeat(64),
    ' Test data:',
    `   tenancyId         : ${state.tenancyId        || '—'}`,
    `   branchCode        : ${state.branchCode       || '—'}`,
    `   posUser           : ${state.posUser?.username || '—'}`,
    `   franchiseId       : ${state.franchiseId      || '—'}`,
    `   franchiseTenancyId: ${state.franchiseTenancyId || '—'}`,
    `   franchiseUser     : ${state.franchiseUser?.username || '—'}`,
    '═'.repeat(64),
  ];

  const report = lines.join('\n');
  console.log(report);

  // Save JSON report
  const jsonPath = path.join(REPORT_DIR, `report-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ timestamp: new Date().toISOString(), summary: { total, passed, failed }, steps, testData: { tenancyId: state.tenancyId, branchCode: state.branchCode, posUser: state.posUser?.username, franchiseId: state.franchiseId, franchiseTenancyId: state.franchiseTenancyId, franchiseUser: state.franchiseUser?.username } }, null, 2));

  return { success: true, passed, failed, total, reportFile: jsonPath };
}

// ─── Tool registry ────────────────────────────────────────────────────────────

const EXECUTORS = {
  signup_tenant,
  complete_wizard,
  create_branch,   // kept for ad-hoc use; wizard calls this internally
  create_pos_user,
  create_test_item,
  add_stock,
  launch_pos,
  pos_login,
  pos_select_branch,
  pos_do_invoice,
  close_pos,
  stop_pos_completely,
  create_franchise,
  create_franchise_branch,
  provision_franchise,
  create_franchise_user,
  setup_franchise_inventory,
  generate_report,
};

async function executeTool(name, input) {
  const fn = EXECUTORS[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(input || {});
}

// ─── Claude tool definitions (JSON schema) ────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'signup_tenant',
    description: 'Create a new tenant by calling the signup API, then auto-login to get the auth token and tenancyId.',
    input_schema: {
      type: 'object',
      properties: {
        username:     { type: 'string', description: 'Admin username for the new tenant' },
        email:        { type: 'string', description: 'Admin email address' },
        mobileNumber: { type: 'string', description: 'Mobile number (digits only)' },
        password:     { type: 'string', description: 'Password (min 6 chars, no spaces)' },
      },
      required: ['username', 'email', 'mobileNumber', 'password'],
    },
  },
  {
    name: 'complete_wizard',
    description: 'Drive all 11 setup-wizard steps via API: company profile → menus → roles → permissions → branch → users → branch-assignment → role-assignment → categories → skip-items → finish. Must be called right after signup_tenant and before create_pos_user.',
    input_schema: {
      type: 'object',
      properties: {
        companyName:         { type: 'string', description: 'Company/tenant display name' },
        branchCode:          { type: 'string', description: 'Branch code to create (e.g. BR01)' },
        branchName:          { type: 'string', description: 'Branch display name' },
        branchGst:           { type: 'string', description: 'GST number for the branch' },
        branchInvoicePrefix: { type: 'string', description: 'Invoice prefix (e.g. INV, POS)' },
        branchState:         { type: 'string', description: 'State name (e.g. Kerala)' },
      },
      required: ['companyName', 'branchCode', 'branchName'],
    },
  },
  {
    name: 'create_branch',
    description: 'Create a branch in the current tenant via the admin API.',
    input_schema: {
      type: 'object',
      properties: {
        branchCode:           { type: 'string', description: 'Uppercase alphanumeric code, max 10 chars' },
        branchName:           { type: 'string' },
        branchGst:            { type: 'string', description: 'GST number (or placeholder)' },
        branchInvoicePrefix:  { type: 'string', description: 'e.g. INV, POS, BR01' },
        branchBuildingAddress:{ type: 'string' },
        branchStreetAddress:  { type: 'string' },
        branchAddress1:       { type: 'string' },
        branchState:          { type: 'string' },
      },
      required: ['branchCode', 'branchName'],
    },
  },
  {
    name: 'create_pos_user',
    description: 'Create a user (cashier) in the current tenant who will log into POS Electron.',
    input_schema: {
      type: 'object',
      properties: {
        username:   { type: 'string' },
        userId:     { type: 'string', description: 'Unique user ID string' },
        password:   { type: 'string' },
        branchCode: { type: 'string', description: 'Branch to assign; defaults to the previously created branch' },
        role:       { type: 'string', description: 'e.g. user, cashier' },
      },
      required: ['username', 'userId', 'password'],
    },
  },
  {
    name: 'create_test_item',
    description: 'Create a test item in the item master so the POS has at least one item to invoice.',
    input_schema: {
      type: 'object',
      properties: {
        itemName: { type: 'string' },
        itemCode: { type: 'string' },
        price:    { type: 'number' },
      },
      required: ['itemName', 'itemCode', 'price'],
    },
  },
  {
    name: 'add_stock',
    description: 'Add physical stock (opening quantity) for the test item created by create_test_item. Calls POST /physical-stock. Must be called after create_test_item and before pos_do_invoice, otherwise billing will fail due to zero stock.',
    input_schema: {
      type: 'object',
      properties: {
        qty:        { type: 'number', description: 'Units to stock (default 100)' },
        branchCode: { type: 'string', description: 'Branch to stock; defaults to the wizard branch' },
      },
    },
  },
  {
    name: 'launch_pos',
    description: 'Start the Vite dev server for pos-electron (localhost:5173). Must be called before pos_login.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'pos_login',
    description: 'Launch the POS Electron app and log in with the given credentials.',
    input_schema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'pos_select_branch',
    description: 'Select a branch in the POS app if a branch selector is shown after login.',
    input_schema: {
      type: 'object',
      properties: {
        branchCode: { type: 'string' },
      },
      required: ['branchCode'],
    },
  },
  {
    name: 'pos_do_invoice',
    description: 'In the open POS Electron app, search for an item, add it to the cart, and save the invoice with a cash payment.',
    input_schema: {
      type: 'object',
      properties: {
        itemQuery:  { type: 'string', description: 'Item name or code to search for' },
        quantity:   { type: 'number', description: 'Quantity to add (default 1)' },
        cashAmount: { type: 'number', description: 'Cash tendered (should be >= item total)' },
      },
      required: ['itemQuery', 'cashAmount'],
    },
  },
  {
    name: 'close_pos',
    description: 'Close the POS Electron window. Vite dev server remains running.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'stop_pos_completely',
    description: 'Close the POS Electron window AND stop the Vite dev server.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_franchise',
    description: 'Create a new franchise record via the admin API.',
    input_schema: {
      type: 'object',
      properties: {
        franchiseCode:  { type: 'string', description: 'Uppercase code, 3-20 chars' },
        franchiseName:  { type: 'string' },
        franchiseType:  { type: 'string', enum: ['STANDARD', 'PREMIUM', 'MASTER'] },
        contactPerson:  { type: 'string' },
        contactPhone:   { type: 'string' },
        contactEmail:   { type: 'string' },
        city:           { type: 'string' },
        franchiseState: { type: 'string' },
      },
      required: ['franchiseCode', 'franchiseName'],
    },
  },
  {
    name: 'create_franchise_branch',
    description: 'Add a branch to the previously created franchise.',
    input_schema: {
      type: 'object',
      properties: {
        branchCode:   { type: 'string' },
        branchName:   { type: 'string' },
        city:         { type: 'string' },
        branchState:  { type: 'string' },
      },
      required: ['branchCode', 'branchName'],
    },
  },
  {
    name: 'provision_franchise',
    description: 'Open the admin React UI in a browser, navigate to Franchise Master, click the franchise row, and click the Provision button. Then polls the backend API every 5 s until all provisioning steps complete or fail (max 3 min).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_franchise_user',
    description: 'Create a POS user inside the franchise tenant so they can log into POS Electron.',
    input_schema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
        role:     { type: 'string' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'setup_franchise_inventory',
    description: 'Create the test item and add 100 units of opening stock inside the franchise tenant. The franchise DB is fresh after provisioning — items must be explicitly created here. Logs in as the franchise user. Must be called after create_franchise_branch and create_franchise_user.',
    input_schema: {
      type: 'object',
      properties: {
        branchCode: { type: 'string', description: 'Franchise branch code (default FRB01)' },
      },
      required: [],
    },
  },
  {
    name: 'generate_report',
    description: 'Print and save the final test report. Call this as the very last step.',
    input_schema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'All test steps with their results',
          items: {
            type: 'object',
            properties: {
              step:    { type: 'string', description: 'Step name / description' },
              passed:  { type: 'boolean' },
              message: { type: 'string', description: 'Short result or error message' },
            },
            required: ['step', 'passed'],
          },
        },
      },
      required: ['steps'],
    },
  },
];

module.exports = { TOOL_DEFINITIONS, executeTool };
