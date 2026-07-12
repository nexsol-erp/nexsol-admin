'use strict';

/**
 * Nexsol E2E Test Agent
 *
 * Orchestrates a full end-to-end test using Claude as the AI brain.
 * Claude decides which tools to call in which order, handles failures,
 * and produces a final test report.
 *
 * Prerequisites:
 *   - nexsol-admin (React)  running on http://localhost:3000
 *   - nexsol backend        running on http://localhost:8084
 *   - ANTHROPIC_API_KEY     set in environment (or .env file)
 *
 * Usage:
 *   node agent.js
 */

require('./env');   // optional: loads .env if present

const Anthropic = require('@anthropic-ai/sdk');
const { TOOL_DEFINITIONS, executeTool } = require('./tools');

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL         = 'claude-sonnet-4-6';
const MAX_TOKENS    = 4096;
const MAX_TURNS     = 60;     // safety cap — prevents infinite loops

const ts            = Date.now();
const TENANT_USER   = `testadmin${ts}`;
const TENANT_EMAIL  = `testadmin${ts}@test.nexsol.local`;
const TENANT_MOBILE = `9${ts.toString().slice(-9)}`;   // unique 10-digit mobile per run
const TENANT_PWD    = 'Test@1234';

const POS_USER      = `cashier${ts.toString().slice(-6)}`;   // unique per run — backend /api/login has no tenant param, same username resolves to oldest tenant
const POS_USER_ID   = `cashier_${ts}`;
const POS_PWD       = 'cashier123';

const BRANCH_CODE   = 'BR01';
const BRANCH_NAME   = 'Main Test Branch';

const FRANCHISE_CODE = 'FR01';
const FRANCHISE_NAME = 'Test Franchise';

const FR_USER       = `frcashier${ts.toString().slice(-6)}`;   // unique per run
const FR_USER_ID    = `frcashier_${ts}`;
const FR_PWD        = 'frcashier123';

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are an automated end-to-end test agent for the Nexsol ERP system.
Your job is to run a complete test scenario by calling tools in the correct order.
If a step fails, record the failure and continue with subsequent steps where possible.
At the very end, call generate_report with the full list of steps and their results.

## Test scenario (execute in this exact order)

### Phase 1 — Tenant setup
1. signup_tenant           — create the admin tenant
2. complete_wizard         — complete all 11 wizard steps (creates branch BR01, seeds menus/roles/categories)
3. create_pos_user         — create the cashier user in branch BR01; tool also assigns the user to the branch automatically
4. create_test_item        — create one product so POS has something to invoice
5. add_stock               — add 100 units of opening stock to the test item for branch BR01 (required before billing)

### Phase 2 — Main-tenant POS invoice
6. launch_pos              — start Vite dev server
7. pos_login               — log in with the cashier user (tool auto-targets the correct Electron window, skips DevTools/splash)
8. pos_select_branch       — select the branch BR01 (always call this; POS requires branch selection)
9. pos_do_invoice          — search the test item, add it, save invoice with cash
10. close_pos              — close Electron (keep Vite running)

### Phase 3 — Franchise
11. create_franchise        — create the franchise record
12. provision_franchise     — call the provision API and poll until all provisioning steps complete (sets franchiseTenancyId in state)
13. create_franchise_branch — add a branch to the franchise (MUST run after provision_franchise — requires franchiseTenancyId which is only available after provisioning)
14. create_franchise_user   — create a POS user inside the franchise tenant
15. setup_franchise_inventory — create the test item and add 100 units of stock in the franchise tenant (the franchise DB is empty after provisioning); logs in as the franchise user

### Phase 4 — Franchise POS invoice
16. pos_login               — log in with the franchise cashier (same POS app, franchise creds)
17. pos_select_branch       — select branch if prompted
18. pos_do_invoice          — create an invoice for the franchise
19. stop_pos_completely     — close Electron + Vite dev server

### Phase 5 — Report
20. generate_report         — summarise all step results

