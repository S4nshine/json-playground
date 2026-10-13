import { describe, expect, it } from "vitest";
import { formatJson, minifyJson, offsetToLineColumn, textStats, validateJson } from "./json";

const nested = '{"a":1,"b":[1,2,{"c":null,"d":[true,false]}],"e":{"f":"x","g":{}},"h":[]}';

function ok(r: ReturnType<typeof formatJson>): string {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.text;
}

describe("validateJson", () => {
  it("accepts every JSON value type", () => {
    for (const v of ["null", "true", "false", "0", "-1.5e10", '"s"', "[]", "{}", nested, ' \n {"a" : [ 1 ] } \n']) {
      expect(validateJson(v)).toEqual({ status: "valid" });
    }
  });

  it("reports empty input separately", () => {
    expect(validateJson("")).toEqual({ status: "empty" });
    expect(validateJson("  \n\t ")).toEqual({ status: "empty" });
  });

  it("reports line and column of syntax errors", () => {
    const r = validateJson('{\n  "a": 1,\n  "b": tru\n}');
    expect(r.status).toBe("invalid");
    if (r.status !== "invalid") return;
    expect(r.error.line).toBe(3);
    expect(r.error.column).toBe(8);
    expect(r.error.message).toMatch(/tru/);
  });

  it.each([
    ['{"a":1,}', /Trailing comma/, 1, 7],
    ["[1,2,]", /Trailing comma/, 1, 5],
    ["{'a':1}", /double quotes/, 1, 2],
    ['{"a" 1}', /Expected ':'/, 1, 6],
    ['{"a":1 "b":2}', /Expected ',' or '}'/, 1, 8],
    ["[1 2]", /Expected ',' or ']'/, 1, 4],
    ['{"a":[1,2}', /Mismatched/, 1, 10],
    ['{"a":1', /missing '}'/, 1, 1],
    ['"abc', /Unterminated string/, 1, 1],
    ["01", /leading zeros/, 1, 1],
    ["1.", /digit after '.'/, 1, 1],
    ['{"a":undefined}', /undefined/, 1, 6],
    ["True", /lowercase/, 1, 1],
    ["// c\n{}", /Comments/, 1, 1],
    ['"\\x"', /Invalid escape/, 1, 2],
    ['"\\u12"', /unicode escape/, 1, 2],
    ["{} {}", /after the end/, 1, 4],
    ["{a:1}", /double-quoted/, 1, 2],
  ])("rejects %s", (input, message, line, column) => {
    const r = validateJson(input);
    expect(r.status).toBe("invalid");
    if (r.status !== "invalid") return;
    expect(r.error.message).toMatch(message);
    expect([r.error.line, r.error.column]).toEqual([line, column]);
  });

  it("handles very deep nesting without stack overflow", () => {
    const deep = "[".repeat(100_000) + "]".repeat(100_000);
    expect(validateJson(deep).status).toBe("valid");
  });
});

describe("formatJson", () => {
  it("formats nested JSON with 2 spaces", () => {
    expect(ok(formatJson(nested, { indent: 2 }))).toBe(
      [
        "{",
        '  "a": 1,',
        '  "b": [',
        "    1,",
        "    2,",
        "    {",
        '      "c": null,',
        '      "d": [',
        "        true,",
        "        false",
        "      ]",
        "    }",
        "  ],",
        '  "e": {',
        '    "f": "x",',
        '    "g": {}',
        "  },",
        '  "h": []',
        "}",
      ].join("\n"),
    );
  });

  it("supports 4 spaces and tabs", () => {
    expect(ok(formatJson('{"a":[1]}', { indent: 4 }))).toBe('{\n    "a": [\n        1\n    ]\n}');
    expect(ok(formatJson('{"a":[1]}', { indent: "tab" }))).toBe('{\n\t"a": [\n\t\t1\n\t]\n}');
  });

  it("matches JSON.stringify for ordinary documents", () => {
    const value = JSON.parse(nested);
    expect(ok(formatJson(nested, { indent: 2 }))).toBe(JSON.stringify(value, null, 2));
    expect(ok(formatJson(nested, { indent: 4 }))).toBe(JSON.stringify(value, null, 4));
  });

  it("keeps short containers inline in compact style", () => {
    const text = ok(formatJson('{"point":{"x":1,"y":2},"tags":["a","b"],"long":[' + '"xxxxxxxxxx",'.repeat(10) + '"end"]}', { style: "compact" }));
    expect(text).toContain('"point": {"x": 1, "y": 2}');
    expect(text).toContain('"tags": ["a", "b"]');
    expect(text).toMatch(/"long": \[\n/);
  });

  it("preserves number literals and string escapes exactly", () => {
    const src = '{"big":12345678901234567890123,"f":1.50,"e":1E+400,"s":"line\\nbreak \\u00e9 \\"q\\""}';
    const out = ok(formatJson(src));
    expect(out).toContain("12345678901234567890123");
    expect(out).toContain("1.50");
    expect(out).toContain("1E+400");
    expect(out).toContain('"line\\nbreak \\u00e9 \\"q\\""');
  });

  it("formats scalars", () => {
    expect(ok(formatJson(" 42 "))).toBe("42");
    expect(ok(formatJson('"hi"'))).toBe('"hi"');
  });

  it("returns the error for invalid input and null error for empty input", () => {
    const bad = formatJson("{");
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error?.message).toMatch(/missing/);
    expect(formatJson("   ")).toEqual({ ok: false, error: null });
  });
});

describe("minifyJson", () => {
  it("removes whitespace and round-trips", () => {
    const pretty = ok(formatJson(nested, { indent: 4 }));
    expect(ok(minifyJson(pretty))).toBe(nested);
  });

  it("keeps whitespace inside strings", () => {
    expect(ok(minifyJson('{ "a b" : " c  d " }'))).toBe('{"a b":" c  d "}');
  });

  it("is lossless for big numbers", () => {
    expect(ok(minifyJson("[ 100000000000000000001 , 1.0 ]"))).toBe("[100000000000000000001,1.0]");
  });
});

describe("helpers", () => {
  it("computes line/column", () => {
    expect(offsetToLineColumn("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
  });

  it("computes stats with UTF-8 byte length", () => {
    expect(textStats('{"é":"😀"}\n')).toEqual({ chars: 11, lines: 2, bytes: 14 });
    expect(textStats("")).toEqual({ chars: 0, lines: 0, bytes: 0 });
  });

  it("formats a large document quickly", () => {
    const big = JSON.stringify(Array.from({ length: 50_000 }, (_, i) => ({ id: i, name: `n${i}`, tags: ["a", "b"], v: i * 1.5 })));
    const t = performance.now();
    const r = formatJson(big);
    expect(r.ok).toBe(true);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
