export type PathSegment = string | number;

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Render a path as a jq expression, e.g. `.users[0].name` or `.["odd key"]`. */
export function pathToJq(path: readonly PathSegment[]): string {
  if (path.length === 0) return ".";
  let out = "";
  for (const seg of path) {
    if (typeof seg === "number") out += `[${seg}]`;
    else if (IDENT.test(seg)) out += `.${seg}`;
    else out += out === "" ? `.${JSON.stringify(seg)}` : `[${JSON.stringify(seg)}]`;
  }
  return out.startsWith(".") ? out : `.${out}`;
}

export function valueType(v: unknown): "object" | "array" | "string" | "number" | "boolean" | "null" {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v as "object" | "string" | "number" | "boolean";
}

/** Collect distinct object keys (breadth-first, bounded) for autocompletion. */
export function collectFieldNames(root: unknown, maxNodes = 20_000, maxKeys = 500): string[] {
  const keys = new Set<string>();
  const queue: unknown[] = [root];
  let visited = 0;
  for (let i = 0; i < queue.length && visited < maxNodes && keys.size < maxKeys; i++) {
    const v = queue[i];
    visited++;
    if (Array.isArray(v)) {
      for (let j = 0; j < v.length && j < 50; j++) queue.push(v[j]);
    } else if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v)) {
        keys.add(k);
        if (child && typeof child === "object") queue.push(child);
      }
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}
