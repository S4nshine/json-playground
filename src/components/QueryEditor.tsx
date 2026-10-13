import { memo, useMemo, useState, type Ref } from "react";
import { Bookmark, Check, Eraser } from "lucide-react";
import { CodeEditor, type CodeEditorHandle, type EditorDiagnostic } from "./editor/CodeEditor";
import { Panel } from "./Panel";
import { QueryExamples } from "./QueryExamples";
import { QueryHistory } from "./QueryHistory";
import { IconButton, Kbd } from "./ui";
import type { QueryError } from "../lib/query/engine";
import type { SavedQuery, Settings } from "../lib/storage";

interface QueryEditorProps {
  editorRef: Ref<CodeEditorHandle>;
  value: string;
  onChange: (q: string) => void;
  settings: Settings;
  fields: readonly string[];
  /** Compile error for the query that was last run, if any. */
  compileError: { query: string; error: QueryError } | null;
  history: string[];
  snippets: SavedQuery[];
  onRunExample: (q: string) => void;
  onClearHistory: () => void;
  onSaveSnippet: (name: string) => void;
  onDeleteSnippet: (id: string) => void;
  onClear: () => void;
}

function offsetOf(text: string, line: number, column: number): number {
  let offset = 0;
  const lines = text.split("\n");
  for (let i = 0; i < line - 1 && i < lines.length; i++) offset += lines[i].length + 1;
  return offset + Math.max(0, column - 1);
}

export const QueryEditor = memo(function QueryEditor(props: QueryEditorProps) {
  const { value, compileError, settings } = props;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  // Underline the offending token when jq reports a location for the current query.
  const diagnostics = useMemo<EditorDiagnostic[]>(() => {
    if (!compileError || compileError.query !== value || !compileError.error.line) return [];
    const from = offsetOf(value, compileError.error.line, compileError.error.column ?? 1);
    const tokenEnd = /^[\w.$@]+/.exec(value.slice(from))?.[0].length ?? 1;
    return [{ from, to: from + Math.max(1, tokenEnd), message: compileError.error.message }];
  }, [compileError, value]);

  const save = () => {
    const n = name.trim() || value.trim().slice(0, 40);
    props.onSaveSnippet(n);
    setSaving(false);
    setName("");
  };

  return (
    <Panel
      title="jq Query"
      ariaLabel="jq query editor"
      actions={
        <>
          <QueryExamples onSelect={props.onRunExample} />
          <QueryHistory
            history={props.history}
            snippets={props.snippets}
            onSelect={props.onRunExample}
            onClearHistory={props.onClearHistory}
            onDeleteSnippet={props.onDeleteSnippet}
          />
          <IconButton label="Save query" onClick={() => setSaving((s) => !s)} active={saving} disabled={value.trim() === ""}>
            <Bookmark size={14} />
          </IconButton>
          <IconButton label="Clear query" onClick={props.onClear} disabled={value === ""}>
            <Eraser size={14} />
          </IconButton>
        </>
      }
      footer={
        <>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <Kbd combo="mod+enter" /> run
          </span>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <Kbd combo="ctrl+space" /> complete
          </span>
          <span className="truncate text-fg-faint">Powered by jq (WebAssembly)</span>
        </>
      }
    >
      <div className="flex h-full flex-col">
        {saving && (
          <form
            className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface-2 px-2 py-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSaving(false)}
              placeholder="Name this query…"
              aria-label="Saved query name"
              className="h-6 min-w-0 flex-1 rounded border border-line bg-surface px-2 text-[12px] focus:border-accent focus:outline-none"
            />
            <IconButton label="Save" type="submit">
              <Check size={14} />
            </IconButton>
          </form>
        )}
        <div className="min-h-0 flex-1">
          <CodeEditor
            ref={props.editorRef}
            value={value}
            onChange={props.onChange}
            language="jq"
            fontSize={settings.fontSize}
            wordWrap
            showLineNumbers={false}
            diagnostics={diagnostics}
            completionFields={props.fields}
            placeholder="Enter a jq expression, e.g. .users[] | select(.active)"
            ariaLabel="jq query"
          />
        </div>
      </div>
    </Panel>
  );
});
