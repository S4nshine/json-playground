import { useEffect, useRef } from "react";

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

export interface Hotkey {
  /** e.g. "mod+enter", "mod+shift+f", "alt+1". `mod` = Cmd on macOS, Ctrl elsewhere. */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** Fire even when focus is in an input/textarea (editors are always allowed). */
  allowInInputs?: boolean;
}

function codeFor(key: string): string {
  if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  const map: Record<string, string> = { enter: "Enter", "/": "Slash", escape: "Escape", ",": "Comma", ".": "Period" };
  return map[key] ?? key;
}

function matches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const mod = parts.includes("mod");
  const shift = parts.includes("shift");
  const alt = parts.includes("alt");
  const modPressed = IS_MAC ? e.metaKey : e.ctrlKey;
  const otherMod = IS_MAC ? e.ctrlKey : e.metaKey;
  if (mod !== modPressed || otherMod || shift !== e.shiftKey || alt !== e.altKey) return false;
  // Use physical key codes so Alt/Shift combinations work on every layout.
  return e.code === codeFor(key) || e.key.toLowerCase() === key;
}

/** Global keyboard shortcuts, registered in the capture phase so they win over editor keymaps. */
export function useHotkeys(hotkeys: Hotkey[]) {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && !e.key.startsWith("Arrow")) return;
      const target = e.target as HTMLElement | null;
      const inEditor = !!target?.closest?.(".cm-editor");
      const inInput = !inEditor && !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      for (const hk of ref.current) {
        if (matches(e, hk.combo)) {
          if (inInput && !hk.allowInInputs) return;
          e.preventDefault();
          e.stopPropagation();
          hk.handler(e);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}

export function formatCombo(combo: string): string[] {
  return combo.split("+").map((p) => {
    switch (p) {
      case "mod":
        return IS_MAC ? "⌘" : "Ctrl";
      case "shift":
        return IS_MAC ? "⇧" : "Shift";
      case "alt":
        return IS_MAC ? "⌥" : "Alt";
      case "enter":
        return IS_MAC ? "↵" : "Enter";
      default:
        return p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1);
    }
  });
}
