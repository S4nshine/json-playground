/** Structural comparison of two parsed JSON values. */
import { valueType, type PathSegment } from "./jsonPath";

export type DiffKind = "added" | "removed" | "changed" | "type";

export interface DiffEntry {
  kind: DiffKind;
  path: PathSegment[];
  left?: unknown;
  right?: unknown;
}

export interface DiffResult {
  entries: DiffEntry[];
  truncated: boolean;
  counts: Record<DiffKind, number>;
}

export function diffJson(left: unknown, right: unknown, maxEntries = 5000): DiffResult {
  const entries: DiffEntry[] = [];
  const counts: Record<DiffKind, number> = { added: 0, removed: 0, changed: 0, type: 0 };
  let truncated = false;
  const add = (e: DiffEntry) => {
    counts[e.kind]++;
    if (entries.length < maxEntries) entries.push(e);
    else truncated = true;
  };

  type Frame = { a: unknown; b: unknown; path: PathSegment[]; side?: "left" | "right" };
  const MISSING = undefined;
  const stack: Frame[] = [{ a: left, b: right, path: [] }];
  while (stack.length > 0) {
    const { a, b, path, side } = stack.pop()!;
    if (side === "left") {
      add({ kind: "removed", path, left: a });
      continue;
    }
    if (side === "right") {
      add({ kind: "added", path, right: b });
      continue;
    }
    const ta = valueType(a);
    const tb = valueType(b);
    if (ta !== tb) {
      add({ kind: "type", path, left: a, right: b });
      continue;
    }
    // Children are pushed in reverse so entries come out in document order.
    if (ta === "array") {
      const aa = a as unknown[];
      const bb = b as unknown[];
      for (let i = Math.max(aa.length, bb.length) - 1; i >= 0; i--) {
        const p = [...path, i];
        if (i >= aa.length) stack.push({ a: MISSING, b: bb[i], path: p, side: "right" });
        else if (i >= bb.length) stack.push({ a: aa[i], b: MISSING, path: p, side: "left" });
        else stack.push({ a: aa[i], b: bb[i], path: p });
      }
    } else if (ta === "object") {
      const ao = a as Record<string, unknown>;
      const bo = b as Record<string, unknown>;
      const keys = [...new Set([...Object.keys(ao), ...Object.keys(bo)])];
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i];
        const p = [...path, k];
        const inA = Object.prototype.hasOwnProperty.call(ao, k);
        const inB = Object.prototype.hasOwnProperty.call(bo, k);
        if (!inB) stack.push({ a: ao[k], b: MISSING, path: p, side: "left" });
        else if (!inA) stack.push({ a: MISSING, b: bo[k], path: p, side: "right" });
        else stack.push({ a: ao[k], b: bo[k], path: p });
      }
    } else if (a !== b) {
      add({ kind: "changed", path, left: a, right: b });
    }
  }
  return { entries, truncated, counts };
}
