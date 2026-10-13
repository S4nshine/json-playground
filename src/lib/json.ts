/**
 * Lossless JSON validation, formatting and minification.
 *
 * The scanner works on the raw text instead of round-tripping through
 * JSON.parse/JSON.stringify, so number literals (big integers, `1.50`,
 * `1e400`) and string escapes are preserved byte-for-byte. Parsing is
 * iterative, so deeply nested documents cannot overflow the call stack.
 */

export type IndentOption = 2 | 4 | "tab";
export type FormatStyle = "expanded" | "compact";

export interface JsonSyntaxError {
  message: string;
  /** 0-based character offset of the offending token. */
  offset: number;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** Number of characters to highlight (at least 1). */
  length: number;
}

export type ValidationResult =
  | { status: "empty" }
  | { status: "valid" }
  | { status: "invalid"; error: JsonSyntaxError };

export type TransformResult = { ok: true; text: string } | { ok: false; error: JsonSyntaxError | null };

// Token kinds
const T_OBJ_OPEN = 0;
const T_OBJ_CLOSE = 1;
const T_ARR_OPEN = 2;
const T_ARR_CLOSE = 3;
const T_COLON = 4;
const T_COMMA = 5;
const T_STRING = 6;
const T_NUMBER = 7;
const T_LITERAL = 8;

interface TokenStream {
  count: number;
  kinds: Uint8Array;
  starts: Uint32Array;
  ends: Uint32Array;
}

class ScanError extends Error {
  readonly offset: number;
  readonly length: number;
  constructor(message: string, offset: number, length = 1) {
    super(message);
    this.offset = offset;
    this.length = length;
  }
}

/** Convert a character offset into 1-based line/column numbers. */
export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: end - lineStart + 1 };
}

function isWhitespace(c: number): boolean {
  return c === 32 || c === 10 || c === 13 || c === 9;
}

function isDigit(c: number): boolean {
  return c >= 48 && c <= 57;
}

function isHex(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
}

function describeChar(text: string, i: number): string {
  if (i >= text.length) return "end of input";
  const ch = text[i];
  if (ch === "\n") return "line break";
  return `'${ch}'`;
}

/** Read a bare word (e.g. `undefined`, `True`) for friendlier error messages. */
function readWord(text: string, i: number): string {
  let j = i;
  while (j < text.length && /[A-Za-z0-9_$]/.test(text[j])) j++;
  return text.slice(i, j);
}

function scanString(text: string, start: number): number {
  // text[start] === '"'
  let i = start + 1;
  const len = text.length;
  while (i < len) {
    const c = text.charCodeAt(i);
    if (c === 34) return i + 1; // closing quote
    if (c === 92) {
      const e = text.charCodeAt(i + 1);
      if (e === 117) {
        // \uXXXX
        for (let k = 2; k < 6; k++) {
          if (!isHex(text.charCodeAt(i + k))) {
            throw new ScanError("Invalid unicode escape: expected 4 hex digits after \\u", i, Math.min(6, len - i));
          }
        }
        i += 6;
        continue;
      }
      if (e === 34 || e === 92 || e === 47 || e === 98 || e === 102 || e === 110 || e === 114 || e === 116) {
        i += 2;
        continue;
      }
      if (i + 1 >= len) break;
      throw new ScanError(`Invalid escape sequence '\\${text[i + 1]}' in string`, i, 2);
    }
    if (c < 32) {
      if (c === 10 || c === 13) {
        throw new ScanError("Unterminated string: line breaks must be escaped as \\n inside strings", start, i - start);
      }
      throw new ScanError("Control characters must be escaped inside strings", i, 1);
    }
    i++;
  }
  throw new ScanError("Unterminated string: missing closing '\"'", start, Math.max(1, Math.min(len - start, 40)));
}