## Test data to use
- Tenant admin   : username="${TENANT_USER}", email="${TENANT_EMAIL}", mobile="${TENANT_MOBILE}", password="${TENANT_PWD}"
- Wizard         : companyName="Test Company", branchCode="${BRANCH_CODE}", branchName="${BRANCH_NAME}", branchState="Kerala", branchGst="29TESTGST0000Z1", branchInvoicePrefix="INV"
- POS cashier    : username="${POS_USER}", userId="${POS_USER_ID}", password="${POS_PWD}", branchCode="${BRANCH_CODE}", role="user"
- Test item      : itemName="Test Bread", itemCode="TESTBREAD01", price=30
- Opening stock  : qty=100 units in branch BR01 (call add_stock immediately after create_test_item)
- Franchise      : code="${FRANCHISE_CODE}", name="${FRANCHISE_NAME}", type="STANDARD"
- Franchise branch: code="FRB01", name="Franchise Main Branch"
- Franchise user : username="${FR_USER}", userId="${FR_USER_ID}", password="${FR_PWD}", role="admin"
- Invoice        : search "Test" (or the item code), quantity=1, cashAmount=100

## Important rules
- Always call the tools sequentially — do not parallelise tool calls.
- If signup_tenant fails, abort the entire run and call generate_report immediately.
- If provision_franchise fails, skip steps 13–19 and go to generate_report.
- If pos_login fails, record the failure and IMMEDIATELY move on to the next step — do NOT retry pos_login multiple times; the tool handles its own internal retries.
- Record every step result (passed/failed + message) so generate_report has the full picture.
`.trim();

// ─── Agent loop ───────────────────────────────────────────────────────────────

async function runAgent() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Set it with:  set ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        Nexsol E2E Test Agent  (Claude-powered)          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Model  : ${MODEL}`);
  console.log(`  Tenant : ${TENANT_USER}`);
  console.log(`  Branch : ${BRANCH_CODE}`);
  console.log('');

  const messages = [
    { role: 'user', content: 'Run the complete E2E test scenario as described.' },
  ];

  let turn = 0;

  while (turn < MAX_TURNS) {
    turn++;

    let response;
    try {
      response = await client.messages.create({
        model:    MODEL,
        max_tokens: MAX_TOKENS,
        system:   SYSTEM_PROMPT,
        tools:    TOOL_DEFINITIONS,
        messages,
      });
    } catch (err) {
      console.error(`\nAnthropic API error (turn ${turn}):`, err.message);
      process.exit(1);
    }

    // Append assistant turn
    messages.push({ role: 'assistant', content: response.content });

    // Print any narrative text from Claude
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        console.log(`\n[Claude] ${block.text.trim()}`);
      }
    }

    // Done?
    if (response.stop_reason === 'end_turn') {
      console.log('\n✅ Agent finished.\n');
      break;
    }

    if (response.stop_reason !== 'tool_use') {
      console.log(`\n⚠️  Unexpected stop_reason: ${response.stop_reason}`);
      break;
    }

    // Execute tool calls one by one (Claude must not parallelise, but just in case)
    const toolResults = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      console.log(`\n┌─ Tool: ${block.name}`);
      const inputStr = JSON.stringify(block.input, null, 2)
        .split('\n').map(l => `│  ${l}`).join('\n');
      console.log(inputStr);

      let result;
      try {
        result = await executeTool(block.name, block.input);
      } catch (err) {
        result = { success: false, error: err.message };
      }

      const icon = result.success ? '✅' : '❌';
      const summary = result.error || result.message || JSON.stringify(result);
      console.log(`└─ ${icon} ${summary}`);

      toolResults.push({
        type:        'tool_result',
        tool_use_id: block.id,
        content:     JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (turn >= MAX_TURNS) {
    console.error(`\n⚠️  Safety cap reached (${MAX_TURNS} turns). Exiting.`);
  }
}

// Catch unhandled promise rejections (e.g. Playwright internal errors) to prevent crashes
process.on('unhandledRejection', (reason) => {
  console.error('\n[unhandledRejection] Caught:', reason instanceof Error ? reason.message : reason);
});

runAgent().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
