import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy, Search, TerminalSquare, X } from "lucide-react";
import { pathToJq, valueType, type PathSegment } from "../lib/jsonPath";
import { copyText } from "../lib/clipboard";
import { toast } from "../lib/toast";
import { IconButton, cx } from "./ui";

const ROW_HEIGHT = 22;
const CHUNK = 200;
const MAX_SEARCH_NODES = 500_000;
const MAX_EXPAND_ALL = 5_000;

interface Row {
  key: string;
  path: PathSegment[];
  depth: number;
  label: PathSegment | null;
  value: unknown;
  container: boolean;
  size: number;
  expanded: boolean;
  /** "Show more" row for a partially rendered container. */
  more?: { parentKey: string; remaining: number };
}

const keyOf = (parentKey: string, seg: PathSegment) =>
  parentKey + (typeof seg === "number" ? `\u0001#${seg}` : `\u0001.${seg}`);

function childEntries(value: unknown): Array<[PathSegment, unknown]> {
  if (Array.isArray(value)) return value.map((v, i) => [i, v]);
  if (value && typeof value === "object") return Object.entries(value);
  return [];
}

function sizeOf(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

interface SearchIndex {
  matches: Set<string>;
  ancestors: Set<string>;
  truncated: boolean;
}

function buildSearchIndex(root: unknown, term: string): SearchIndex {
  const needle = term.toLowerCase();
  const matches = new Set<string>();
  const ancestors = new Set<string>();
  let visited = 0;
  let truncated = false;
  const stack: Array<{ value: unknown; key: string; label: PathSegment | null; parents: string[] }> = [
    { value: root, key: "", label: null, parents: [] },
  ];
  while (stack.length > 0) {
    const { value, key, label, parents } = stack.pop()!;
    if (++visited > MAX_SEARCH_NODES) {
      truncated = true;
      break;
    }
    const labelHit = label !== null && String(label).toLowerCase().includes(needle);
    const isContainer = value !== null && typeof value === "object";
    const valueHit = !isContainer && String(value).toLowerCase().includes(needle);
    if (labelHit || valueHit) {
      matches.add(key);
      for (const p of parents) ancestors.add(p);
    }
    if (isContainer) {
      const nextParents = [...parents, key];
      const entries = childEntries(value);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [seg, child] = entries[i];
        stack.push({ value: child, key: keyOf(key, seg), label: seg, parents: nextParents });
      }
    }
  }
  return { matches, ancestors, truncated };
}

function flatten(root: unknown, expanded: Set<string>, limits: Map<string, number>, search: SearchIndex | null): Row[] {
  const rows: Row[] = [];
  type Frame = {
    value: unknown;
    key: string;
    path: PathSegment[];
    depth: number;
    label: PathSegment | null;
    insideMatch: boolean;
    more?: Row["more"];
  };
  const stack: Frame[] = [{ value: root, key: "", path: [], depth: 0, label: null, insideMatch: false }];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (f.more) {
      rows.push({ key: f.key, path: f.path, depth: f.depth, label: null, value: undefined, container: false, size: 0, expanded: false, more: f.more });
      continue;
    }
    const container = f.value !== null && typeof f.value === "object";
    const size = sizeOf(f.value);
    const filtering = search !== null && !f.insideMatch;
    const isOpen = container && size > 0 && (filtering ? search.ancestors.has(f.key) || (search.matches.has(f.key) && expanded.has(f.key)) : expanded.has(f.key));
    rows.push({ key: f.key, path: f.path, depth: f.depth, label: f.label, value: f.value, container, size, expanded: isOpen });
    if (!isOpen) continue;

    const insideMatch = f.insideMatch || (search !== null && search.matches.has(f.key));
    let entries = childEntries(f.value);
    if (search && !insideMatch) {
      entries = entries.filter(([seg]) => {
        const k = keyOf(f.key, seg);
        return search.matches.has(k) || search.ancestors.has(k);
      });
    }
    const limit = limits.get(f.key) ?? CHUNK;
    const shown = Math.min(entries.length, limit);
    const frames: Frame[] = [];
    for (let i = 0; i < shown; i++) {
      const [seg, child] = entries[i];
      frames.push({ value: child, key: keyOf(f.key, seg), path: [...f.path, seg], depth: f.depth + 1, label: seg, insideMatch });
    }
    if (entries.length > shown) {
      // Placeholder frame rendered as a "show more" row.
      frames.push({
        value: undefined,
        key: `${f.key}\u0002more`,
        path: f.path,
        depth: f.depth + 1,
        label: null,
        insideMatch: true,
        more: { parentKey: f.key, remaining: entries.length - shown },
      });
    }
    for (let i = frames.length - 1; i >= 0; i--) stack.push(frames[i]);
  }
  return rows;
}

