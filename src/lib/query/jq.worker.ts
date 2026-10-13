/// <reference lib="webworker" />
import { loadJq, type Jq } from "jq-wasm";
import { executeQuery } from "./engine";
import type { WorkerRequest, WorkerResponse } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

let jq: Jq | null = null;
const queue: WorkerRequest[] = [];

const send = (msg: WorkerResponse) => self.postMessage(msg);

function handleRun(req: Extract<WorkerRequest, { type: "run" }>) {
  if (!jq) return;
  const outcome = executeQuery(jq, req.input, req.query, req.options);
  send({ type: "result", id: req.id, outcome });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "init") {
    try {
      jq = await loadJq({ wasmModule: msg.module });
      send({ type: "ready", version: jq.version });
      for (const req of queue.splice(0)) if (req.type === "run") handleRun(req);
    } catch (e) {
      send({ type: "init-error", message: e instanceof Error ? e.message : String(e) });
    }
    return;
  }
  if (!jq) queue.push(msg);
  else handleRun(msg);
};
