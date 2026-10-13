/**
 * jq execution core. Pure and environment-agnostic: it takes a loaded
 * jq-wasm handle, so it runs the same in the Web Worker and in unit tests.
 *
 * Queries are executed by real jq (jq 1.8 compiled to WebAssembly via the
 * `jq-wasm` package), not a re-implementation.
 */
import type { Jq } from "jq-wasm";

export interface QueryOptions {
  /** Sort object keys in the output (`jq -S`). */
  sortKeys?: boolean;
  /** Read the input into an array (`jq -s`). */
  slurp?: boolean;
  /** Ignore the input and use `null` (`jq -n`). */
  nullInput?: boolean;
}

export type QueryErrorKind = "compile" | "runtime" | "input" | "timeout" | "internal";

export interface QueryError {
  kind: QueryErrorKind;
  message: string;
  /** Source excerpt + caret jq prints for compile errors. */
  detail?: string;
  /** 1-based location in the query (compile errors only). */
  line?: number;
  column?: number;
}

export interface QueryOutcome {
  /** Each output value as compact JSON text, in stream order. */
  outputs: string[];
  /** Set when jq failed. Outputs produced before a runtime error are kept. */
  error: QueryError | null;
  /** Non-fatal stderr (e.g. `debug` / `stderr` builtins). */
  warnings: string[];
  durationMs: number;
}

const COMPILE_RE = /^jq: error: ([\s\S]*?) at <(?:top-level|unknown)>, line (\d+)(?:, column (\d+))?:?$/;

/** Turn jq's stderr into a structured error and a list of warnings. */
export function parseJqStderr(stderr: string, exitCode: number): { error: QueryError | null; warnings: string[] } {
  const lines = stderr.split("\n").filter((l) => l.length > 0);
  const warnings: string[] = [];
  let error: QueryError | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(" (Unix shell quoting issues?)", "");
    if (error) {
      // Collect the source excerpt jq prints beneath a compile error.
      if (error.kind === "compile" && /^ {4}/.test(line)) {
        error.detail = error.detail ? `${error.detail}\n${line.slice(4)}` : line.slice(4);
      }
      continue;
    }
    const compile = COMPILE_RE.exec(line);
    if (compile) {
      error = {
        kind: "compile",
        message: compile[1],
        line: Number(compile[2]),
        column: compile[3] ? Number(compile[3]) : undefined,
      };
      continue;
    }
    if (/^jq: \d+ compile errors?$/.test(line)) {
      if (!error) error = { kind: "compile", message: "The query could not be compiled" };
      continue;
    }
    if (line.startsWith("jq: error: ")) {
      error = { kind: "compile", message: line.slice("jq: error: ".length) };
      continue;
    }
    const runtime = /^jq: error \(at [^)]*\): ([\s\S]*)$/.exec(line);
    if (runtime) {
      error = { kind: "runtime", message: runtime[1] };
      continue;
    }
    if (line.startsWith("jq: parse error: ")) {
      error = { kind: "input", message: `Invalid input JSON: ${line.slice("jq: parse error: ".length)}` };
      continue;
    }
    warnings.push(line);
  }

  if (!error && exitCode !== 0 && warnings.length > 0) {
    // Unknown failure shape: surface stderr verbatim rather than dropping it.
    error = { kind: "runtime", message: warnings.join("\n").replace(/^jq: /, "") };
    warnings.length = 0;
  }
  return { error, warnings };
}

export function buildFlags(options: QueryOptions, inputIsEmpty: boolean): string[] {
  const flags = ["-c"];
  if (options.sortKeys) flags.push("-S");
  if (options.nullInput || inputIsEmpty) flags.push("-n");
  else if (options.slurp) flags.push("-s");
  return flags;
}

/**
 * Run `query` against `input` (raw JSON text). Input text is handed to jq
 * as-is, so number precision is preserved end to end.
 */
export function executeQuery(jq: Jq, input: string, query: string, options: QueryOptions = {}): QueryOutcome {
  const started = performance.now();
  const program = query.trim() === "" ? "." : query;
  const inputIsEmpty = input.trim() === "";
  let result;
  try {
    result = jq.raw(inputIsEmpty ? "null" : input, program, buildFlags(options, inputIsEmpty));
  } catch (e) {
    return {
      outputs: [],
      error: { kind: "internal", message: e instanceof Error ? e.message : String(e) },
      warnings: [],
      durationMs: performance.now() - started,
    };
  }
  const outputs = result.stdout.length === 0 ? [] : result.stdout.split("\n").filter((l) => l.length > 0);
  const { error, warnings } = parseJqStderr(result.stderr, result.exitCode);
  return { outputs, error, warnings, durationMs: performance.now() - started };
}
