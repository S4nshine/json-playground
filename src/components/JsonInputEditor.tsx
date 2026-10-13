import { memo, useMemo, type Ref } from "react";
import { Group, Panel as ResizablePanel, Separator } from "react-resizable-panels";
import { CircleAlert, CircleCheck, ClipboardPaste, Database, FileUp, FoldVertical, Search, Trash2, UnfoldVertical } from "lucide-react";
import { CodeEditor, type CodeEditorHandle, type EditorDiagnostic } from "./editor/CodeEditor";
import { JsonTreeView } from "./JsonTreeView";
import { DropZone } from "./DropZone";
import { EmptyState, Panel } from "./Panel";
import { Button, IconButton, Segmented, cx } from "./ui";
import { formatBytes } from "../lib/json";
import { inputCursorStore } from "../lib/cursor";
import { useStore } from "../lib/store";
import type { JsonDocument } from "../hooks/useJsonDocument";
import type { Settings } from "../lib/storage";
import type { InputViewMode } from "../types";

interface JsonInputEditorProps {
  editorRef: Ref<CodeEditorHandle>;
  value: string;
  onChange: (text: string) => void;
  doc: JsonDocument;
  settings: Settings;
  viewMode: InputViewMode;
  onViewModeChange: (mode: InputViewMode) => void;
  isMobile: boolean;
  onUsePath: (path: string) => void;
  onPaste: () => void;
  onClear: () => void;
  onImport: () => void;
  onLoadSample: () => void;
  onFile: (file: File) => void;
  onJumpToError: () => void;
  onFoldAll: () => void;
  onUnfoldAll: () => void;
  onSearch: () => void;
}

