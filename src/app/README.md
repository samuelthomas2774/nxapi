Electron app
---

The Electron app is bundled into ~4 files in `dist/app/bundle` using Rollup. The main process code is not bundled for development, but is when packaging the app at `dist/bundle` (with the command line executable at `dist/bundle/cli-bundle.js`).

[electron.ts](electron.ts) exports all Electron APIs used in the main process. This is because the `electron` module doesn't actually exist - Electron patches the `require` function (but not the module importer). Additionally Electron does not support using a standard JavaScript module as the app entrypoint, so [main/app-entry.cts](main/app-entry.cts) (a CommonJS module) is used to import the actual app entrypoint after the `ready` event.

Electron APIs used in renderer processes should be imported directly from the `electron` module as they are always bundled into a CommonJS module.

Any files outside this directory must not depend on anything here, as this directory won't be included in the npm package.
