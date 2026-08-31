# Phase 2 — Extract the Shared React Renderer

> Prompt file **2 of 6**. Paste this entire file into Claude Code as one message.
> Requires Phase 1 complete (schema + fixtures exist). Independent of Phase 3 — they can run in parallel.

---

## 1. Role and operating rules

You are extracting a working component out of a shipping product without changing that product's
behaviour. The existing mind-map app is the regression suite; if its tests or its UI change, you
have failed even if the new package is perfect.

1. Preserve uncommitted work; work on `feat/product-360-renderer` in `e:\mind-map`.
2. No unrelated refactoring — resist improving `MindMapEditor.tsx` while you are in there.
3. No completion claims without running both test suites.

---

## 2. The three conflicts this phase exists to solve

The admin and the mind-map frontend cannot share source directly:

| # | Conflict | Consequence if ignored |
|---|---|---|
| 1 | Mind-map is **TypeScript + Vite 6**; admin is **JavaScript + CRA 5** | CRA does not compile TS from `node_modules`. A source import fails at build. |
| 2 | Mind-map uses **MUI v6.2**; admin uses **MUI v5.16** | Two `@mui/material` instances = two `ThemeContext`s. A v6 component inside the admin's v5 `ThemeProvider` **silently falls back to MUI's default theme** — no error, wrong colours, broken dark mode. |
| 3 | Mind-map uses **`@xyflow/react` 12.3**; admin already ships **`reactflow` 11.11** and **`react-flow-renderer` 10.3** | A third graph engine, ~150–200 KB, and v11/v12 CSS class collisions |

Conflict 2 is the dangerous one because it produces no error. The fix is to make the renderer
**MUI-free**.

---

## 3. What you are extracting

`e:\mind-map\frontend\src\components\mindmap\MindMapCanvas.tsx` (390 lines) is already a pure
props-in / events-out component — no API client, no router, no service imports. Its entire
coupling surface:

| Import | Symbols | Action |
|---|---|---|
| `@mui/material` | `Box`, `alpha`, `useTheme` | **Remove.** `Box` → `div`; `useTheme` → a `theme` prop; `alpha` → a 6-line local util |
| `@/theme/palette` | `MAP_THEMES`, `NODE_TYPE_STYLES` | Move into the package as **default** tokens, overridable by prop |
| `@/types` | `MindMapNode`, `MindMapEdge`, `ProjectTheme` | Move into the package |
| `@/utils` | `nodeSize` (from `utils/graph.ts`) | Move into the package |
| `./MindMapNode` | `MindMapNodeView` (238 lines) | Move into the package |
| `./flowTypes` | `MindMapFlowNode`, `MindMapFlowEdge` | Move into the package |
| `@xyflow/react` | many + `dist/style.css` | **Peer dependency** |

Everything else in `components/mindmap/` — the toolbar, dialogs, search, context menu, detail
panel, save indicator — **stays in the standalone app**. Only the canvas is shared.

### The node-type generalisation

`NODE_TYPE_STYLES` is currently `Record<NodeType, NodeTypeStyle>` over the mind-map's six types
(`idea` `task` `decision` `question` `link` `note`, plus `root`). Product 360 has fifteen entirely
different types (`PRODUCT`, `BRANCH_STOCK`, `COST`, …). **Do not add the ERP types to that
union.** Make styling data-driven:

```ts
nodeStyles: Record<string, NodeTypeStyle>   // prop, defaults to the mind-map set
```

The package knows nothing about either domain's type names. This is the change that lets one
renderer serve both products.

---

## 4. Tasks

### 4.1 Create the package

```
e:\mind-map\packages\mindmap-renderer\
  package.json          name "@tradelink247/mindmap-renderer", version 0.1.0
  vite.config.ts        library mode → ESM + CJS
  tsconfig.json         declaration: true
  src/
    index.ts            public exports only
    MindMapRenderer.tsx the public component (wraps the canvas)
    MindMapCanvas.tsx   moved, MUI stripped
    MindMapNode.tsx     moved, MUI stripped
    flowTypes.ts        moved
    tokens.ts           MapThemeTokens, NodeTypeStyle, defaults, alpha() util
    types.ts            graph types, generic over node type strings
  README.md             install, props, how each host passes theme tokens
```

`package.json` essentials:

```jsonc
{ "main": "dist/index.cjs", "module": "dist/index.js", "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": { "build": "vite build && tsc -p tsconfig.build.json --emitDeclarationOnly" },
  "peerDependencies": { "react": "^18", "react-dom": "^18", "@xyflow/react": "^12" } }
```

