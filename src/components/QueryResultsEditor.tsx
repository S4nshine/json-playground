import { memo, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CircleAlert, Copy, Download, Inbox, LoaderCircle, Lock, Sparkles, TriangleAlert, X } from "lucide-react";
import { CodeEditor } from "./editor/CodeEditor";
import { JsonTreeView } from "./JsonTreeView";
import { EmptyState, Panel } from "./Panel";
import { IconButton, Segmented, StatusChip, cx } from "./ui";
import type { QueryOutcome } from "../lib/query/engine";
import type { Settings } from "../lib/storage";
import type { ResultFormat, ResultViewMode, RunState } from "../types";

interface QueryResultsEditorProps {
  run: RunState;
  text: string;
  settings: Settings;
  viewMode: ResultViewMode;
  onViewModeChange: (m: ResultViewMode) => void;
  format: ResultFormat;
  onFormatChange: (f: ResultFormat) => void;
  onCopy: () => void;
  onDownload: () => void;
  onClear: () => void;
  onRunExample: (q: string) => void;
  onUsePath: (path: string) => void;
}

const QUICK = [".users[] | .name", ".items | map(.price) | add", ".users[] | select(.active == true)"];

function formatDuration(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export const QueryResultsEditor = memo(function QueryResultsEditor(props: QueryResultsEditorProps) {
  const { run, text, settings, viewMode, format } = props;
  const outcome: QueryOutcome | null = run.status === "done" ? run.outcome : run.status === "running" ? run.previous : null;
  const running = run.status === "running";
  const count = outcome?.outputs.length ?? 0;
  const error = outcome?.error ?? null;

  const treeValue = useMemo(() => {
    if (viewMode !== "tree" || !outcome || count === 0) return null;
    try {
      return { value: count === 1 ? JSON.parse(outcome.outputs[0]) : JSON.parse(`[${outcome.outputs.join(",")}]`) };
    } catch {
      return null;
    }
  }, [viewMode, outcome, count]);

  return (
    <Panel
      title="Result"
      ariaLabel="Query results"
      badge={
        <span className="ml-1 flex min-w-0 items-center gap-1">
          <Lock size={11} className="shrink-0 text-fg-faint" aria-label="Read-only" />
          {running && <LoaderCircle size={13} className="animate-spin text-accent" aria-label="Running" />}
          {outcome && !error && (
            <StatusChip tone="success" title="Number of outputs produced by the query">
              {count.toLocaleString()} {count === 1 ? "result" : "results"}
            </StatusChip>
          )}
          {outcome && error && <StatusChip tone="danger">{error.kind === "compile" ? "Syntax error" : error.kind === "timeout" ? "Timed out" : "Error"}</StatusChip>}
          {outcome && outcome.durationMs > 0 && (
            <span className="hidden shrink-0 text-[11px] tabular-nums text-fg-faint sm:inline" title="Execution time">
              {formatDuration(outcome.durationMs)}
            </span>
          )}
        </span>
      }
      actions={
        <>
          <Segmented
            ariaLabel="Result view"
            value={viewMode}
            onChange={props.onViewModeChange}
            options={[
              { value: "code", label: "Code" },
              { value: "tree", label: "Tree" },
            ]}
          />
          {viewMode === "code" && (
            <Segmented
              ariaLabel="Result format"
              value={format}
              onChange={props.onFormatChange}
              className="ml-1"
              options={[
                { value: "pretty", label: "Pretty", title: "Format results" },
                { value: "compact", label: "Minified", title: "Minify results" },
              ]}
            />
          )}
          <IconButton label="Copy result" onClick={props.onCopy} disabled={count === 0}>
            <Copy size={14} />
          </IconButton>
          <IconButton label="Download result" onClick={props.onDownload} disabled={count === 0}>
            <Download size={14} />
          </IconButton>
          <IconButton label="Clear result" onClick={props.onClear} disabled={!outcome}>
            <X size={14} />
          </IconButton>
        </>
      }
    >
      <div className={cx("flex h-full flex-col transition-opacity", running && "opacity-60")}>
        {running && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-accent-soft">
            <div className="animate-indeterminate h-full w-1/3 bg-accent" />
          </div>
        )}
        {error && <ErrorBanner error={error} partial={count > 0} />}
        {!outcome && !running && (
          <EmptyState icon={<Sparkles size={22} />} title="Run a query to see results">
            Write a jq expression above and press Run, or try one of these:
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => props.onRunExample(q)}
                  className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-fg hover:border-accent hover:text-accent"
                >
                  {q}
                </button>
              ))}
            </div>
          </EmptyState>
        )}
        {outcome && count === 0 && !error && (
          <EmptyState icon={<Inbox size={22} />} title="No output">
            The query ran successfully but produced no values (for example, <code className="font-mono">select</code> matched nothing, or{" "}
            <code className="font-mono">empty</code> was used).
          </EmptyState>
        )}
        <div className={cx("min-h-0 flex-1", (count === 0 || viewMode !== "code") && "hidden")}>
          <CodeEditor
            value={text}
            language="json"
            readOnly
            wordWrap={settings.wordWrap}
            fontSize={settings.fontSize}
            indent={settings.indent}
            ariaLabel="Query result (read-only)"
          />
        </div>
        {viewMode === "tree" && count > 0 && (
          <div className="min-h-0 flex-1">
            {treeValue ? (
              <JsonTreeView value={treeValue.value} onUsePath={props.onUsePath} />
            ) : (
              <EmptyState title="Unable to show tree">The result could not be parsed for the tree view.</EmptyState>
            )}
          </div>
        )}
        {outcome && outcome.warnings.length > 0 && <Warnings lines={outcome.warnings} />}
      </div>
    </Panel>
  );
});

function ErrorBanner({ error, partial }: { error: NonNullable<QueryOutcome["error"]>; partial: boolean }) {
  const title =
    error.kind === "compile"
      ? `Query syntax error${error.line ? ` (line ${error.line}${error.column ? `, column ${error.column}` : ""})` : ""}`
      : error.kind === "runtime"
        ? "Runtime error"
        : error.kind === "input"
          ? "Input error"
          : error.kind === "timeout"
            ? "Query timed out"
            : "Engine error";
  return (
    <div role="alert" className="flex shrink-0 gap-2 border-b border-line bg-danger-soft px-3 py-2 text-[12px]">
      {error.kind === "timeout" ? <TriangleAlert size={15} className="mt-px shrink-0 text-danger" /> : <CircleAlert size={15} className="mt-px shrink-0 text-danger" />}
      <div className="min-w-0">
        <div className="font-semibold text-danger">{title}</div>
        <div className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[12px] text-fg">{error.message}</div>
        {error.detail && <pre className="mt-1 overflow-x-auto font-mono text-[11.5px] leading-snug text-fg-muted">{error.detail}</pre>}
        {partial && <div className="mt-1 text-fg-muted">Outputs produced before the error are shown below.</div>}
      </div>
    </div>
  );
}

function Warnings({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0 border-t border-line bg-surface-2 text-[11.5px]">
      <button className="flex w-full items-center gap-1 px-3 py-1 text-fg-muted hover:text-fg" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        stderr ({lines.length})
      </button>
      {open && <pre className="max-h-32 overflow-auto px-3 pb-2 font-mono text-fg-muted">{lines.join("\n")}</pre>}
    </div>
  );
}