function highlight(text: string, term: string): ReactNode {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-[var(--syn-match)] text-inherit">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function ValuePreview({ value, term }: { value: unknown; term: string }) {
  switch (valueType(value)) {
    case "string": {
      const s = value as string;
      const shown = s.length > 300 ? `${s.slice(0, 300)}…` : s;
      return <span className="text-syn-string">"{highlight(shown, term)}"</span>;
    }
    case "number":
      return <span className="text-syn-number">{highlight(String(value), term)}</span>;
    case "boolean":
      return <span className="text-syn-bool">{highlight(String(value), term)}</span>;
    case "null":
      return <span className="italic text-syn-null">{highlight("null", term)}</span>;
    default:
      return null;
  }
}

export interface JsonTreeViewProps {
  value: unknown;
  /** Called with a jq path expression when the user chooses "Use as query". */
  onUsePath?: (jqPath: string) => void;
  className?: string;
}

export const JsonTreeView = memo(function JsonTreeView({ value, onUsePath, className }: JsonTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => initialExpanded(value));
  const [limits, setLimits] = useState<Map<string, number>>(() => new Map());
  const [selected, setSelected] = useState<string>("");
  const [term, setTerm] = useState("");
  const deferredTerm = useDeferredValue(term.trim());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(400);

  // Reset expansion when a different document arrives.
  const prevValue = useRef(value);
  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    setExpanded(initialExpanded(value));
    setLimits(new Map());
    setSelected("");
  }, [value]);

  const searchIndex = useMemo(() => (deferredTerm ? buildSearchIndex(value, deferredTerm) : null), [value, deferredTerm]);
  const rows = useMemo(() => flatten(value, expanded, limits, searchIndex), [value, expanded, limits, searchIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    setViewport(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = () => {
    const next = new Set<string>();
    const stack: Array<{ v: unknown; k: string }> = [{ v: value, k: "" }];
    while (stack.length > 0 && next.size < MAX_EXPAND_ALL) {
      const { v, k } = stack.pop()!;
      if (v === null || typeof v !== "object") continue;
      next.add(k);
      for (const [seg, child] of childEntries(v)) if (child !== null && typeof child === "object") stack.push({ v: child, k: keyOf(k, seg) });
    }
    setExpanded(next);
    if (next.size >= MAX_EXPAND_ALL) toast.info(`Expanded the first ${MAX_EXPAND_ALL.toLocaleString()} nodes`);
  };
  const collapseAll = () => setExpanded(new Set([""]));

  const selectedIndex = rows.findIndex((r) => r.key === selected);
  const selectedRow = selectedIndex >= 0 ? rows[selectedIndex] : null;

  const scrollToIndex = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const top = i * ROW_HEIGHT;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
  };

  const copyPath = (row: Row) =>
    copyText(pathToJq(row.path)).then(
      () => toast.success("Path copied", pathToJq(row.path)),
      (e) => toast.error("Copy failed", String(e)),
    );
  const copyValue = (row: Row) =>
    copyText(JSON.stringify(row.value, null, 2)).then(
      () => toast.success("Value copied"),
      (e) => toast.error("Copy failed", String(e)),
    );

  const showMore = (row: Row) => {
    if (!row.more) return;
    setLimits((prev) => new Map(prev).set(row.more!.parentKey, (prev.get(row.more!.parentKey) ?? CHUNK) + CHUNK * 5));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (rows.length === 0) return;
    let i = selectedIndex;
    const row = selectedRow;
    switch (e.key) {
      case "ArrowDown":
        i = Math.min(rows.length - 1, i + 1);
        break;
      case "ArrowUp":
        i = Math.max(0, i - 1);
        break;
      case "Home":
        i = 0;
        break;
      case "End":
        i = rows.length - 1;
        break;
      case "ArrowRight":
        if (row?.container && !row.expanded && row.size > 0) toggle(row.key);
        else i = Math.min(rows.length - 1, i + 1);
        break;
      case "ArrowLeft":
        if (row?.container && row.expanded) toggle(row.key);
        else if (row && row.depth > 0) {
          for (let j = i - 1; j >= 0; j--) {
            if (rows[j].depth < row.depth) {
              i = j;
              break;
            }
          }
        }
        break;
      case "Enter":
        if (row?.more) showMore(row);
        else if (row && onUsePath) onUsePath(pathToJq(row.path));
        break;
      case " ":
        if (row?.container) toggle(row.key);
        break;
      default:
        return;
    }
    e.preventDefault();
    if (i < 0) i = 0;
    if (rows[i] && rows[i].key !== selected) {
      setSelected(rows[i].key);
      scrollToIndex(i);
    }
  };

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 10);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + 10);
  const visible = rows.slice(start, end);

  return (
    <div className={cx("flex h-full min-h-0 flex-col bg-surface", className)}>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-2">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search size={13} className="pointer-events-none absolute left-2 text-fg-faint" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter keys and values…"
            aria-label="Filter tree"
            className="h-6 w-full min-w-0 rounded-md border border-line bg-surface-2 pl-7 pr-6 text-[12px] text-fg placeholder:text-fg-faint focus:border-accent focus:outline-none"
          />
          {term && (
            <button className="absolute right-1.5 text-fg-faint hover:text-fg" onClick={() => setTerm("")} aria-label="Clear filter">
              <X size={13} />
            </button>
          )}
        </div>
        {searchIndex && (
          <span className="shrink-0 px-1 text-[11px] tabular-nums text-fg-muted">
            {searchIndex.matches.size.toLocaleString()}
            {searchIndex.truncated ? "+" : ""} match{searchIndex.matches.size === 1 ? "" : "es"}
          </span>
        )}
        <IconButton label="Expand all" onClick={expandAll}>
          <ChevronsUpDown size={14} />
        </IconButton>
        <IconButton label="Collapse all" onClick={collapseAll}>
          <ChevronsDownUp size={14} />
        </IconButton>
      </div>

      <div
        ref={scrollRef}
        role="tree"
        aria-label="JSON tree"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => !selected && rows[0] && setSelected(rows[0].key)}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="relative min-h-0 flex-1 overflow-auto font-mono text-[12.5px] focus:outline-none"
      >
        {searchIndex && searchIndex.matches.size === 0 ? (
          <div className="p-6 text-center font-sans text-[12px] text-fg-muted">No keys or values match “{deferredTerm}”.</div>
        ) : (
          <div style={{ height: rows.length * ROW_HEIGHT, position: "relative", minWidth: "100%" }}>
            <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
              {visible.map((row) => (
                <TreeRow
                  key={row.key}
                  row={row}
                  selected={row.key === selected}
                  term={deferredTerm}
                  onToggle={toggle}
                  onSelect={setSelected}
                  onShowMore={showMore}
                  onCopyPath={copyPath}
                  onCopyValue={copyValue}
                  onUsePath={onUsePath}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex h-7 shrink-0 items-center gap-2 border-t border-line bg-surface-2 px-2 text-[11px] text-fg-muted">
        {selectedRow && !selectedRow.more ? (
          <>
            <code className="min-w-0 flex-1 truncate font-mono text-fg" title={pathToJq(selectedRow.path)}>
              {pathToJq(selectedRow.path)}
            </code>
            <button className="shrink-0 hover:text-fg" onClick={() => copyPath(selectedRow)}>
              Copy path
            </button>
            {onUsePath && (
              <button className="shrink-0 font-medium text-accent hover:underline" onClick={() => onUsePath(pathToJq(selectedRow.path))}>
                Use as query
              </button>
            )}
          </>
        ) : (
          <span className="truncate">Select a node to see its path · ←/→ collapse/expand · Enter uses it as a query</span>
        )}
      </div>
    </div>
  );
});

interface TreeRowProps {
  row: Row;
  selected: boolean;
  term: string;
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
  onShowMore: (row: Row) => void;
  onCopyPath: (row: Row) => void;
  onCopyValue: (row: Row) => void;
  onUsePath?: (path: string) => void;
}

const TreeRow = memo(function TreeRow({ row, selected, term, onToggle, onSelect, onShowMore, onCopyPath, onCopyValue, onUsePath }: TreeRowProps) {
  const indent = 8 + row.depth * 14;
  if (row.more) {
    return (
      <div style={{ height: ROW_HEIGHT, paddingLeft: indent + 16 }} className={cx("flex items-center", selected && "bg-accent-soft")}>
        <button className="font-sans text-[11.5px] text-accent hover:underline" onClick={() => onShowMore(row)}>
          Show more… ({row.more.remaining.toLocaleString()} remaining)
        </button>
      </div>
    );
  }
  const isArray = Array.isArray(row.value);
  return (
    <div
      role="treeitem"
      aria-expanded={row.container ? row.expanded : undefined}
      aria-selected={selected}
      aria-level={row.depth + 1}
      style={{ height: ROW_HEIGHT, paddingLeft: indent }}
      onClick={() => {
        onSelect(row.key);
        if (row.container && row.size > 0) onToggle(row.key);
      }}
      className={cx(
        "group flex cursor-default items-center whitespace-nowrap pr-2",
        selected ? "bg-accent-soft" : "hover:bg-[var(--syn-active-line)]",
      )}
    >
      <span className="inline-flex w-4 shrink-0 justify-center text-fg-faint">
        {row.container && row.size > 0 && <ChevronRight size={12} className={cx("transition-transform", row.expanded && "rotate-90")} />}
      </span>
      {row.label !== null ? (
        typeof row.label === "number" ? (
          <span className="mr-1 text-fg-faint">{highlight(String(row.label), term)}:</span>
        ) : (
          <span className="mr-1">
            <span className="text-syn-key">{highlight(row.label, term)}</span>
            <span className="text-syn-punct">:</span>
          </span>
        )
      ) : (
        <span className="mr-1 text-fg-faint">root</span>
      )}
      {row.container ? (
        <span className="text-syn-punct">
          {isArray ? "[" : "{"}
          {!row.expanded && row.size > 0 && <span className="text-fg-faint">…</span>}
          {(!row.expanded || row.size === 0) && (isArray ? "]" : "}")}
          <span className="ml-2 font-sans text-[11px] text-fg-faint">
            {row.size} {isArray ? (row.size === 1 ? "item" : "items") : row.size === 1 ? "key" : "keys"}
          </span>
        </span>
      ) : (
        <span className="truncate">
          <ValuePreview value={row.value} term={term} />
        </span>
      )}
      <span className="ml-auto hidden shrink-0 items-center gap-0.5 pl-2 group-hover:flex">
        <button title="Copy path" aria-label="Copy path" className="rounded p-0.5 text-fg-faint hover:bg-surface-3 hover:text-fg" onClick={(e) => (e.stopPropagation(), onCopyPath(row))}>
          <Copy size={12} />
        </button>
        <button title="Copy value" aria-label="Copy value" className="rounded p-0.5 font-sans text-[10px] font-semibold text-fg-faint hover:bg-surface-3 hover:text-fg" onClick={(e) => (e.stopPropagation(), onCopyValue(row))}>
          {"{ }"}
        </button>
        {onUsePath && (
          <button title="Use as query" aria-label="Use as query" className="rounded p-0.5 text-fg-faint hover:bg-surface-3 hover:text-accent" onClick={(e) => (e.stopPropagation(), onUsePath(pathToJq(row.path)))}>
            <TerminalSquare size={12} />
          </button>
        )}
      </span>
    </div>
  );
});

function initialExpanded(value: unknown): Set<string> {
  // Root plus its direct children (when small enough) are expanded by default.
  const set = new Set<string>([""]);
  if (sizeOf(value) <= 50) {
    for (const [seg, child] of childEntries(value)) {
      if (child !== null && typeof child === "object" && sizeOf(child) <= 50) set.add(keyOf("", seg));
    }
  }
  return set;
}