**No `dependencies` on `@mui/material`, `@emotion/*` or `react-router-dom`.** `dagre` may be a
real dependency if the package owns auto-layout; otherwise leave layout to the host.

### 4.2 Public API

```tsx
<MindMapRenderer
  nodes={nodes} edges={edges}
  mode="editable" | "readonly"
  theme={themeTokens}                  // colours, radii, fonts — plain values, no MUI
  nodeStyles={nodeStyleMap}            // per node-type styling, domain-agnostic
  layout={savedLayout}                 // positions, collapsed set, viewport
  selectedNodeIds={[]}
  onNodeSelect={fn} onNodeExpand={fn}
  onLayoutChange={fn}                  // debounced by the host, not here
  onNavigate={fn}                      // emits a typed intent; NEVER opens a URL itself
  labels={{ fitView: '…', zoomIn: '…' }}   // pre-translated strings; no English literals inside
/>
```

**`mode="readonly"` must make edits structurally impossible, not merely hidden:** no
`onConnect` handler wired, `nodesConnectable={false}`, `edgesUpdatable={false}`, no delete key
handling, no context menu for add/delete. Moving nodes and changing the viewport stay allowed —
that is layout, not data.

`onNavigate` receives the `NavigationTarget` object from the Phase 1 contract and does nothing
else with it. The renderer never constructs, opens or validates a URL.

### 4.3 Accessibility and resilience (D22)

- Nodes reachable and selectable by keyboard, with a visible focus ring.
- Severity conveyed by icon + text, never colour alone.
- `prefers-reduced-motion` disables transition/animation.
- Explicit `loading`, `empty` and `error` renders — an error inside the canvas must not white-screen
  the host page. Wrap in an error boundary the host can style.
- A `maxNodes` prop with a defined overflow behaviour, so a bad payload degrades instead of hanging.

### 4.4 Make the standalone app consume the package

1. Add `"@tradelink247/mindmap-renderer": "file:../packages/mindmap-renderer"` to
   `e:\mind-map\frontend\package.json`.
2. Replace `components/mindmap/MindMapCanvas.tsx` with a thin adapter that imports the package,
   passes the app's MUI theme through as plain tokens (`useTheme()` stays in the *app*, not the
   package), and keeps the existing props signature so `MindMapEditor.tsx` is untouched.
3. Delete the moved code from the app — one implementation only (D6).

### 4.5 Tests

In the package (Vitest + Testing Library, mirroring `e:\mind-map\frontend\tests\`):

- renders nodes and edges from a fixture
- `mode="readonly"`: no connect/delete path exists; drag still emits `onLayoutChange`
- `layout` prop positions nodes; unknown ids in `layout` are ignored without throwing
- `onNodeSelect` / `onNodeExpand` / `onNavigate` emit the right typed payloads
- `onNavigate` does **not** touch `window.location`
- empty graph, 500-node graph, malformed node
- theme tokens applied; no `@mui` import resolvable from `dist` (assert against the built output)

In the standalone frontend: **the existing suite must pass unchanged.** Do not edit an existing
test to make it pass — if one breaks, the extraction is wrong.

---

## 5. Do not

- Do not add `@mui/material` to the package, in any form, including as a peer.
- Do not add the Product 360 node types to the package's type union.
- Do not let the package import `react-router-dom`, `axios`, or anything host-specific.
- Do not upgrade the admin to MUI v6 to "solve" conflict 2.
- Do not use a git submodule.
- Do not touch `MindMapEditor.tsx`, `MindMapToolbar.tsx` or the dialogs beyond what the canvas
  swap requires.

---

## 6. Exit criteria

- [ ] `npm run build` in the package emits `dist/` with ESM, CJS and `.d.ts`
- [ ] `grep -r "@mui" dist/` returns nothing
- [ ] Package tests pass — paste the summary line
- [ ] **`e:\mind-map\frontend` existing tests pass unchanged** — paste the summary line
- [ ] `npm run build` in `e:\mind-map\frontend` succeeds
- [ ] The standalone app runs (`docker compose up` or the dev servers) and a project still opens,
      edits, drags and saves — say what you actually clicked
- [ ] `README.md` documents the props, the token contract, and the publish/version bump procedure
- [ ] `DECISIONS.md` records the packaging choice and the version pinned

## 7. Report

Files moved / created / deleted · both test summary lines · the built `dist` size · what you
verified by hand in the standalone app · anything in `MindMapCanvas.tsx` that resisted extraction
and how you handled it.