function scanNumber(text: string, start: number): number {
  let i = start;
  if (text.charCodeAt(i) === 45) i++; // -
  const intStart = i;
  if (text.charCodeAt(i) === 48) {
    i++;
    if (isDigit(text.charCodeAt(i))) throw new ScanError("Numbers cannot have leading zeros", start, i - start + 1);
  } else if (isDigit(text.charCodeAt(i))) {
    while (isDigit(text.charCodeAt(i))) i++;
  } else {
    throw new ScanError("Invalid number: expected a digit", start, Math.max(1, i - start + 1));
  }
  if (i === intStart) throw new ScanError("Invalid number", start, 1);
  if (text.charCodeAt(i) === 46) {
    i++;
    if (!isDigit(text.charCodeAt(i))) throw new ScanError("Invalid number: expected a digit after '.'", start, i - start + 1);
    while (isDigit(text.charCodeAt(i))) i++;
  }
  const e = text.charCodeAt(i);
  if (e === 101 || e === 69) {
    i++;
    const s = text.charCodeAt(i);
    if (s === 43 || s === 45) i++;
    if (!isDigit(text.charCodeAt(i))) throw new ScanError("Invalid number: expected a digit in exponent", start, i - start + 1);
    while (isDigit(text.charCodeAt(i))) i++;
  }
  return i;
}

const CTX_TOP = 0;
const CTX_OBJECT = 1;
const CTX_ARRAY = 2;

// Parser expectations
const EXPECT_VALUE = 0;
const EXPECT_KEY_OR_CLOSE = 1; // right after '{'
const EXPECT_KEY = 2; // after ',' in object
const EXPECT_COLON = 3;
const EXPECT_COMMA_OR_CLOSE = 4;
const EXPECT_VALUE_OR_CLOSE = 5; // right after '['
const EXPECT_END = 6;

/**
 * Tokenize and validate JSON in a single pass. Throws ScanError on invalid input.
 * Returns null for empty / whitespace-only input.
 */
