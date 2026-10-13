/**
 * A single CodeMirror theme driven by CSS custom properties, so switching
 * between light and dark only requires toggling the `.dark` class.
 */
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const editorChrome = EditorView.theme({
  "&": {
    color: "var(--text)",
    backgroundColor: "var(--surface)",
    height: "100%",
  },
  "&.cm-readonly-surface": { backgroundColor: "var(--surface-readonly)" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { caretColor: "var(--accent)", padding: "6px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--syn-selection) !important" },
  ".cm-activeLine": { backgroundColor: "var(--syn-active-line)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--text-faint)",
    border: "none",
    paddingLeft: "4px",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--text-muted)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 6px 0 4px", minWidth: "28px" },
  ".cm-foldGutter .cm-gutterElement": { padding: "0 2px", cursor: "pointer", color: "var(--text-faint)" },
  ".cm-foldGutter .cm-gutterElement:hover": { color: "var(--text)" },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--surface-3)",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    borderRadius: "3px",
    padding: "0 4px",
    margin: "0 2px",
  },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--accent-soft)",
    outline: "1px solid var(--accent)",
    borderRadius: "2px",
  },
  "&.cm-focused .cm-nonmatchingBracket": { backgroundColor: "var(--danger-soft)", outline: "1px solid var(--danger)" },
  ".cm-searchMatch": { backgroundColor: "var(--syn-match)", outline: "1px solid rgb(220 170 0 / 0.5)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgb(250 160 40 / 0.45)" },
  ".cm-selectionMatch": { backgroundColor: "var(--accent-soft)" },
  ".cm-placeholder": { color: "var(--text-faint)", fontStyle: "normal" },
  ".cm-panels": {
    backgroundColor: "var(--surface-2)",
    color: "var(--text)",
  },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--border)" },
  ".cm-panel.cm-search": { padding: "6px 8px" },
  ".cm-panel.cm-search input.cm-textfield": {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border-strong)",
    borderRadius: "4px",
    color: "var(--text)",
    padding: "3px 6px",
  },
  ".cm-panel.cm-search .cm-button": {
    backgroundImage: "none",
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border-strong)",
    borderRadius: "4px",
    color: "var(--text)",
    padding: "2px 8px",
  },
  ".cm-panel.cm-search .cm-button:hover": { backgroundColor: "var(--surface-3)" },
  ".cm-panel.cm-search button[name=close]": { color: "var(--text-muted)", fontSize: "16px" },
  ".cm-tooltip": {
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border-strong)",
    borderRadius: "6px",
    boxShadow: "var(--shadow-pop)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)", maxHeight: "16em" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "2px 8px !important" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent-soft)",
    color: "var(--text)",
  },
  ".cm-completionIcon": { opacity: "0.6" },
  ".cm-completionMatchedText": { textDecoration: "none", color: "var(--accent)", fontWeight: "600" },
  ".cm-diagnostic": { padding: "4px 8px", fontFamily: "var(--font-sans)" },
  ".cm-diagnostic-error": { borderLeft: "3px solid var(--danger)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--danger)",
    textUnderlineOffset: "3px",
    backgroundColor: "var(--danger-soft)",
  },
  ".cm-lint-marker-error": { content: "none" },
  ".cm-gutter-lint": { width: "12px" },
  ".cm-gutter-lint .cm-gutterElement": { padding: "0" },
  ".cm-panel.cm-panel-lint": { display: "none" },
});

export const syntaxColors = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.propertyName, color: "var(--syn-key)" },
    { tag: [t.string, t.special(t.string)], color: "var(--syn-string)" },
    { tag: t.number, color: "var(--syn-number)" },
    { tag: t.bool, color: "var(--syn-bool)" },
    { tag: t.null, color: "var(--syn-null)", fontStyle: "italic" },
    { tag: [t.punctuation, t.separator, t.bracket, t.squareBracket, t.brace, t.paren], color: "var(--syn-punct)" },
    { tag: t.keyword, color: "var(--syn-keyword)" },
    { tag: t.operator, color: "var(--syn-keyword)" },
    { tag: t.function(t.variableName), color: "var(--syn-func)" },
    { tag: t.variableName, color: "var(--syn-variable)" },
    { tag: t.atom, color: "var(--syn-func)" },
    { tag: t.comment, color: "var(--syn-comment)", fontStyle: "italic" },
    { tag: t.invalid, color: "var(--danger)" },
  ]),
);
