# JSON Playground

A browser-based tool for developers to **format, minify, validate, inspect, compare and query JSON** with real `jq`.
All processing happens in your browser. JSON is never sent to a server.

![stack](https://img.shields.io/badge/React_19-TypeScript-blue) ![jq](https://img.shields.io/badge/jq-1.8.2_(WebAssembly)-green)

## Quick start

Requires **Node.js 20.19+ or 22.12+**.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server                           |
| `npm run build`     | Type-check and build to `dist/`                |
| `npm run preview`   | Serve the production build locally             |
| `npm test`          | Run unit tests (Vitest)                        |
| `npm run typecheck` | TypeScript only                                |

The production build is fully static (`dist/`), so you can host it on any static host. No backend is required.

To set the GitHub link in the header, copy `.env.example` to `.env.local` and set `VITE_GITHUB_URL`.

## Features

- **Format / beautify** with 2 spaces, 4 spaces or tabs, in *expanded* or *compact* style (compact keeps short arrays and objects on one line). The formatter is lossless: big integers such as `12345678901234567890`, number spellings such as `1.50` and `1E+400`, and string escapes are kept byte-for-byte.
- **Minify** and **validate** independently. Validation runs in real time (debounced) and reports precise *line and column* errors with readable messages, e.g. "Trailing comma is not allowed", "Strings must use double quotes", "JSON literals are lowercase". The error is underlined in the editor, and clicking the status jumps to it.
- **jq queries** run by real jq 1.8.2 (via [`jq-wasm`](https://github.com/owenthereal/jq-wasm)) inside a Web Worker:
  - Multiple outputs (streams), result count and execution time
  - Compile errors show jq's message and highlight the location in the query
  - Runtime errors keep the outputs produced before the error
  - A 10-second timeout and a Stop button handle runaway queries such as `repeat(.)`
  - Auto-run while typing (can be turned off), `Sort keys (-S)` and `Slurp (-s)` options
  - Example queries, recent history, saved queries, and autocompletion of jq builtins and field names from your input
- **Editors**: CodeMirror 6 with syntax highlighting (JSON and jq), line numbers, bracket matching, auto-indent, code folding, search/replace, and optional word wrap.
- **Tree view** next to (or instead of) the code editor. It is virtualized for large documents and supports expand/collapse all, filtering of keys and values, keyboard navigation, copy path/value, and *Use as query*.
- **Compare**: a structural diff of two documents (added, removed, changed, type changed). Key order and formatting are ignored, and arrays are compared by index.
- **Files**: import with the button or `Ctrl/Cmd+O`, drag and drop a `.json` file onto any editor, and download input (formatted, minified or as-is) or results. A single result downloads as `.json`; multiple results download as `.jsonl`.
- **Clipboard**: copy input or results, and paste into the input.
- **Sample data**: a curated sample, plus generated datasets of 1k, 10k or 50k records for performance testing.
- **Dark and light themes**: the OS preference is used on the first visit, and your choice is saved after that.
- **Persistence**: input, query, comparison documents, history, saved queries, settings and panel sizes are kept in `localStorage`. Inputs over 2 MB are not saved. You can turn this off or clear it in Settings.
- **Responsive**: resizable split panels on desktop; tabs (Input / Query / Result) on mobile.

## Keyboard shortcuts

`Mod` is ⌘ on macOS and Ctrl elsewhere. Open the full list with `Mod+Shift+/` or the keyboard icon in the header.

| Shortcut              | Action                         |
| --------------------- | ------------------------------ |
| `Mod+Enter`           | Run query                      |
| `Mod+Shift+F`         | Format input                   |
| `Mod+Shift+M`         | Minify input                   |
| `Mod+Shift+L`         | Validate input                 |
| `Mod+O`               | Import JSON file               |
| `Mod+S`               | Download formatted input       |
| `Alt+1` / `2` / `3`   | Focus input / query / results  |
| `Mod+F`               | Search in the focused editor   |
| `Ctrl+Space`          | Autocomplete in the query      |

## jq support and limitations

Queries run on the official jq 1.8.2 compiled to WebAssembly, so the jq language and its builtins behave exactly as they do on the CLI. This includes paths, `select`, `map`, `group_by`, `reduce`, `foreach`, `try/catch`, regex (`test`, `capture`, `sub`, …), `@base64`/`@csv`/`@tsv`/…, date functions, `limit`, `getpath`, and so on.

Not available in the playground:

- **CLI-only options**: `--arg`, `--argjson`, `--slurpfile`, `--rawfile`, `--args`, `--jsonargs`, `--seq`, `--stream`, and raw output (`-r`/`-j`). Results always appear as JSON. Use `-S` and `-s` from Settings.
- **Modules**: `import` / `include` (there is no filesystem).
- **Environment**: `$ENV` / `env` reflect the WebAssembly runtime, not your shell, and `input_filename` is `null`.
- **Multiple inputs**: `input` / `inputs` work when the input contains several JSON values (e.g. JSON Lines). Turn on *Slurp* to read them as one array.
- **Timeout**: queries are stopped after 10 seconds.

### Extending the query engine

`src/lib/query/engine.ts` is a pure function, `executeQuery(jq, input, query, options)`. Add new jq flags to `QueryOptions` and `buildFlags()`, then expose them in `SettingsDialog`. Error parsing is in `parseJqStderr()`. Example queries are in `src/lib/query/examples.ts`; a unit test runs each one against the sample data.

## Architecture

```
src/
  App.tsx                     State, actions, shortcuts, persistence wiring
  components/
    AppHeader, ActionToolbar, WorkspaceLayout, StatusBar, ThemeToggle
    JsonInputEditor, QueryEditor, QueryResultsEditor, CompareView
    QueryExamples, QueryHistory, JsonTreeView, SettingsDialog, ShortcutsDialog
    editor/CodeEditor.tsx     CodeMirror 6 wrapper (uncontrolled, undo-friendly)
    editor/theme.ts           One CSS-variable-driven editor theme for light and dark
    ui.tsx                    Buttons, popovers, dialogs, segmented controls
  hooks/                      useTheme, useJsonDocument (debounced validation), useHotkeys, …
  lib/
    json.ts                   Lossless tokenizer → validate / format / minify / stats
    jsonDiff.ts, jsonPath.ts  Structural diff, jq path rendering, field collection
    query/engine.ts           jq execution + stderr parsing (pure, unit-tested)
    query/jq.worker.ts        Web Worker hosting jq-wasm
    query/client.ts           Worker client: shared compiled module, timeout, cancellation
    query/jqLanguage.ts       jq syntax highlighting + autocompletion for CodeMirror
    file.ts, clipboard.ts     Import/export and clipboard helpers
    storage.ts                Theme, settings and workspace persistence
```

Design notes:

- **JSON processing never leaves the browser.** The only network requests are for the app's own static assets, including the jq `.wasm` file.
- The **jq WebAssembly module is compiled once** on the main thread and passed to the worker, so restarting the worker after a timeout or cancellation is cheap.
- Input text is passed to jq **as text**, not as a parsed JS object, so number precision is preserved end to end.
- High-frequency UI state (cursor position, toasts) uses small external stores, so typing doesn't re-render the whole app. Large documents debounce change events and validation.

## Testing

```bash
npm test
```

Unit tests cover the JSON utilities (validation errors and their locations, formatting styles, lossless numbers, minify round-trips, deep nesting, large-document performance), the structural diff, jq path rendering, and the query engine. The engine tests run against real jq: field access, `select`, `map`/`add`, streams, every JSON type, big numbers, compile and runtime error parsing, `debug` warnings, and every bundled example query.

## Dependencies

| Package | Why |
| --- | --- |
| `react`, `react-dom` | UI |
| `codemirror`, `@codemirror/*` | Editors (JSON language, search, lint, folding, autocomplete) |
| `jq-wasm` | Official jq 1.8.2 compiled to WebAssembly (MIT, actively maintained) |
| `react-resizable-panels` | Accessible resizable split panes |
| `lucide-react` | Icons (tree-shaken) |
| `tailwindcss` (dev) | Styling via design tokens |
