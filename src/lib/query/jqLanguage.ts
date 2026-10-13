/** CodeMirror language support for jq: syntax highlighting + completion. */
import { StreamLanguage, LanguageSupport, type StreamParser } from "@codemirror/language";
import type { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";

const KEYWORDS = new Set([
  "def", "if", "then", "elif", "else", "end", "as", "reduce", "foreach", "try", "catch",
  "label", "import", "include", "and", "or", "not", "__loc__",
]);

export const JQ_BUILTINS = [
  "length", "utf8bytelength", "not", "keys", "keys_unsorted", "values", "has", "in", "map", "map_values",
  "path", "del", "getpath", "setpath", "delpaths", "to_entries", "from_entries", "with_entries", "select",
  "empty", "error", "halt", "halt_error", "paths", "leaf_paths", "add", "any", "all", "flatten", "range",
  "floor", "sqrt", "pow", "log", "exp", "log10", "round", "ceil", "fabs", "abs", "tostring", "tonumber",
  "type", "infinite", "nan", "isinfinite", "isnan", "isnormal", "sort", "sort_by", "group_by", "min", "max",
  "min_by", "max_by", "unique", "unique_by", "reverse", "contains", "inside", "indices", "index", "rindex",
  "startswith", "endswith", "combinations", "ltrimstr", "rtrimstr", "trimstr", "trim", "ltrim", "rtrim",
  "explode", "implode", "split", "join", "ascii_downcase", "ascii_upcase", "ascii", "recurse", "env",
  "transpose", "first", "last", "nth", "until", "while", "repeat", "limit", "skip", "input", "inputs",
  "debug", "stderr", "input_filename", "splits", "sub", "gsub", "test", "match", "capture", "scan", "todate",
  "fromdate", "now", "mktime", "gmtime", "localtime", "strftime", "strptime", "dateadd", "datesub", "date",
  "todateiso8601", "fromdateiso8601", "tojson", "fromjson", "arrays", "objects", "iterables", "booleans",
  "numbers", "strings", "nulls", "scalars", "tostream", "fromstream", "truncate_stream", "builtins",
  "input_line_number", "significand", "drem", "ldexp", "scalb", "nearbyint", "trunc", "toarray", "pick",
  "have_literal_numbers", "have_decnum", "@base64", "@base64d", "@uri", "@csv", "@tsv", "@html", "@json",
  "@text", "@sh", "walk", "$ENV", "IN", "INDEX", "@base32", "@base32d",
];
const BUILTIN_SET = new Set(JQ_BUILTINS.filter((b) => /^[a-zA-Z_]/.test(b)));

interface JqState {
  inString: boolean;
  interpDepth: number[]; // paren depth stack for "\( ... )" interpolations
  parenDepth: number;
}

const parser: StreamParser<JqState> = {
  name: "jq",
  startState: () => ({ inString: false, interpDepth: [], parenDepth: 0 }),
  token(stream, state) {
    if (state.inString) {
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === "\\") {
          if (stream.peek() === "(") {
            stream.next();
            state.inString = false;
            state.interpDepth.push(state.parenDepth);
            state.parenDepth++;
            return "string";
          }
          stream.next();
        } else if (ch === '"') {
          state.inString = false;
          return "string";
        }
      }
      return "string";
    }
    if (stream.eatSpace()) return null;
    const ch = stream.peek()!;
    if (ch === "#") {
      stream.skipToEnd();
      return "comment";
    }
    if (ch === '"') {
      stream.next();
      state.inString = true;
      return "string";
    }
    if (ch === "(") {
      stream.next();
      state.parenDepth++;
      return "paren";
    }
    if (ch === ")") {
      stream.next();
      state.parenDepth--;
      const top = state.interpDepth[state.interpDepth.length - 1];
      if (top !== undefined && top === state.parenDepth) {
        state.interpDepth.pop();
        state.inString = true;
        return "string";
      }
      return "paren";
    }
    if (stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) return "number";
    if (stream.match(/^\$__loc__|^\$[A-Za-z_][A-Za-z0-9_]*/)) return "variableName";
    if (stream.match(/^@[A-Za-z0-9_]+/)) return "atom";
    if (stream.match(/^\.[A-Za-z_][A-Za-z0-9_]*/)) return "propertyName";
    if (stream.match(/^\.\./)) return "operator";
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*(::[A-Za-z_][A-Za-z0-9_]*)*/)) {
      const word = stream.current();
      if (KEYWORDS.has(word)) return "keyword";
      if (word === "true" || word === "false") return "bool";
      if (word === "null") return "null";
      if (BUILTIN_SET.has(word)) return "function(variableName)";
      return "variableName";
    }
    if (stream.match(/^(\?\/\/|\/\/=|\|=|\+=|-=|\*=|\/=|%=|==|!=|<=|>=|\/\/|[|,+\-*/%<>=?])/)) return "operator";
    if (stream.match(/^[[\]{}]/)) return "bracket";
    if (stream.match(/^[.;:]/)) return "punctuation";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "#" }, closeBrackets: { brackets: ["(", "[", "{", '"'] } },
};

export const jqStreamLanguage = StreamLanguage.define(parser);

const builtinCompletions: Completion[] = JQ_BUILTINS.map((name) => ({
  label: name,
  type: name.startsWith("@") || name.startsWith("$") ? "constant" : "function",
}));
const keywordCompletions: Completion[] = [...KEYWORDS, "true", "false", "null"].map((k) => ({ label: k, type: "keyword" }));

/**
 * Completion source offering jq builtins/keywords and field names found in
 * the current input document (`getFields` is read lazily on each request).
 */
export function jqCompletionSource(getFields: () => readonly string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const field = context.matchBefore(/\.[A-Za-z_][A-Za-z0-9_]*|\.$/);
    if (field) {
      const options = getFields().map((f) => ({
        label: /^[A-Za-z_][A-Za-z0-9_]*$/.test(f) ? `.${f}` : `.${JSON.stringify(f)}`,
        type: "property",
      }));
      if (options.length === 0) return null;
      return { from: field.from, options, validFor: /^\.[A-Za-z0-9_]*$/ };
    }
    const word = context.matchBefore(/[@A-Za-z_][A-Za-z0-9_]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return { from: word.from, options: [...keywordCompletions, ...builtinCompletions], validFor: /^[@A-Za-z0-9_]*$/ };
  };
}

export function jqLanguage(): LanguageSupport {
  return new LanguageSupport(jqStreamLanguage);
}
