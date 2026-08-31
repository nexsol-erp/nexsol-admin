# Phase 4 — Product 360 Page (TradeLink247 Admin)

> Prompt file **4 of 6**. Paste this entire file into Claude Code as one message.
> Requires Phase 2 (renderer package) and Phase 3 (API).

---

## 1. Role and operating rules

You are adding a route to a 400-component CRA app with a **1.68 MB gzipped main bundle** and
almost no test coverage. Every user pays for what you add to the main chunk, including the ones
who never open this page.

1. Preserve uncommitted work; branch `feat/product-360-ui`.
2. No unrelated refactoring.
3. **Measure the bundle before and after.** A phase that cannot show both numbers is not done.
4. Follow the app's existing conventions rather than inventing new ones — they are listed below.

---

## 2. Context — conventions to follow, not reinvent

**Repo:** `e:\nexsol-admin` · CRA 5 (`react-scripts`), **plain JavaScript**, React 18.3,
MUI **v5.16**, `@emotion` 11, `react-router-dom` 6.23, `react-i18next` 15.

| Concern | Existing mechanism | Where |
|---|---|---|
| Menu tree | `MENU_TREE` — single source of truth for sidebar, top-bar search and menu map | `src/menuCatalog.js` |
| Permissions | `useMenuAccess()` → `isMenuAllowed(menuKey, roles)` / `isEntryAllowed(...)`, fed by `POST /api/{tenancyId}/role-menus/accessible-menus` | `src/components/MenuAccessContext.jsx` |
| Permission-gated route | `RequireWorkflowMenuAccess menuKey="…"` wrapper already used for `/my-tasks` | `src/App.js` |
| Branch context | `useBranch()` | `src/components/BranchContext.jsx` |
| Translation | every label via `t()` | `src/i18n.js` |
| Dark mode | `mode` / `setMode` threaded from `App.js` through `Sidebar` | `src/App.js` |
| Export | `html2canvas`, `jspdf`, `xlsx` already bundled | — |
| Graph libs present | `reactflow@11`, `react-flow-renderer@10` (legacy) | `package.json` |

**Client state you must not trust as authority:** `localStorage` holds `tenancyId`, `roles`,
`branchCode`, `allowedBranches`, `jwtToken`. The server resolves the authorised branch set; the
client list is a UI convenience only.

---

## 3. Tasks

### 3.1 Dependencies and budget

1. Add `@xyflow/react@^12` and the Phase 2 package (`file:` dependency per D4). Leave
   `reactflow@11` and `react-flow-renderer@10` alone — but grep for their importers and record
   which components use which in `DECISIONS.md`, so retiring v11 later is a known job.
2. Import React Flow v12's CSS **inside the Product 360 chunk only**, not in `index.css`, so v11
   and v12 class names cannot collide app-wide.
3. **Budget (D5):** main chunk may grow by at most **30 KB gzipped** over the Phase 0 baseline;
   the Product 360 async chunk must stay under **250 KB gzipped**. Measure with `npm run build`.

### 3.2 Route and menu entry

4. `src/App.js`: add a **lazy** route inside `<Suspense>`:
   ```jsx
   const Product360Page = React.lazy(() => import("./features/product360/Product360Page"));
   …
   <Route path="/product-360/:productId?" element={
     <RequireMenuAccess menuKey="Product 360"><Product360Page /></RequireMenuAccess>} />
   ```
   Reuse the existing gate pattern; if `RequireWorkflowMenuAccess` is workflow-specific, generalise
   it minimally or add a sibling — do not duplicate its logic.
5. `src/menuCatalog.js`: add one entry to the flat top-level group, matching the file's shape
   exactly (`menuKey`, `label`, `icon` as a component reference, `color`, `link`, `roles`).
   `menuKey: "Product 360"` must match the backend menu name so role-menu assignment gates it.
   Adding it here is all that is required — the sidebar, the top-bar search and the menu map
   all read from this file.
6. Do **not** add it to `ROUTE_ORDER` in `App.js` (that is the post-login landing resolver; a
   product-scoped page is a poor landing page).

### 3.3 Components

```
src/features/product360/
  Product360Page.jsx      layout, data fetching, error/empty/permission states
  ProductSelector.jsx     debounced (≥300 ms) autocomplete, server-side limit
  Product360Filters.jsx   date range, branch scope, refresh, reset-layout
  KpiSummary.jsx          summary metrics from the contract
  Product360Canvas.jsx    thin wrapper over @tradelink247/mindmap-renderer
  NodeDetailDrawer.jsx    exact values, evidence, notes, navigation buttons
  BranchTable.jsx         the D13/D22 accessible equivalent of the map
  navigationRegistry.js   routeKey → admin route + params
  useProduct360.js        graph fetch, cancellation, cache
  useProduct360Layout.js  layout + notes via the Phase 5 API (feature-flagged off until then)
  exportProduct360.js     PNG of the map, Excel/CSV of the tables
```

