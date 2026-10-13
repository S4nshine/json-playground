import { memo, useState } from "react";
import { Bookmark, History, Trash2, X } from "lucide-react";
import type { SavedQuery } from "../lib/storage";
import { Button, IconButton, MenuItem, Popover, Segmented } from "./ui";

interface QueryHistoryProps {
  history: string[];
  snippets: SavedQuery[];
  onSelect: (query: string) => void;
  onClearHistory: () => void;
  onDeleteSnippet: (id: string) => void;
}

/** Recent queries and saved snippets. */
export const QueryHistory = memo(function QueryHistory({ history, snippets, onSelect, onClearHistory, onDeleteSnippet }: QueryHistoryProps) {
  const [tab, setTab] = useState<"recent" | "saved">("recent");
  return (
    <Popover
      label="Query history and saved queries"
      width={380}
      align="end"
      trigger={({ toggle, ref, open }) => (
        <Button ref={ref} variant="ghost" icon={<History size={14} />} aria-label="Query history" title="History and saved queries" onClick={toggle} aria-expanded={open} aria-haspopup="menu" collapseLabel>
          History
        </Button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-line p-2">
            <Segmented
              ariaLabel="History or saved"
              value={tab}
              onChange={setTab}
              options={[
                { value: "recent", label: `Recent (${history.length})` },
                { value: "saved", label: `Saved (${snippets.length})` },
              ]}
            />
            {tab === "recent" && history.length > 0 && (
              <Button variant="danger" icon={<Trash2 size={13} />} onClick={onClearHistory}>
                Clear
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {tab === "recent" &&
              (history.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-fg-muted">Queries you run will appear here.</div>
              ) : (
                history.map((q) => (
                  <MenuItem
                    key={q}
                    onSelect={() => {
                      onSelect(q);
                      close();
                    }}
                  >
                    <code className="font-mono text-[12px]">{q}</code>
                  </MenuItem>
                ))
              ))}
            {tab === "saved" &&
              (snippets.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-fg-muted">
                  <Bookmark size={16} className="mx-auto mb-2 text-fg-faint" />
                  Save the current query with the bookmark button to reuse it later.
                </div>
              ) : (
                snippets.map((s) => (
                  <div key={s.id} className="group flex items-center pr-1 hover:bg-surface-3">
                    <MenuItem
                      onSelect={() => {
                        onSelect(s.query);
                        close();
                      }}
                      className="min-w-0 flex-1 flex-col !items-start !gap-0.5 hover:bg-transparent"
                    >
                      <span className="block truncate text-[12px] font-medium">{s.name}</span>
                      <code className="block truncate font-mono text-[11.5px] text-fg-muted">{s.query}</code>
                    </MenuItem>
                    <IconButton label={`Delete ${s.name}`} onClick={() => onDeleteSnippet(s.id)} className="opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <X size={13} />
                    </IconButton>
                  </div>
                ))
              ))}
          </div>
        </>
      )}
    </Popover>
  );
});
