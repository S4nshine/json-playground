import type { QueryOptions, QueryOutcome } from "./engine";

export type WorkerRequest =
  | { type: "init"; module: WebAssembly.Module }
  | { type: "run"; id: number; input: string; query: string; options: QueryOptions };

export type WorkerResponse =
  | { type: "ready"; version: string }
  | { type: "init-error"; message: string }
  | { type: "result"; id: number; outcome: QueryOutcome };