export const JsonInputEditor = memo(function JsonInputEditor(props: JsonInputEditorProps) {
  const { editorRef, value, onChange, doc, settings, viewMode, onViewModeChange, isMobile } = props;
  const mode: InputViewMode = isMobile && viewMode === "split" ? "code" : viewMode;
  const error = doc.validation.status === "invalid" ? doc.validation.error : null;

  const diagnostics = useMemo<EditorDiagnostic[]>(
    () => (error ? [{ from: error.offset, to: error.offset + error.length, message: `${error.message} (line ${error.line}, column ${error.column})` }] : []),
    [error],
  );

  const showCode = mode === "code" || mode === "split";
  const showTree = mode === "tree" || mode === "split";

  const code = (
    <div className="relative h-full">
      <CodeEditor
        ref={editorRef}
        value={value}
        onChange={onChange}
        onCursorChange={(line, column) => inputCursorStore.set({ line, column })}
        language="json"
        wordWrap={settings.wordWrap}
        fontSize={settings.fontSize}
        indent={settings.indent}
        diagnostics={diagnostics}
        placeholder="Paste or type JSON here…"
        ariaLabel="Input JSON editor"
      />
      {doc.validation.status === "empty" && !doc.pending && value === "" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface/90 px-6 py-5 text-center backdrop-blur-sm">
            <div className="text-[13px] font-medium">Start with some JSON</div>
            <div className="max-w-[260px] text-[12px] text-fg-muted">Paste or type into the editor, drop a .json file here, or try the sample dataset.</div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={<ClipboardPaste size={14} />} onClick={props.onPaste}>
                Paste
              </Button>
              <Button icon={<FileUp size={14} />} onClick={props.onImport}>
                Import file
              </Button>
              <Button variant="primary" icon={<Database size={14} />} onClick={props.onLoadSample}>
                Load sample
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const tree = <InputTree doc={doc} onUsePath={props.onUsePath} onJumpToError={props.onJumpToError} />;

  return (
    <Panel
      title="Input"
      ariaLabel="Input JSON"
      actions={
        <>
          <Segmented
            ariaLabel="Input view"
            value={mode}
            onChange={onViewModeChange}
            className="mr-1"
            options={[
              { value: "code", label: "Code", title: "Code editor" },
              { value: "tree", label: "Tree", title: "Tree view" },
              ...(isMobile ? [] : [{ value: "split" as const, label: "Split", title: "Code and tree side by side" }]),
            ]}
          />
          {showCode && (
            <>
              <IconButton label="Search in input" shortcut="mod+f" onClick={props.onSearch}>
                <Search size={14} />
              </IconButton>
              <IconButton label="Collapse all" onClick={props.onFoldAll}>
                <FoldVertical size={14} />
              </IconButton>
              <IconButton label="Expand all" onClick={props.onUnfoldAll}>
                <UnfoldVertical size={14} />
              </IconButton>
            </>
          )}
          <IconButton label="Paste from clipboard" onClick={props.onPaste}>
            <ClipboardPaste size={14} />
          </IconButton>
          <IconButton label="Clear input" onClick={props.onClear} disabled={value === ""}>
            <Trash2 size={14} />
          </IconButton>
        </>
      }
      footer={<InputFooter doc={doc} onJumpToError={props.onJumpToError} />}
    >
      <DropZone onFile={props.onFile}>
        {/* Code and Tree modes keep the editor mounted (hidden) so undo history survives toggling. */}
        {mode === "split" ? (
          <Group orientation="horizontal" id="input-split">
            <ResizablePanel id="input-code" defaultSize="55%" minSize="20%">
              {code}
            </ResizablePanel>
            <Separator />
            <ResizablePanel id="input-tree" defaultSize="45%" minSize="20%">
              {tree}
            </ResizablePanel>
          </Group>
        ) : (
          <>
            <div className={cx("h-full", !showCode && "hidden")}>{code}</div>
            {showTree && tree}
          </>
        )}
      </DropZone>
    </Panel>
  );
});

function InputTree({ doc, onUsePath, onJumpToError }: { doc: JsonDocument; onUsePath: (p: string) => void; onJumpToError: () => void }) {
  if (doc.validation.status === "empty") {
    return <EmptyState title="Nothing to show">Add some JSON input to explore it as a tree.</EmptyState>;
  }
  if (doc.validation.status === "invalid") {
    const e = doc.validation.error;
    return (
      <EmptyState icon={<CircleAlert size={22} className="text-danger" />} title="The input isn't valid JSON">
        <span className="font-mono text-[11.5px]">
          Line {e.line}, column {e.column}: {e.message}
        </span>
        <div className="mt-3">
          <Button onClick={onJumpToError}>Show error in editor</Button>
        </div>
      </EmptyState>
    );
  }
  if (!doc.parsed) {
    return <EmptyState title="Document too large for the tree view">The code editor and queries still work.</EmptyState>;
  }
  return <JsonTreeView value={doc.parsed.value} onUsePath={onUsePath} />;
}

function CursorPosition() {
  const { line, column } = useStore(inputCursorStore);
  return (
    <span className="shrink-0 tabular-nums">
      Ln {line}, Col {column}
    </span>
  );
}

function InputFooter({ doc, onJumpToError }: { doc: JsonDocument; onJumpToError: () => void }) {
  const v = doc.validation;
  return (
    <>
      {v.status === "valid" && (
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-success">
          <CircleCheck size={12} /> Valid JSON
        </span>
      )}
      {v.status === "empty" && <span className="shrink-0">Empty</span>}
      {v.status === "invalid" && (
        <button
          onClick={onJumpToError}
          title="Go to error"
          className="inline-flex min-w-0 items-center gap-1 font-medium text-danger hover:underline"
        >
          <CircleAlert size={12} className="shrink-0" />
          <span className="truncate">
            Ln {v.error.line}, Col {v.error.column}: {v.error.message}
          </span>
        </button>
      )}
      <span className="flex-1" />
      <CursorPosition />
      <span className="hidden shrink-0 tabular-nums sm:inline">{doc.stats.lines.toLocaleString()} lines</span>
      <span className="hidden shrink-0 tabular-nums sm:inline">{doc.stats.chars.toLocaleString()} chars</span>
      <span className="shrink-0 tabular-nums">{formatBytes(doc.stats.bytes)}</span>
    </>
  );
}
