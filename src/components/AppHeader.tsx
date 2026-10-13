import { memo } from "react";
import { Keyboard, Lock, Settings2 } from "lucide-react";
import { APP_NAME, GITHUB_URL } from "../config";
import type { Theme } from "../lib/storage";
import { GitHubIcon, LogoMark } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { IconButton, Segmented } from "./ui";

export type AppView = "playground" | "compare";

interface AppHeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

export const AppHeader = memo(function AppHeader({ theme, onToggleTheme, view, onViewChange, onOpenSettings, onOpenShortcuts }: AppHeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <a href="/" className="flex shrink-0 items-center gap-2 text-fg no-underline" aria-label={APP_NAME}>
        <LogoMark />
        <span className="hidden text-[14px] font-semibold tracking-tight min-[420px]:inline">{APP_NAME}</span>
      </a>
      <Segmented
        ariaLabel="Workspace"
        value={view}
        onChange={onViewChange}
        options={[
          { value: "playground", label: "Playground" },
          { value: "compare", label: "Compare" },
        ]}
      />
      <div className="flex-1" />
      <span
        className="hidden items-center gap-1 text-[11px] text-fg-faint lg:inline-flex"
        title="Parsing, formatting and jq queries run entirely in your browser. Nothing is uploaded."
      >
        <Lock size={11} /> Runs locally — your data never leaves the browser
      </span>
      <div className="flex items-center gap-0.5">
        <IconButton label="Keyboard shortcuts" shortcut="mod+shift+/" onClick={onOpenShortcuts}>
          <Keyboard size={16} />
        </IconButton>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings2 size={16} />
        </IconButton>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="GitHub repository"
          title="GitHub repository"
          className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg"
        >
          <GitHubIcon size={15} />
        </a>
      </div>
    </header>
  );
});