function tokenize(text: string): TokenStream | null {
  const len = text.length;
  let cap = Math.max(16, Math.min(len >> 1, 1 << 20));
  let kinds = new Uint8Array(cap);
  let starts = new Uint32Array(cap);
  let ends = new Uint32Array(cap);
  let count = 0;

  const push = (kind: number, start: number, end: number) => {
    if (count === cap) {
      cap *= 2;
      const k = new Uint8Array(cap);
      k.set(kinds);
      kinds = k;
      const s = new Uint32Array(cap);
      s.set(starts);
      starts = s;
      const e = new Uint32Array(cap);
      e.set(ends);
      ends = e;
    }
    kinds[count] = kind;
    starts[count] = start;
    ends[count] = end;
    count++;
  };

  const stack: number[] = [CTX_TOP];
  const openOffsets: number[] = [-1];
  let expect = EXPECT_VALUE;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // tolerate a UTF-8 BOM

  const afterValue = () => {
    expect = stack[stack.length - 1] === CTX_TOP ? EXPECT_END : EXPECT_COMMA_OR_CLOSE;
  };

  const unexpected = (pos: number): never => {
    const c = text[pos];
    const ctx = stack[stack.length - 1];
    if (c === "/" && (text[pos + 1] === "/" || text[pos + 1] === "*")) {
      throw new ScanError("Comments are not allowed in JSON", pos, 2);
    }
    if (c === "'") {
      throw new ScanError("Strings must use double quotes (\") — single quotes are not valid JSON", pos, 1);
    }
    switch (expect) {
      case EXPECT_END:
        throw new ScanError(`Unexpected ${describeChar(text, pos)} after the end of the JSON value`, pos, 1);
      case EXPECT_COLON:
        throw new ScanError(`Expected ':' after property name but found ${describeChar(text, pos)}`, pos, 1);
      case EXPECT_COMMA_OR_CLOSE:
        throw new ScanError(
          ctx === CTX_OBJECT
            ? `Expected ',' or '}' after property value but found ${describeChar(text, pos)}`
            : `Expected ',' or ']' after array element but found ${describeChar(text, pos)}`,
          pos,
          1,
        );
      case EXPECT_KEY:
      case EXPECT_KEY_OR_CLOSE: {
        const word = readWord(text, pos);
        if (word) throw new ScanError(`Property names must be double-quoted strings (found ${word})`, pos, word.length);
        throw new ScanError(`Expected a property name in double quotes but found ${describeChar(text, pos)}`, pos, 1);
      }
      default: {
        const word = readWord(text, pos);
        if (word) {
          const hint =
            word === "True" || word === "False" || word === "NULL" || word === "None" || word === "Null"
              ? ` — JSON literals are lowercase (true, false, null)`
              : word === "undefined" || word === "NaN" || word === "Infinity"
                ? ` — '${word}' is not a valid JSON value`
                : "";
          throw new ScanError(`Unexpected token '${word}'${hint}`, pos, word.length);
        }
        throw new ScanError(`Expected a JSON value but found ${describeChar(text, pos)}`, pos, 1);
      }
    }
  };

  while (i < len) {
    const c = text.charCodeAt(i);
    if (isWhitespace(c)) {
      i++;
      continue;
    }
    switch (c) {
      case 123: // {
        if (expect !== EXPECT_VALUE && expect !== EXPECT_VALUE_OR_CLOSE) unexpected(i);
        push(T_OBJ_OPEN, i, i + 1);
        stack.push(CTX_OBJECT);
        openOffsets.push(i);
        expect = EXPECT_KEY_OR_CLOSE;
        i++;
        break;
      case 91: // [
        if (expect !== EXPECT_VALUE && expect !== EXPECT_VALUE_OR_CLOSE) unexpected(i);
        push(T_ARR_OPEN, i, i + 1);
        stack.push(CTX_ARRAY);
        openOffsets.push(i);
        expect = EXPECT_VALUE_OR_CLOSE;
        i++;
        break;
      case 125: // }
        if (stack[stack.length - 1] !== CTX_OBJECT) {
          if (stack[stack.length - 1] === CTX_ARRAY) throw new ScanError("Mismatched bracket: expected ']' but found '}'", i, 1);
          unexpected(i);
        }
        if (expect === EXPECT_KEY) throw new ScanError("Trailing comma is not allowed before '}'", lastCommaBefore(text, i), 1);
        if (expect !== EXPECT_KEY_OR_CLOSE && expect !== EXPECT_COMMA_OR_CLOSE) unexpected(i);
        push(T_OBJ_CLOSE, i, i + 1);
        stack.pop();
        openOffsets.pop();
        afterValue();
        i++;
        break;
      case 93: // ]
        if (stack[stack.length - 1] !== CTX_ARRAY) {
          if (stack[stack.length - 1] === CTX_OBJECT) throw new ScanError("Mismatched bracket: expected '}' but found ']'", i, 1);
          unexpected(i);
        }
        if (expect === EXPECT_VALUE) throw new ScanError("Trailing comma is not allowed before ']'", lastCommaBefore(text, i), 1);
        if (expect !== EXPECT_VALUE_OR_CLOSE && expect !== EXPECT_COMMA_OR_CLOSE) unexpected(i);
        push(T_ARR_CLOSE, i, i + 1);
        stack.pop();
        openOffsets.pop();
        afterValue();
        i++;
        break;
      case 58: // :
        if (expect !== EXPECT_COLON) unexpected(i);
        push(T_COLON, i, i + 1);
        expect = EXPECT_VALUE;
        i++;
        break;
      case 44: // ,
        if (expect !== EXPECT_COMMA_OR_CLOSE) {
          if (expect === EXPECT_VALUE || expect === EXPECT_KEY) throw new ScanError("Unexpected ',' — expected a value", i, 1);
          unexpected(i);
        }
        push(T_COMMA, i, i + 1);
        expect = stack[stack.length - 1] === CTX_OBJECT ? EXPECT_KEY : EXPECT_VALUE;
        i++;
        break;
      case 34: {
        // "
        const end = scanString(text, i);
        if (expect === EXPECT_KEY || expect === EXPECT_KEY_OR_CLOSE) {
          push(T_STRING, i, end);
          expect = EXPECT_COLON;
        } else if (expect === EXPECT_VALUE || expect === EXPECT_VALUE_OR_CLOSE) {
          push(T_STRING, i, end);
          afterValue();
        } else {
          unexpected(i);
        }
        i = end;
        break;
      }
      default: {
        if (c === 45 || isDigit(c)) {
          if (expect !== EXPECT_VALUE && expect !== EXPECT_VALUE_OR_CLOSE) unexpected(i);
          const end = scanNumber(text, i);
          push(T_NUMBER, i, end);
          afterValue();
          i = end;
          break;
        }
        if (text.startsWith("true", i) || text.startsWith("null", i) || text.startsWith("false", i)) {
          const n = text.charCodeAt(i) === 102 ? 5 : 4;
          if (/[A-Za-z0-9_$]/.test(text[i + n] ?? "")) unexpected(i);
          if (expect !== EXPECT_VALUE && expect !== EXPECT_VALUE_OR_CLOSE) unexpected(i);
          push(T_LITERAL, i, i + n);
          afterValue();
          i += n;
          break;
        }
        unexpected(i);
      }
    }
  }

  if (count === 0) return null;
  if (stack.length > 1) {
    const ctx = stack[stack.length - 1];
    const open = openOffsets[openOffsets.length - 1];
    const missing = ctx === CTX_OBJECT ? "}" : "]";
    if (expect === EXPECT_COLON || expect === EXPECT_VALUE) {
      throw new ScanError(`Unexpected end of input: expected a value (unclosed '${ctx === CTX_OBJECT ? "{" : "["}' opened here)`, open, 1);
    }
    throw new ScanError(`Unexpected end of input: missing '${missing}' to close the ${ctx === CTX_OBJECT ? "object" : "array"} opened here`, open, 1);
  }
  if (expect === EXPECT_VALUE) throw new ScanError("Unexpected end of input: expected a value", len, 1);
  return { count, kinds, starts, ends };
}

