/**
 * Main-thread client for the jq Web Worker.
 *
 * - The jq WebAssembly module is compiled once and shared with each worker,
 *   so restarting a worker is cheap.
 * - Each query has a timeout; a runaway query (e.g. `repeat(.)`) terminates
 *   the worker instead of freezing the page.
 * - Only the latest query matters: starting a new one supersedes a pending one.
 */
import wasmUrl from "jq-wasm/jq.wasm?url";
import type { QueryOptions, QueryOutcome } from "./engine";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export const DEFAULT_QUERY_TIMEOUT_MS = 10_000;

interface Pending {
  id: number;
  resolve: (outcome: QueryOutcome) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  started: number;
}

export class SupersededError extends Error {
  constructor() {
    super("Query superseded by a newer run");
    this.name = "SupersededError";
  }
}

export class QueryClient {
  private worker: Worker | null = null;
  private modulePromise: Promise<WebAssembly.Module> | null = null;
  private readyPromise: Promise<string> | null = null;
  private pending: Pending | null = null;
  private nextId = 1;
  private timeoutMs: number;

  constructor(timeoutMs = DEFAULT_QUERY_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  private compileModule(): Promise<WebAssembly.Module> {
    if (!this.modulePromise) {
      this.modulePromise = (async () => {
        const res = await fetch(wasmUrl);
        if (!res.ok) throw new Error(`Failed to load jq engine (${res.status})`);
        if (typeof WebAssembly.compileStreaming === "function" && res.headers.get("content-type")?.includes("wasm")) {
          return WebAssembly.compileStreaming(res);
        }
        return WebAssembly.compile(await res.arrayBuffer());
      })();
      this.modulePromise.catch(() => (this.modulePromise = null));
    }
    return this.modulePromise;
  }

  /** Start (or reuse) the worker. Resolves with the jq version string. */
  ready(): Promise<string> {
    if (this.readyPromise) return this.readyPromise;
    const promise = this.compileModule().then(
      (module) =>
        new Promise<string>((resolve, reject) => {
          const worker = new Worker(new URL("./jq.worker.ts", import.meta.url), { type: "module" });
          this.worker = worker;
          worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
            const msg = e.data;
            if (msg.type === "ready") resolve(msg.version);
            else if (msg.type === "init-error") reject(new Error(msg.message));
            else if (msg.type === "result") this.settle(msg.id, msg.outcome);
          };
          worker.onerror = (e) => {
            reject(new Error(e.message || "jq worker failed to start"));
            this.failPending({ kind: "internal", message: e.message || "jq worker crashed" });
            this.reset();
          };
          worker.postMessage({ type: "init", module } satisfies WorkerRequest);
        }),
    );
    this.readyPromise = promise;
    promise.catch(() => {
      if (this.readyPromise === promise) this.reset();
    });
    return promise;
  }

  async run(input: string, query: string, options: QueryOptions): Promise<QueryOutcome> {
    // A newer query supersedes an in-flight one. If the worker is still busy
    // with it, restart the worker so the new query doesn't queue behind it.
    if (this.pending) {
      this.failPending(null);
      this.reset();
    }
    await this.ready();
    const worker = this.worker;
    if (!worker) throw new Error("jq worker is not available");
    const id = this.nextId++;
    return new Promise<QueryOutcome>((resolve, reject) => {
      const started = performance.now();
      const timer = setTimeout(() => {
        if (this.pending?.id !== id) return;
        this.pending = null;
        this.reset();
        resolve({
          outputs: [],
          warnings: [],
          durationMs: performance.now() - started,
          error: {
            kind: "timeout",
            message: `Query timed out after ${Math.round(this.timeoutMs / 1000)}s and was stopped. It may loop forever (e.g. repeat, recurse, or range without a limit).`,
          },
        });
      }, this.timeoutMs);
      this.pending = {
        id,
        timer,
        started,
        resolve,
        reject,
      };
      worker.postMessage({ type: "run", id, input, query, options } satisfies WorkerRequest);
    });
  }

  /** Abort the running query, if any. */
  cancel(): void {
    if (!this.pending) return;
    this.failPending(null);
    this.reset();
  }

  dispose(): void {
    this.cancel();
    this.reset();
  }

  private settle(id: number, outcome: QueryOutcome) {
    if (!this.pending || this.pending.id !== id) return;
    clearTimeout(this.pending.timer);
    const { resolve } = this.pending;
    this.pending = null;
    resolve(outcome);
  }

  private failPending(error: QueryOutcome["error"]) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    const { resolve, reject, started } = this.pending;
    this.pending = null;
    if (error) resolve({ outputs: [], warnings: [], error, durationMs: performance.now() - started });
    else reject(new SupersededError());
  }

  private reset() {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
  }
}
