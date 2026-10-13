import { useEffect, useState } from "react";
import { textStats, validateJson, type TextStats, type ValidationResult } from "../lib/json";

export interface JsonDocument {
  validation: ValidationResult;
  stats: TextStats;
  /** Parsed value (wrapped so `null` JSON is distinguishable from "not parsed"). */
  parsed: { value: unknown } | null;
  /** True while the latest text hasn't been analysed yet (debounce window). */
  pending: boolean;
}

/** Above this size we skip JSON.parse (tree view / completions) to bound memory. */
const MAX_PARSE_CHARS = 50 * 1024 * 1024;

export function analyzeJson(text: string): Omit<JsonDocument, "pending"> {
  const stats = textStats(text);
  if (text.trim() === "") return { validation: { status: "empty" }, stats, parsed: null };
  if (text.length <= MAX_PARSE_CHARS) {
    // Fast path: native parsing succeeds for valid input; only fall back to the
    // (slower) location-aware validator when it fails.
    try {
      return { validation: { status: "valid" }, stats, parsed: { value: JSON.parse(text) } };
    } catch {
      /* fall through */
    }
  }
  const validation = validateJson(text);
  let parsed: JsonDocument["parsed"] = null;
  if (validation.status === "valid" && text.length <= MAX_PARSE_CHARS) {
    try {
      parsed = { value: JSON.parse(text.replace(/^﻿/, "")) };
    } catch {
      parsed = null;
    }
  }
  return { validation, stats, parsed };
}

function delayFor(length: number): number {
  if (length < 50_000) return 120;
  if (length < 1_000_000) return 300;
  return 700;
}

/** Debounced, real-time JSON validation + stats for an editor's text. */
export function useJsonDocument(text: string): JsonDocument {
  const [state, setState] = useState(() => ({ text, result: analyzeJson(text) }));
  useEffect(() => {
    if (text === state.text) return;
    const id = setTimeout(() => setState({ text, result: analyzeJson(text) }), delayFor(text.length));
    return () => clearTimeout(id);
  }, [text, state.text]);
  return { ...state.result, pending: text !== state.text };
}