function lastCommaBefore(text: string, pos: number): number {
  for (let j = pos - 1; j >= 0; j--) {
    if (text[j] === ",") return j;
  }
  return pos;
}

function toSyntaxError(text: string, err: ScanError): JsonSyntaxError {
  const offset = Math.min(err.offset, text.length);
  const { line, column } = offsetToLineColumn(text, offset);
  return { message: err.message, offset, line, column, length: Math.max(1, err.length) };
}

function run<T>(text: string, fn: (tokens: TokenStream | null) => T): T | { error: JsonSyntaxError } {
  try {
    return fn(tokenize(text));
  } catch (e) {
    if (e instanceof ScanError) return { error: toSyntaxError(text, e) };
    throw e;
  }
}

/** Validate JSON text, returning the precise location of the first syntax error. */
export function validateJson(text: string): ValidationResult {
  const r = run(text, (tokens) => tokens);
  if (r && "error" in r) return { status: "invalid", error: r.error };
  return r === null ? { status: "empty" } : { status: "valid" };
}

function indentUnit(indent: IndentOption): string {
  return indent === "tab" ? "\t" : " ".repeat(indent);
}

/**
 * Measure the single-line width of the container starting at token `open`.
 * Returns -1 if it exceeds `budget` (scan stops early, so this is cheap).
 */
function inlineWidth(t: TokenStream, open: number, budget: number): number {
  let depth = 0;
  let width = 0;
  for (let k = open; k < t.count; k++) {
    const kind = t.kinds[k];
    if (kind === T_OBJ_OPEN || kind === T_ARR_OPEN) depth++;
    else if (kind === T_OBJ_CLOSE || kind === T_ARR_CLOSE) depth--;
    width += t.ends[k] - t.starts[k];
    if (kind === T_COMMA || kind === T_COLON) width += 1; // trailing space
    if (width > budget) return -1;
    if (depth === 0) return width;
  }
  return width;
}

