import { memo, useMemo, useState, type ReactNode } from "react";
import { Group, Panel as ResizablePanel, Separator, useDefaultLayout } from "react-resizable-panels";
import { ArrowLeftRight, CircleAlert, CircleCheck, ClipboardPaste, Copy, FileUp, GitCompareArrows, Import, Trash2, WandSparkles } from "lucide-react";
import { CodeEditor, type EditorDiagnostic } from "./editor/CodeEditor";
import { DropZone } from "./DropZone";
import { EmptyState, Panel } from "./Panel";
import { IconButton, Segmented, StatusChip, cx } from "./ui";
import { useJsonDocument, type JsonDocument } from "../hooks/useJsonDocument";
import { diffJson, type DiffEntry, type DiffKind } from "../lib/jsonDiff";
import { pathToJq } from "../lib/jsonPath";
import { formatJson } from "../lib/json";
import { copyText, readClipboardText } from "../lib/clipboard";
import { pickFile, readJsonFile } from "../lib/file";
import { toast } from "../lib/toast";
import type { Settings } from "../lib/storage";

interface CompareViewProps {
  left: string;
  right: string;
  onLeftChange: (t: string) => void;
  onRightChange: (t: string) => void;
  currentInput: string;
  settings: Settings;
  isMobile: boolean;
}

const KIND_STYLE: Record<DiffKind, { label: string; cls: string }> = {
  added: { label: "Added", cls: "bg-success-soft text-success" },
  removed: { label: "Removed", cls: "bg-danger-soft text-danger" },
  changed: { label: "Changed", cls: "bg-warning-soft text-warning" },
  type: { label: "Type", cls: "bg-accent-soft text-accent" },
};

function preview(v: unknown): string {
  if (v === undefined) return "";
  const s = JSON.stringify(v);
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}

