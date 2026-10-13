import type { ReactNode } from "react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import type { MobileTab } from "../types";
import { cx } from "./ui";

interface WorkspaceLayoutProps {
  input: ReactNode;
  query: ReactNode;
  results: ReactNode;
  isMobile: boolean;
  mobileTab: MobileTab;
  onMobileTabChange: (tab: MobileTab) => void;
  resultBadge?: ReactNode;
  inputBadge?: ReactNode;
}

/**
 * Desktop: resizable split — input on the left, query above results on the right.
 * Mobile: tabbed panels (all stay mounted so editor state is preserved).
 */
export function WorkspaceLayout(props: WorkspaceLayoutProps) {
  return props.isMobile ? <MobileLayout {...props} /> : <DesktopLayout {...props} />;
}

function DesktopLayout({ input, query, results }: WorkspaceLayoutProps) {
  const main = useDefaultLayout({ id: "jsonpg-main", storage: localStorage, panelIds: ["input", "right"] });
  const right = useDefaultLayout({ id: "jsonpg-right", storage: localStorage, panelIds: ["query", "results"] });
  return (
    <Group orientation="horizontal" id="jsonpg-main" defaultLayout={main.defaultLayout} onLayoutChanged={main.onLayoutChanged} className="min-h-0 flex-1">
      <Panel id="input" defaultSize="50%" minSize="20%">
        {input}
      </Panel>
      <Separator />
      <Panel id="right" defaultSize="50%" minSize="20%">
        <Group orientation="vertical" id="jsonpg-right" defaultLayout={right.defaultLayout} onLayoutChanged={right.onLayoutChanged}>
          <Panel id="query" defaultSize="26%" minSize={96}>
            {query}
          </Panel>
          <Separator />
          <Panel id="results" defaultSize="74%" minSize={120}>
            {results}
          </Panel>
        </Group>
      </Panel>
    </Group>
  );
}

function MobileLayout({ input, query, results, mobileTab, onMobileTabChange, resultBadge, inputBadge }: WorkspaceLayoutProps) {
  const tabs: { id: MobileTab; label: string; badge?: ReactNode }[] = [
    { id: "input", label: "Input", badge: inputBadge },
    { id: "query", label: "Query" },
    { id: "result", label: "Result", badge: resultBadge },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Workspace panels" className="flex h-9 shrink-0 border-b border-line bg-surface">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mobileTab === t.id}
            onClick={() => onMobileTabChange(t.id)}
            className={cx(
              "relative flex flex-1 items-center justify-center gap-1.5 text-[12.5px] font-medium",
              mobileTab === t.id ? "text-fg" : "text-fg-muted",
            )}
          >
            {t.label}
            {t.badge}
            {mobileTab === t.id && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <div role="tabpanel" className={cx("absolute inset-0", mobileTab !== "input" && "invisible")}>
          {input}
        </div>
        <div role="tabpanel" className={cx("absolute inset-0", mobileTab !== "query" && "invisible")}>
          {query}
        </div>
        <div role="tabpanel" className={cx("absolute inset-0", mobileTab !== "result" && "invisible")}>
          {results}
        </div>
      </div>
    </div>
  );
}
