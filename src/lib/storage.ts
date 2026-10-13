/** Local persistence (theme, settings, workspace). Never leaves the browser. */
import type { IndentOption, FormatStyle } from "./json";

const PREFIX = "jsonpg:";

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Returns false if the value could not be stored (quota, private mode…). */
export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export type Theme = "light" | "dark";

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(PREFIX + "theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    /* ignore */
  }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(PREFIX + "theme", theme);
  } catch {
    /* ignore */
  }
}

export interface Settings {
  indent: IndentOption;
  formatStyle: FormatStyle;
  wordWrap: boolean;
  fontSize: number;
  autoRun: boolean;
  sortKeys: boolean;
  slurp: boolean;
  persistWorkspace: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  indent: 2,
  formatStyle: "expanded",
  wordWrap: false,
  fontSize: 13,
  autoRun: true,
  sortKeys: false,
  slurp: false,
  persistWorkspace: true,
};

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readStorage<Partial<Settings>>("settings", {}) };
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  createdAt: number;
}

export interface Workspace {
  input: string;
  query: string;
  compareLeft: string;
  compareRight: string;
}

/** Inputs larger than this are not persisted, to stay within storage quotas. */
export const MAX_PERSISTED_INPUT = 2 * 1024 * 1024;
