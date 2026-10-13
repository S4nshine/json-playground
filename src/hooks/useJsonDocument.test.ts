import { describe, expect, it } from "vitest";
import { analyzeJson } from "./useJsonDocument";
import { generateDataset } from "../lib/sampleData";

describe("analyzeJson", () => {
  it("parses valid input and reports stats", () => {
    const r = analyzeJson('{"a": [1, 2]}\n');
    expect(r.validation).toEqual({ status: "valid" });
    expect(r.parsed).toEqual({ value: { a: [1, 2] } });
    expect(r.stats.lines).toBe(2);
  });

  it("distinguishes a parsed null from an unparsed document", () => {
    expect(analyzeJson("null").parsed).toEqual({ value: null });
    expect(analyzeJson("").parsed).toBeNull();
  });

  it("reports the location of errors", () => {
    const r = analyzeJson('{\n  "a": 1,\n}');
    expect(r.validation.status).toBe("invalid");
    if (r.validation.status === "invalid") expect([r.validation.error.line, r.validation.error.column]).toEqual([2, 9]);
    expect(r.parsed).toBeNull();
  });

  it("accepts a UTF-8 byte order mark", () => {
    const r = analyzeJson('﻿{"a":1}');
    expect(r.validation.status).toBe("valid");
    expect(r.parsed).toEqual({ value: { a: 1 } });
  });

  it("handles a multi-megabyte document quickly", () => {
    const text = generateDataset(10_000);
    expect(text.length).toBeGreaterThan(4_000_000);
    const t = performance.now();
    const r = analyzeJson(text);
    expect(r.validation.status).toBe("valid");
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
