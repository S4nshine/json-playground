import { describe, expect, it } from "vitest";
import { diffJson } from "./jsonDiff";
import { collectFieldNames, pathToJq } from "./jsonPath";

describe("diffJson", () => {
  it("returns no entries for equal documents", () => {
    const doc = { a: [1, { b: null }], c: "x" };
    expect(diffJson(doc, structuredClone(doc)).entries).toEqual([]);
  });

  it("detects added, removed, changed and type changes in document order", () => {
    const r = diffJson({ a: 1, b: [1, 2, 3], c: { d: true }, e: "s" }, { a: 2, b: [1, 2], c: { d: true, f: 0 }, e: 5, g: null });
    expect(r.entries.map((e) => [e.kind, pathToJq(e.path)])).toEqual([
      ["changed", ".a"],
      ["removed", ".b[2]"],
      ["added", ".c.f"],
      ["type", ".e"],
      ["added", ".g"],
    ]);
    expect(r.counts).toEqual({ added: 2, removed: 1, changed: 1, type: 1 });
  });

  it("truncates very large diffs", () => {
    const a = Array.from({ length: 100 }, (_, i) => i);
    const b = a.map((x) => x + 1);
    const r = diffJson(a, b, 10);
    expect(r.entries).toHaveLength(10);
    expect(r.truncated).toBe(true);
    expect(r.counts.changed).toBe(100);
  });
});

describe("jsonPath", () => {
  it("renders jq paths", () => {
    expect(pathToJq([])).toBe(".");
    expect(pathToJq(["users", 0, "name"])).toBe(".users[0].name");
    expect(pathToJq(["odd key", "x-y", 2])).toBe('."odd key"["x-y"][2]');
    expect(pathToJq([3])).toBe(".[3]");
  });

  it("collects field names", () => {
    expect(collectFieldNames({ b: 1, a: [{ c: 1 }, { d: { e: 2 } }] })).toEqual(["a", "b", "c", "d", "e"]);
  });
});
