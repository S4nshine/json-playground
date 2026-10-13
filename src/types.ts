import type { QueryOutcome } from "./lib/query/engine";

export type RunState =
  | { status: "idle" }
  | { status: "running"; previous: QueryOutcome | null; query: string }
  | { status: "done"; outcome: QueryOutcome; query: string; manual: boolean };

export type InputViewMode = "code" | "tree" | "split";
export type ResultViewMode = "code" | "tree";
export type ResultFormat = "pretty" | "compact";
export type MobileTab = "input" | "query" | "result";
