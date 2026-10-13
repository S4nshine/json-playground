import { memo } from "react";
import { CheckCheck, ChevronDown, Copy, Database, Download, FileUp, Minimize2, Play, Square, WandSparkles } from "lucide-react";
import type { FormatStyle, IndentOption } from "../lib/json";
import { Button, Divider, Kbd, MenuItem, MenuLabel, Popover, Segmented, Select } from "./ui";

export type SampleKind = "sample" | 1000 | 10000 | 50000;
export type DownloadKind = "formatted" | "minified" | "raw";

interface ActionToolbarProps {
  indent: IndentOption;
  formatStyle: FormatStyle;
  autoRun: boolean;
  running: boolean;
  onIndentChange: (i: IndentOption) => void;
  onFormatStyleChange: (s: FormatStyle) => void;
  onAutoRunChange: (v: boolean) => void;
  onFormat: () => void;
  onMinify: () => void;
  onValidate: () => void;
  onLoadSample: (kind: SampleKind) => void;
  onImport: () => void;
  onCopy: () => void;
  onDownload: (kind: DownloadKind) => void;
  onRun: () => void;
  onCancel: () => void;
}

export const ActionToolbar = memo(function ActionToolbar(p: ActionToolbarProps) {
  return (
    <div role="toolbar" aria-label="JSON actions" className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-surface pl-2 pr-2">
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      <Popover
        label="Sample data"
        width={260}
        trigger={({ toggle, ref, open }) => (
          <Button ref={ref} variant="ghost" icon={<Database size={14} />} aria-label="Sample data" title="Load sample data" onClick={toggle} aria-expanded={open} aria-haspopup="menu" collapseLabel="xl">
            Sample
            <ChevronDown size={12} className="ml-0.5 inline opacity-60" />
          </Button>
        )}
      >
        {(close) => (
          <div className="py-1">
            <MenuItem onSelect={() => (p.onLoadSample("sample"), close())} hint="users, items">
              Sample dataset
            </MenuItem>
            <MenuLabel>Generate larger data</MenuLabel>
            {([1000, 10000, 50000] as const).map((n) => (
              <MenuItem key={n} onSelect={() => (p.onLoadSample(n), close())} hint={n === 50000 ? "~25 MB" : n === 10000 ? "~5 MB" : "~500 KB"}>
                {n.toLocaleString()} users + items
              </MenuItem>
            ))}
          </div>
        )}
      </Popover>
      <Button variant="ghost" icon={<FileUp size={14} />} aria-label="Import file" onClick={p.onImport} title="Import a JSON file (or drop one on the editor)" collapseLabel="xl">
        Import
      </Button>

      <Divider />

      <Button icon={<WandSparkles size={14} />} aria-label="Format" onClick={p.onFormat} title="Format / beautify (Ctrl/Cmd+Shift+F)" collapseLabel="lg">
        Format
      </Button>
      <Button icon={<Minimize2 size={14} />} aria-label="Minify" onClick={p.onMinify} title="Minify (Ctrl/Cmd+Shift+M)" collapseLabel="lg">
        Minify
      </Button>
      <Button icon={<CheckCheck size={14} />} aria-label="Validate" onClick={p.onValidate} title="Validate (Ctrl/Cmd+Shift+L)" collapseLabel="lg">
        Validate
      </Button>
      <Select
        ariaLabel="Indentation"
        value={p.indent}
        onChange={p.onIndentChange}
        className="ml-1"
        options={[
          { value: 2, label: "2 spaces" },
          { value: 4, label: "4 spaces" },
          { value: "tab", label: "Tabs" },
        ]}
      />
      <div className="hidden xl:block">
        <Segmented
          ariaLabel="Format style"
          value={p.formatStyle}
          onChange={p.onFormatStyleChange}
          options={[
            { value: "expanded", label: "Expanded", title: "Every value on its own line" },
            { value: "compact", label: "Compact", title: "Keep short arrays/objects on one line" },
          ]}
        />
      </div>

      <Divider />

      <Button variant="ghost" icon={<Copy size={14} />} aria-label="Copy input" onClick={p.onCopy} title="Copy input JSON" collapseLabel="xl">
        Copy
      </Button>
      <Popover
        label="Download input"
        width={220}
        trigger={({ toggle, ref, open }) => (
          <Button ref={ref} variant="ghost" icon={<Download size={14} />} aria-label="Download input" title="Download input" onClick={toggle} aria-expanded={open} aria-haspopup="menu" collapseLabel="xl">
            Download
            <ChevronDown size={12} className="ml-0.5 inline opacity-60" />
          </Button>
        )}
      >
        {(close) => (
          <div className="py-1">
            <MenuItem onSelect={() => (p.onDownload("formatted"), close())} hint={<Kbd combo="mod+s" />}>
              Formatted JSON
            </MenuItem>
            <MenuItem onSelect={() => (p.onDownload("minified"), close())}>Minified JSON</MenuItem>
            <MenuItem onSelect={() => (p.onDownload("raw"), close())}>As is</MenuItem>
          </div>
        )}
      </Popover>

      </div>

      <label className="ml-1 mr-1 inline-flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[12px] text-fg-muted" title="Re-run the query automatically while typing">
        <input type="checkbox" checked={p.autoRun} onChange={(e) => p.onAutoRunChange(e.target.checked)} className="size-3.5 accent-[var(--accent)]" />
        <span>
          Auto<span className="hidden sm:inline">-run</span>
        </span>
      </label>
      {p.running ? (
        <Button variant="default" icon={<Square size={12} />} onClick={p.onCancel} title="Stop the running query">
          Stop
        </Button>
      ) : (
        <Button variant="primary" icon={<Play size={13} fill="currentColor" />} onClick={p.onRun} title="Run query (Ctrl/Cmd+Enter)">
          Run
          <span className="ml-1 hidden opacity-80 lg:inline">
            <Kbd combo="mod+enter" className="[&_kbd]:border-white/30 [&_kbd]:bg-white/15 [&_kbd]:text-white" />
          </span>
        </Button>
      )}
    </div>
  );
});
