import { beforeAll, describe, expect, it } from "vitest";
import { loadJq, type Jq } from "jq-wasm";
import { executeQuery, parseJqStderr } from "./engine";
import { QUERY_EXAMPLES } from "./examples";
import { SAMPLE_JSON_TEXT } from "../sampleData";

let jq: Jq;
beforeAll(async () => {
  jq = await loadJq();
});

const doc = JSON.stringify({
  name: "shop",
  user: { email: "a@b.c" },
  users: [
    { name: "Ann", age: 30, active: true },
    { name: "Bob", age: 20, active: false },
    { name: "Cid", age: 40, active: true },
  ],
  items: [
    { name: "x", price: 10, category: "a" },
    { name: "y", price: 2.5, category: "b" },
    { name: "z", price: 7, category: "a" },
  ],
});

function run(query: string, input = doc, options = {}) {
  return executeQuery(jq, input, query, options);
}

function values(query: string, input = doc, options = {}) {
  const r = run(query, input, options);
  expect(r.error).toBeNull();
  return r.outputs.map((o) => JSON.parse(o));
}

describe("executeQuery", () => {
  it("runs identity and field access", () => {
    expect(values(".name")).toEqual(["shop"]);
    expect(values(".user.email")).toEqual(["a@b.c"]);
    expect(values(".items[0].name")).toEqual(["x"]);
  });

  it("selects active users", () => {
    expect(values(".users[] | select(.active == true) | .name")).toEqual(["Ann", "Cid"]);
    expect(values(".users[] | select(.age > 25) | .name")).toEqual(["Ann", "Cid"]);
  });

  it("sums prices", () => {
    expect(values(".items | map(.price) | add")).toEqual([19.5]);
  });

  it("returns multiple outputs from streams", () => {
    expect(values(".users[] | .name")).toEqual(["Ann", "Bob", "Cid"]);
    expect(values(".name, (.users | length)")).toEqual(["shop", 3]);
  });

  it("supports common array builtins", () => {
    expect(values(".items | length")).toEqual([3]);
    expect(values(".items | map(.price) | sort")).toEqual([[2.5, 7, 10]]);
    expect(values(".users | sort_by(.age) | map(.name)")).toEqual([["Bob", "Ann", "Cid"]]);
    expect(values(".items | map(.category) | unique")).toEqual([["a", "b"]]);
    expect(values(".users[0] | keys")).toEqual([["active", "age", "name"]]);
    expect(values(".items | reverse | map(.name)")).toEqual([["z", "y", "x"]]);
    expect(values(".items | group_by(.category) | map(length)")).toEqual([[2, 1]]);
    expect(values(".items | map({name: .name, price: .price}) | .[1]")).toEqual([{ name: "y", price: 2.5 }]);
    expect(values(".items[1:] | map(.name)")).toEqual([["y", "z"]]);
    expect(values(".users | map(.active and .age > 35)")).toEqual([[false, false, true]]);
  });

  it("handles every JSON type as input", () => {
    expect(values(".", "null")).toEqual([null]);
    expect(values(".", "true")).toEqual([true]);
    expect(values(". + 1", "41")).toEqual([42]);
    expect(values("ascii_upcase", '"hi"')).toEqual(["HI"]);
    expect(values("length", "[1,2]")).toEqual([2]);
    expect(values("keys", '{"b":1,"a":2}')).toEqual([["a", "b"]]);
  });

  it("preserves big number literals", () => {
    expect(run(".a", '{"a":100000000000000000001}').outputs).toEqual(["100000000000000000001"]);
  });

  it("produces no outputs for empty", () => {
    const r = run("empty");
    expect(r.outputs).toEqual([]);
    expect(r.error).toBeNull();
  });

  it("treats empty input as null input", () => {
    expect(values("[range(3)]", "")).toEqual([[0, 1, 2]]);
  });

  it("supports sortKeys and slurp options", () => {
    expect(run(".", '{"b":1,"a":2}', { sortKeys: true }).outputs).toEqual(['{"a":2,"b":1}']);
    expect(values("length", "1 2 3", { slurp: true })).toEqual([3]);
  });

  it("reports compile errors with location", () => {
    const r = run(".users[] | selec(.age)");
    expect(r.error?.kind).toBe("compile");
    expect(r.error?.message).toMatch(/selec\/1 is not defined/);
    expect(r.error?.line).toBe(1);
    expect(r.error?.column).toBe(12);
    expect(r.error?.detail).toContain("^");
  });

  it("reports syntax errors in queries", () => {
    const r = run(".a |||");
    expect(r.error?.kind).toBe("compile");
    expect(r.error?.message).toMatch(/syntax error/);
    expect(r.error?.message).not.toMatch(/shell quoting/);
  });

  it("reports runtime errors and keeps earlier outputs", () => {
    const r = run('1, error("boom"), 2');
    expect(r.outputs).toEqual(["1"]);
    expect(r.error).toMatchObject({ kind: "runtime", message: "boom" });
    expect(run(".name[]").error?.message).toMatch(/Cannot iterate over string/);
  });

  it("reports invalid input JSON", () => {
    expect(run(".", '{"a":').error?.kind).toBe("input");
  });

  it("surfaces debug output as warnings", () => {
    const r = run("debug | .name");
    expect(r.error).toBeNull();
    expect(r.outputs).toEqual(['"shop"']);
    expect(r.warnings[0]).toMatch(/DEBUG/);
  });

  it("runs every bundled example against the sample data without errors", () => {
    for (const group of QUERY_EXAMPLES) {
      for (const ex of group.examples) {
        const r = run(ex.query, SAMPLE_JSON_TEXT);
        expect(r.error, `${ex.label}: ${ex.query}`).toBeNull();
        expect(r.outputs.length, `${ex.label}: ${ex.query}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("parseJqStderr", () => {
  it("parses multi-line compile errors", () => {
    const r = parseJqStderr(
      "jq: error: foo/0 is not defined at <top-level>, line 3, column 2:\n     foo\n     ^^^\njq: 1 compile error",
      3,
    );
    expect(r.error).toEqual({ kind: "compile", message: "foo/0 is not defined", line: 3, column: 2, detail: " foo\n ^^^" });
  });

  it("falls back to raw stderr for unknown failures", () => {
    expect(parseJqStderr("something odd", 2).error).toEqual({ kind: "runtime", message: "something odd" });
  });
});
