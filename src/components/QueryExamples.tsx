import { memo, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Search } from "lucide-react";
import { QUERY_EXAMPLES } from "../lib/query/examples";
import { Button, MenuItem, MenuLabel, Popover } from "./ui";

/** Dropdown of example queries; choosing one populates the editor and runs it. */
export const QueryExamples = memo(function QueryExamples({ onSelect }: { onSelect: (query: string) => void }) {
  const [filter, setFilter] = useState("");
  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return QUERY_EXAMPLES;
    return QUERY_EXAMPLES.map((g) => ({
      ...g,
      examples: g.examples.filter((e) => e.label.toLowerCase().includes(f) || e.query.toLowerCase().includes(f)),
    })).filter((g) => g.examples.length > 0);
  }, [filter]);

  return (
    <Popover
      label="Example queries"
      width={400}
      trigger={({ toggle, ref, open }) => (
        <Button ref={ref} variant="ghost" icon={<BookOpen size={14} />} aria-label="Example queries" title="Example queries" onClick={toggle} aria-expanded={open} aria-haspopup="menu" collapseLabel>
          Examples
          <ChevronDown size={12} className="ml-0.5 inline opacity-60" />
        </Button>
      )}
    >
      {(close) => (
        <>
          <div className="relative border-b border-line p-2">
            <Search size={13} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                const first = groups[0]?.examples[0];
                if (e.key === "Enter" && first) {
                  e.preventDefault();
                  onSelect(first.query);
                  close();
                }
              }}
              placeholder="Filter examples…"
              aria-label="Filter examples"
              className="h-7 w-full rounded-md border border-line bg-surface-2 pl-7 pr-2 text-[12px] focus:border-accent focus:outline-none"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-1">
            {groups.length === 0 && <div className="p-4 text-center text-[12px] text-fg-muted">No examples match.</div>}
            {groups.map((g) => (
              <div key={g.name}>
                <MenuLabel>{g.name}</MenuLabel>
                {g.examples.map((ex) => (
                  <MenuItem
                    key={ex.query}
                    onSelect={() => {
                      onSelect(ex.query);
                      close();
                    }}
                    className="flex-col !items-start !gap-0.5"
                  >
                    <span className="block text-[12px] text-fg-muted">
                      {ex.label}
                      {ex.description && <span className="text-fg-faint"> — {ex.description}</span>}
                    </span>
                    <code className="block truncate font-mono text-[12px] text-fg">{ex.query}</code>
                  </MenuItem>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t border-line px-3 py-1.5 text-[11px] text-fg-faint">Examples use the sample dataset fields.</div>
        </>
      )}
    </Popover>
  );
});
