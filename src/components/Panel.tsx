import type { ReactNode } from "react";
import { cx } from "./ui";

interface PanelProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** A workspace panel: compact header with actions, flexible body, optional footer. */
export function Panel({ title, icon, badge, actions, footer, children, className, ariaLabel }: PanelProps) {
  return (
    <section aria-label={ariaLabel ?? title} className={cx("flex h-full min-h-0 min-w-0 flex-col bg-surface", className)}>
      <header className="flex h-9 shrink-0 items-center gap-1.5 border-b border-line bg-surface-2 pl-3 pr-1.5">
        {icon && <span className="shrink-0 text-fg-faint">{icon}</span>}
        <h2 className="shrink-0 text-[11.5px] font-semibold uppercase tracking-wider text-fg-muted">{title}</h2>
        {badge}
        <div className="no-scrollbar flex min-w-0 flex-1 overflow-x-auto">
          {/* ml-auto (not justify-end) keeps overflowing actions reachable by scrolling */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</div>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
      {footer && (
        <footer className="flex h-7 shrink-0 items-center gap-3 overflow-hidden border-t border-line bg-surface-2 px-3 text-[11px] text-fg-muted">
          {footer}
        </footer>
      )}
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      {icon && <div className="text-fg-faint">{icon}</div>}
      <div className="text-[13px] font-medium text-fg">{title}</div>
      {children && <div className="max-w-sm text-[12px] leading-relaxed text-fg-muted">{children}</div>}
    </div>
  );
}
