# Running the Project
cd pos-electron

npm install
npm install electron concurrently wait-on antd dayjs

## STEP 3 — Verify Folder Structure
pos-electron/
  package.json
  vite.config.js
  electron/
    main.js
    preload.js
  src/
    App.jsx
    pos/
      POSPage.jsx
      ItemLookupModal.jsx
      api.js

## STEP 4 — package.json Check
"main": "electron/main.js",
"scripts": {
  "dev:ui": "vite",
  "dev:electron": "wait-on http://localhost:5173 && electron .",
  "dev": "concurrently -k \"npm:dev:ui\" \"npm:dev:electron\"",
  "build": "vite build"
}

## ✅ STEP 5 — RUN IT

npm run dev
http://localhost:5173



# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