export interface FormatOptions {
  indent?: IndentOption;
  style?: FormatStyle;
  /** Target line width for the compact style. */
  printWidth?: number;
}

function formatTokens(text: string, t: TokenStream, opts: FormatOptions): string {
  const unit = indentUnit(opts.indent ?? 2);
  const compact = opts.style === "compact";
  const printWidth = opts.printWidth ?? 80;
  const unitWidth = unit === "\t" ? 2 : unit.length;
  const out: string[] = [];
  let depth = 0;
  // >0 while emitting a container on a single line (compact style)
  let inlineDepth = 0;
  const indentCache: string[] = [""];
  const pad = (d: number) => (indentCache[d] ??= unit.repeat(d));
  let column = 0; // approximate current column (for compact decisions)

  for (let k = 0; k < t.count; k++) {
    const kind = t.kinds[k];
    const tok = text.slice(t.starts[k], t.ends[k]);
    switch (kind) {
      case T_OBJ_OPEN:
      case T_ARR_OPEN: {
        const nextKind = t.kinds[k + 1];
        const isEmpty = nextKind === T_OBJ_CLOSE || nextKind === T_ARR_CLOSE;
        if (isEmpty) {
          out.push(kind === T_OBJ_OPEN ? "{}" : "[]");
          column += 2;
          k++;
          break;
        }
        if (inlineDepth > 0) {
          inlineDepth++;
          out.push(tok);
          column++;
          break;
        }
        if (compact) {
          const w = inlineWidth(t, k, printWidth - column);
          if (w >= 0) {
            inlineDepth = 1;
            out.push(tok);
            column++;
            break;
          }
        }
        depth++;
        out.push(tok, "\n", pad(depth));
        column = depth * unitWidth;
        break;
      }
      case T_OBJ_CLOSE:
      case T_ARR_CLOSE:
        if (inlineDepth > 0) {
          inlineDepth--;
          out.push(tok);
          column++;
          break;
        }
        depth--;
        out.push("\n", pad(depth), tok);
        column = depth * unitWidth + 1;
        break;
      case T_COLON:
        out.push(": ");
        column += 2;
        break;
      case T_COMMA:
        if (inlineDepth > 0) {
          out.push(", ");
          column += 2;
        } else {
          out.push(",\n", pad(depth));
          column = depth * unitWidth;
        }
        break;
      default:
        out.push(tok);
        column += tok.length;
    }
  }
  return out.join("");
}

/** Pretty-print JSON text. Returns the syntax error if the input is invalid. */
export function formatJson(text: string, opts: FormatOptions = {}): TransformResult {
  const r = run(text, (tokens) => (tokens ? formatTokens(text, tokens, opts) : null));
  if (r && typeof r === "object" && "error" in r) return { ok: false, error: r.error };
  if (r === null) return { ok: false, error: null };
  return { ok: true, text: r };
}

/** Remove all insignificant whitespace from JSON text. */
export function minifyJson(text: string): TransformResult {
  const r = run(text, (t) => {
    if (!t) return null;
    const out: string[] = new Array(t.count);
    for (let k = 0; k < t.count; k++) out[k] = text.slice(t.starts[k], t.ends[k]);
    return out.join("");
  });
  if (r && typeof r === "object" && "error" in r) return { ok: false, error: r.error };
  if (r === null) return { ok: false, error: null };
  return { ok: true, text: r };
}

export interface TextStats {
  chars: number;
  lines: number;
  bytes: number;
}

/** Character, line and UTF-8 byte counts. */
export function textStats(text: string): TextStats {
  let lines = text.length === 0 ? 0 : 1;
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) lines++;
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return { chars: text.length, lines, bytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
