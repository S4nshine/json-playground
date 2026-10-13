import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
  rectangularSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldAll,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  unfoldAll,
} from "@codemirror/language";
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { json } from "@codemirror/lang-json";
import { editorChrome, syntaxColors } from "./theme";
import { jqCompletionSource, jqLanguage } from "../../lib/query/jqLanguage";
import type { IndentOption } from "../../lib/json";

export type EditorLanguage = "json" | "jq";

export interface EditorDiagnostic {
  from: number;
  to: number;
  message: string;
  severity?: "error" | "warning" | "info";
}

export interface CodeEditorHandle {
  focus(): void;
  /** Replace the whole document. Undoable with Ctrl/Cmd+Z. */
  setValue(text: string): void;
  getValue(): string;
  /** Move the cursor to an offset and scroll it into view. */
  revealOffset(offset: number, length?: number): void;
  foldAll(): void;
  unfoldAll(): void;
  openSearch(): void;
}

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  language: EditorLanguage;
  readOnly?: boolean;
  wordWrap?: boolean;
  fontSize?: number;
  indent?: IndentOption;
  placeholder?: string;
  diagnostics?: readonly EditorDiagnostic[];
  showLineNumbers?: boolean;
  /** For jq: field names offered by autocompletion. */
  completionFields?: readonly string[];
  ariaLabel: string;
  className?: string;
  ref?: Ref<CodeEditorHandle>;
}

/** Docs larger than this emit onChange on a short debounce instead of every keystroke. */
const LARGE_DOC = 400_000;

export function CodeEditor({
  value,
  onChange,
  onCursorChange,
  language,
  readOnly = false,
  wordWrap = false,
  fontSize = 13,
  indent = 2,
  placeholder,
  diagnostics,
  showLineNumbers = true,
  completionFields,
  ariaLabel,
  className,
  ref,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // The last text we know the document and the `value` prop agree on.
  const syncedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursorChange);
  const fieldsRef = useRef<readonly string[]>(completionFields ?? []);
  onChangeRef.current = onChange;
  onCursorRef.current = onCursorChange;
  fieldsRef.current = completionFields ?? [];

  const compartments = useRef({
    readOnly: new Compartment(),
    wrap: new Compartment(),
    font: new Compartment(),
    indent: new Compartment(),
    placeholder: new Compartment(),
    gutters: new Compartment(),
  }).current;

  // Create the view once.
  useEffect(() => {
    const host = hostRef.current!;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const emitChange = (view: EditorView) => {
      const text = view.state.doc.toString();
      syncedRef.current = text;
      onChangeRef.current?.(text);
    };

    const languageExt: Extension =
      language === "json"
        ? json()
        : [jqLanguage(), autocompletion({ override: [jqCompletionSource(() => fieldsRef.current)], icons: true })];

    const extensions: Extension[] = [
      compartments.gutters.of(gutterExtensions(showLineNumbers)),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxColors,
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      languageExt,
      editorChrome,
      EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
      compartments.readOnly.of(readOnlyExtensions(readOnly)),
      compartments.wrap.of(wordWrap ? EditorView.lineWrapping : []),
      compartments.font.of(fontTheme(fontSize)),
      compartments.indent.of(indentUnit.of(indent === "tab" ? "\t" : " ".repeat(indent))),
      compartments.placeholder.of(placeholder ? placeholderExt(placeholder) : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          clearTimeout(debounce);
          if (update.state.doc.length > LARGE_DOC) {
            debounce = setTimeout(() => emitChange(update.view), 150);
          } else {
            emitChange(update.view);
          }
        }
        if ((update.selectionSet || update.docChanged) && onCursorRef.current) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          onCursorRef.current(line.number, head - line.from + 1);
        }
      }),
    ];
    if (language === "json") extensions.push(lintGutter());

    const view = new EditorView({
      parent: host,
      state: EditorState.create({ doc: value, extensions }),
    });
    viewRef.current = view;
    syncedRef.current = value;
    return () => {
      clearTimeout(debounce);
      view.destroy();
      viewRef.current = null;
    };
    // The view is created once; props are applied through compartments below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes (format, sample data, import…).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === syncedRef.current) return;
    syncedRef.current = value;
    if (view.state.doc.length === value.length && view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: EditorSelection.cursor(Math.min(view.state.selection.main.head, value.length)),
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.readOnly.reconfigure(readOnlyExtensions(readOnly)) });
  }, [readOnly, compartments]);
  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.wrap.reconfigure(wordWrap ? EditorView.lineWrapping : []) });
  }, [wordWrap, compartments]);
  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.font.reconfigure(fontTheme(fontSize)) });
  }, [fontSize, compartments]);
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.indent.reconfigure(indentUnit.of(indent === "tab" ? "\t" : " ".repeat(indent))),
    });
  }, [indent, compartments]);
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.placeholder.reconfigure(placeholder ? placeholderExt(placeholder) : []),
    });
  }, [placeholder, compartments]);
  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartments.gutters.reconfigure(gutterExtensions(showLineNumbers)) });
  }, [showLineNumbers, compartments]);

  // Diagnostics (e.g. JSON syntax errors) are computed outside and pushed in.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const len = view.state.doc.length;
    const diags: Diagnostic[] = (diagnostics ?? []).map((d) => {
      const from = Math.max(0, Math.min(d.from, len));
      return { from, to: Math.max(from, Math.min(d.to, len)), message: d.message, severity: d.severity ?? "error" };
    });
    view.dispatch(setDiagnostics(view.state, diags));
  }, [diagnostics]);

  useImperativeHandle(
    ref,
    (): CodeEditorHandle => ({
      focus: () => viewRef.current?.focus(),
      setValue: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          selection: EditorSelection.cursor(0),
          scrollIntoView: true,
        });
      },
      getValue: () => viewRef.current?.state.doc.toString() ?? syncedRef.current,
      revealOffset: (offset: number, length = 0) => {
        const view = viewRef.current;
        if (!view) return;
        const len = view.state.doc.length;
        const from = Math.max(0, Math.min(offset, len));
        const to = Math.max(from, Math.min(offset + length, len));
        view.dispatch({
          selection: EditorSelection.range(from, to),
          effects: EditorView.scrollIntoView(from, { y: "center" }),
        });
        view.focus();
      },
      foldAll: () => viewRef.current && foldAll(viewRef.current),
      unfoldAll: () => viewRef.current && unfoldAll(viewRef.current),
      openSearch: () => viewRef.current && openSearchPanel(viewRef.current),
    }),
    [],
  );

  return <div ref={hostRef} className={`h-full min-h-0 overflow-hidden ${className ?? ""}`} />;
}

function readOnlyExtensions(readOnly: boolean): Extension {
  return readOnly
    ? [EditorState.readOnly.of(true), EditorView.editorAttributes.of({ class: "cm-readonly-surface" })]
    : [];
}

function gutterExtensions(show: boolean): Extension {
  return show ? [lineNumbers(), highlightActiveLineGutter(), foldGutter({ openText: "▾", closedText: "▸" })] : [];
}

const fontThemes = new Map<number, Extension>();
function fontTheme(size: number): Extension {
  let ext = fontThemes.get(size);
  if (!ext) {
    ext = EditorView.theme({ ".cm-scroller": { fontSize: `${size}px` } });
    fontThemes.set(size, ext);
  }
  return ext;
}