export const CompareView = memo(function CompareView({ left, right, onLeftChange, onRightChange, currentInput, settings, isMobile }: CompareViewProps) {
  const leftDoc = useJsonDocument(left);
  const rightDoc = useJsonDocument(right);
  const [filter, setFilter] = useState<"all" | Exclude<DiffKind, "type">>("all");
  const outer = useDefaultLayout({ id: "jsonpg-compare", storage: localStorage, panelIds: ["editors", "diff"] });

  const diff = useMemo(() => {
    if (!leftDoc.parsed || !rightDoc.parsed) return null;
    return diffJson(leftDoc.parsed.value, rightDoc.parsed.value);
  }, [leftDoc.parsed, rightDoc.parsed]);

  const entries = useMemo(() => {
    if (!diff) return [];
    if (filter === "all") return diff.entries;
    // "Changed" covers both value changes and type changes.
    return diff.entries.filter((e) => e.kind === filter || (filter === "changed" && e.kind === "type"));
  }, [diff, filter]);
  const total = diff ? diff.counts.added + diff.counts.removed + diff.counts.changed + diff.counts.type : 0;

  const editors = (
    <Group orientation={isMobile ? "vertical" : "horizontal"} id="jsonpg-compare-editors">
      <ResizablePanel id="left" defaultSize="50%" minSize="15%">
        <CompareSide
          title="Original"
          value={left}
          onChange={onLeftChange}
          doc={leftDoc}
          settings={settings}
          extra={
            <IconButton label="Use current input" onClick={() => onLeftChange(currentInput)}>
              <Import size={14} />
            </IconButton>
          }
        />
      </ResizablePanel>
      <Separator />
      <ResizablePanel id="right" defaultSize="50%" minSize="15%">
        <CompareSide
          title="Modified"
          value={right}
          onChange={onRightChange}
          doc={rightDoc}
          settings={settings}
          extra={
            <IconButton
              label="Swap sides"
              onClick={() => {
                onLeftChange(right);
                onRightChange(left);
              }}
            >
              <ArrowLeftRight size={14} />
            </IconButton>
          }
        />
      </ResizablePanel>
    </Group>
  );

  const diffPanel = (
    <Panel
      title="Differences"
      icon={<GitCompareArrows size={13} />}
      badge={
        diff &&
        (total === 0 ? (
          <StatusChip tone="success">
            <CircleCheck size={11} /> Identical
          </StatusChip>
        ) : (
          <StatusChip tone="warning">
            {total.toLocaleString()} difference{total === 1 ? "" : "s"}
          </StatusChip>
        ))
      }
      actions={
        diff &&
        total > 0 && (
          <Segmented
            ariaLabel="Filter differences"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All` },
              { value: "added", label: `+${diff.counts.added}`, title: "Added" },
              { value: "removed", label: `−${diff.counts.removed}`, title: "Removed" },
              { value: "changed", label: `~${diff.counts.changed + diff.counts.type}`, title: "Changed" },
            ]}
          />
        )
      }
    >
      <DiffBody leftDoc={leftDoc} rightDoc={rightDoc} entries={entries} truncated={diff?.truncated ?? false} identical={!!diff && total === 0} />
    </Panel>
  );

  return (
    <Group orientation="vertical" id="jsonpg-compare" defaultLayout={outer.defaultLayout} onLayoutChanged={outer.onLayoutChanged} className="min-h-0 flex-1">
      <ResizablePanel id="editors" defaultSize="60%" minSize="20%">
        {editors}
      </ResizablePanel>
      <Separator />
      <ResizablePanel id="diff" defaultSize="40%" minSize={100}>
        {diffPanel}
      </ResizablePanel>
    </Group>
  );
});

function CompareSide({
  title,
  value,
  onChange,
  doc,
  settings,
  extra,
}: {
  title: string;
  value: string;
  onChange: (t: string) => void;
  doc: JsonDocument;
  settings: Settings;
  extra?: ReactNode;
}) {
  const error = doc.validation.status === "invalid" ? doc.validation.error : null;
  const diagnostics = useMemo<EditorDiagnostic[]>(() => (error ? [{ from: error.offset, to: error.offset + error.length, message: error.message }] : []), [error]);

  const loadFile = async (file: File) => {
    try {
      onChange(await readJsonFile(file));
      toast.success(`Loaded ${file.name}`);
    } catch (e) {
      toast.error("Import failed", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Panel
      title={title}
      badge={
        doc.validation.status === "valid" ? (
          <CircleCheck size={13} className="text-success" aria-label="Valid JSON" />
        ) : error ? (
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-danger" title={error.message}>
            <CircleAlert size={13} className="shrink-0" />
            <span className="truncate">
              Ln {error.line}, Col {error.column}
            </span>
          </span>
        ) : null
      }
      actions={
        <>
          {extra}
          <IconButton
            label="Format"
            onClick={() => {
              const r = formatJson(value, { indent: settings.indent, style: settings.formatStyle });
              if (r.ok) onChange(r.text);
              else if (r.error) toast.error("Can't format invalid JSON", `Line ${r.error.line}, column ${r.error.column}: ${r.error.message}`);
            }}
          >
            <WandSparkles size={14} />
          </IconButton>
          <IconButton
            label="Paste"
            onClick={() =>
              readClipboardText().then(onChange, (e) => toast.error("Couldn't read the clipboard", e instanceof Error ? e.message : String(e)))
            }
          >
            <ClipboardPaste size={14} />
          </IconButton>
          <IconButton label="Import file" onClick={() => pickFile().then((f) => f && loadFile(f))}>
            <FileUp size={14} />
          </IconButton>
          <IconButton label="Clear" onClick={() => onChange("")} disabled={!value}>
            <Trash2 size={14} />
          </IconButton>
        </>
      }
    >
      <DropZone onFile={loadFile}>
        <CodeEditor
          value={value}
          onChange={onChange}
          language="json"
          wordWrap={settings.wordWrap}
          fontSize={settings.fontSize}
          indent={settings.indent}
          diagnostics={diagnostics}
          placeholder={`Paste the ${title.toLowerCase()} JSON document…`}
          ariaLabel={`${title} JSON`}
        />
      </DropZone>
    </Panel>
  );
}

function DiffBody({
  leftDoc,
  rightDoc,
  entries,
  truncated,
  identical,
}: {
  leftDoc: JsonDocument;
  rightDoc: JsonDocument;
  entries: DiffEntry[];
  truncated: boolean;
  identical: boolean;
}) {
  if (leftDoc.validation.status === "empty" || rightDoc.validation.status === "empty") {
    return (
      <EmptyState icon={<GitCompareArrows size={22} />} title="Compare two JSON documents">
        Paste, import or drop a document on each side. Differences are computed structurally — key order and formatting are ignored; arrays are compared by
        index.
      </EmptyState>
    );
  }
  if (leftDoc.validation.status === "invalid" || rightDoc.validation.status === "invalid") {
    return (
      <EmptyState icon={<CircleAlert size={22} className="text-danger" />} title="Both documents must be valid JSON">
        Fix the highlighted syntax error to see the differences.
      </EmptyState>
    );
  }
  if (identical) {
    return (
      <EmptyState icon={<CircleCheck size={22} className="text-success" />} title="No structural differences">
        The documents contain the same data.
      </EmptyState>
    );
  }
  return (
    <div className="h-full overflow-auto">
      <table className="w-full table-fixed border-collapse text-[12px]">
        <colgroup>
          <col className="w-[92px]" />
          <col className="w-[28%]" />
          <col />
          <col />
          <col className="w-9" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-surface-2 text-left text-[10.5px] uppercase tracking-wider text-fg-faint">
          <tr>
            <th className="px-3 py-1.5 font-semibold">Change</th>
            <th className="px-3 py-1.5 font-semibold">Path</th>
            <th className="px-3 py-1.5 font-semibold">Original</th>
            <th className="px-3 py-1.5 font-semibold">Modified</th>
            <th />
          </tr>
        </thead>
        <tbody className="font-mono">
          {entries.map((e, i) => {
            const path = pathToJq(e.path);
            return (
              <tr key={i} className="group border-t border-line hover:bg-[var(--syn-active-line)]">
                <td className="px-3 py-1.5 font-sans">
                  <span className={cx("inline-block rounded px-1.5 py-px text-[10.5px] font-semibold", KIND_STYLE[e.kind].cls)}>{KIND_STYLE[e.kind].label}</span>
                </td>
                <td className="truncate px-3 py-1.5 text-syn-key" title={path}>
                  {path}
                </td>
                <td className={cx("truncate px-3 py-1.5", e.kind !== "added" && "text-danger")} title={e.kind === "added" ? undefined : preview(e.left)}>
                  {e.kind === "added" ? <span className="text-fg-faint">—</span> : preview(e.left)}
                </td>
                <td className={cx("truncate px-3 py-1.5", e.kind !== "removed" && "text-success")} title={e.kind === "removed" ? undefined : preview(e.right)}>
                  {e.kind === "removed" ? <span className="text-fg-faint">—</span> : preview(e.right)}
                </td>
                <td className="px-1 py-1">
                  <IconButton
                    label="Copy path"
                    className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => copyText(path).then(() => toast.success("Path copied", path))}
                  >
                    <Copy size={12} />
                  </IconButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {truncated && <div className="border-t border-line px-3 py-2 text-[11.5px] text-fg-muted">Showing the first {entries.length.toLocaleString()} differences.</div>}
      {entries.length === 0 && <div className="p-4 text-center text-[12px] text-fg-muted">No differences of this kind.</div>}
    </div>
  );
}

