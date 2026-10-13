export interface ShortcutDef {
  combo: string;
  label: string;
  group: "Query" | "JSON" | "Editor" | "App";
}

export const SHORTCUTS = {
  runQuery: { combo: "mod+enter", label: "Run query", group: "Query" },
  format: { combo: "mod+shift+f", label: "Format input", group: "JSON" },
  minify: { combo: "mod+shift+m", label: "Minify input", group: "JSON" },
  validate: { combo: "mod+shift+l", label: "Validate input", group: "JSON" },
  importFile: { combo: "mod+o", label: "Import JSON file", group: "JSON" },
  download: { combo: "mod+s", label: "Download input", group: "JSON" },
  focusInput: { combo: "alt+1", label: "Focus input", group: "App" },
  focusQuery: { combo: "alt+2", label: "Focus query", group: "App" },
  focusResults: { combo: "alt+3", label: "Focus results", group: "App" },
  shortcuts: { combo: "mod+shift+/", label: "Keyboard shortcuts", group: "App" },
} satisfies Record<string, ShortcutDef>;

/** Built-in editor shortcuts provided by CodeMirror (listed for reference). */
export const EDITOR_SHORTCUTS: ShortcutDef[] = [
  { combo: "mod+f", label: "Find in editor", group: "Editor" },
  { combo: "mod+alt+f", label: "Find & replace", group: "Editor" },
  { combo: "mod+z", label: "Undo", group: "Editor" },
  { combo: "mod+shift+z", label: "Redo", group: "Editor" },
  { combo: "mod+alt+[", label: "Fold block", group: "Editor" },
  { combo: "mod+alt+]", label: "Unfold block", group: "Editor" },
  { combo: "mod+d", label: "Select next occurrence", group: "Editor" },
  { combo: "ctrl+space", label: "Autocomplete (query)", group: "Editor" },
];