### 3.4 Behaviour

- **Header:** product code + name + category, resolved period **with its `basis`**, `dataThrough`
  with the lagging-branch warning surfaced (D10) — not hidden in a tooltip.
- **KPI row:** every metric renders `formatted` from the contract and, when present, its baseline
  delta with direction (D19). **Never do arithmetic on `value` in JavaScript** — no summing, no
  percentage, no currency formatting. If a number you need is not in the response, that is a
  Phase 3 bug, not something to compute here.
- **Canvas:** `mode="readonly"`, theme tokens derived from the current MUI v5 theme **and the
  dark-mode setting**, pre-translated `labels`, saved layout applied when available.
- **Detail drawer:** node title, type, exact metrics table, baseline, evidence links, warnings,
  personal notes, and navigation buttons.
- **Navigation:** `navigationRegistry.js` maps `routeKey` → an existing admin route and its
  params. Before navigating, **recheck `isMenuAllowed` for that route's `menuKey`**; if the user
  lacks it, disable the button with a reason rather than navigating into a 403. An unknown
  `routeKey` renders a controlled message. `returnContext` restores product, filters and layout
  on the way back.
- **AI insight and task nodes (contract §6.6):** read-only. A `WORKFLOW_TASK` node shows title,
  priority, status, due/SLA, workflow name and — only when the response includes it — the
  assignee; its single action navigates to the existing task page (`/my-tasks`). **There is no
  complete/approve/reassign control anywhere on this page in release 1.** An `AI_INSIGHT` node
  shows its explanation with its evidence link and its own `dataThrough`; render nothing if the
  evidence is missing. Neither section is synthesised client-side — if the server says
  `UNAVAILABLE`, show that, never a placeholder insight.
- **States:** loading (skeleton, not a spinner over a blank page), no-product-selected, product
  with no data in period (**valid, not an error**), permission denied, request failed, section
  degraded (render what arrived, banner what did not).
- **Cancellation:** switching product mid-flight aborts the previous request; a late response must
  never overwrite a newer one.
- **i18n (D21):** every string via `t()`; add the new keys to `src/i18n.js`. Untranslated keys fall
  back to English, so nothing breaks, but list what you added.
- **Accessibility (D22):** `BranchTable` is the non-visual equivalent of the graph and must be
  reachable by keyboard, not buried behind a canvas interaction; severity has an icon and a text
  label, never colour alone.
- **Export (D20):** PNG of the map, Excel/CSV of the KPI and branch tables, using the libraries
  already bundled. Add no new dependency.

### 3.5 Tests (`react-scripts test`)

- product search debounces and respects the server limit
- graph renders from the Phase 1 fixtures — `full`, `degraded`, `empty`
- `degraded.json`: cost/profit show **"Unavailable"** with the warning, and the string `0` appears
  nowhere in those tiles
- `empty.json` renders the empty-but-valid state, not an error
- node selection opens the drawer with the right node
- navigation: permitted `routeKey` navigates with correct params; unpermitted is disabled;
  unknown renders the controlled error
- permission denied renders the denial, not a crash
- late response from an abandoned product does not overwrite the current one

---

## 4. Do not

- Do not import the Product 360 page eagerly — it must stay in its own chunk.
- Do not compute money, margins or totals in JavaScript.
- Do not read `allowedBranches` from `localStorage` as authority.
- Do not construct a URL from response data; only `routeKey` + validated params.
- Do not add a chart/table/export library — the app already has them.
- Do not upgrade MUI, CRA, or any shared dependency.

---

## 5. Exit criteria

- [ ] `npm run build` succeeds
- [ ] **Bundle report:** main chunk before vs after (≤ +30 KB gz) and the Product 360 chunk
      (≤ 250 KB gz) — both numbers pasted
- [ ] `npx eslint src` introduces **no new** warnings over the Phase 0 baseline
- [ ] Tests pass — paste the summary
- [ ] Verified by hand: light **and** dark mode; a permitted user; a user without the menu
- [ ] Degraded fixture shows "Unavailable", never `0`
- [ ] Menu entry appears in the sidebar, the top-bar search and the menu map for permitted users
      only (all three read `menuCatalog.js`)
- [ ] New i18n keys listed

## 6. Report

Files created/changed · build + test summaries · the before/after bundle table · what you clicked
through in both themes and both permission states · i18n keys added · which contract fields the UI
does not yet use and why.
