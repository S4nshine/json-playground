import { memo } from "react";
import { CircleAlert, CircleCheck, CircleDashed, Lock, LoaderCircle, Moon, Sun } from "lucide-react";
import type { ValidationResult, IndentOption } from "../lib/json";
import type { Theme } from "../lib/storage";
import type { RunState } from "../types";
import { cx } from "./ui";

interface StatusBarProps {
  validation: ValidationResult;
  run: RunState;
  indent: IndentOption;
  theme: Theme;
  jqVersion: string | null;
  engineError: string | null;
  onJumpToError: () => void;
}

export const StatusBar = memo(function StatusBar({ validation, run, indent, theme, jqVersion, engineError, onJumpToError }: StatusBarProps) {
  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 overflow-hidden border-t border-line bg-surface-2 px-3 text-[11px] text-fg-muted">
      <span className="flex min-w-0 items-center gap-1">
        {validation.status === "valid" && (
          <>
            <CircleCheck size={12} className="text-success" /> JSON valid
          </>
        )}
        {validation.status === "empty" && (
          <>
            <CircleDashed size={12} /> No input
          </>
        )}
        {validation.status === "invalid" && (
          <button onClick={onJumpToError} className="flex min-w-0 items-center gap-1 text-danger hover:underline" title={validation.error.message}>
            <CircleAlert size={12} className="shrink-0" />
            <span className="truncate">
              JSON invalid · Ln {validation.error.line}, Col {validation.error.column}
            </span>
          </button>
        )}
      </span>
      <QueryStatus run={run} />
      <span className="flex-1" />
      <span className="hidden shrink-0 sm:inline">{indent === "tab" ? "Tabs" : `Spaces: ${indent}`}</span>
      <span className={cx("hidden shrink-0 sm:inline", engineError && "text-danger")} title={engineError ?? "jq engine (WebAssembly)"}>
        {engineError ? "jq unavailable" : jqVersion ? jqVersion.replace("jq-", "jq ") : "jq loading…"}
      </span>
      <span className="hidden shrink-0 items-center gap-1 md:inline-flex">
        {theme === "dark" ? <Moon size={11} /> : <Sun size={11} />} {theme === "dark" ? "Dark" : "Light"}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1" title="All processing happens in your browser">
        <Lock size={11} /> Local
      </span>
    </footer>
  );
});

function QueryStatus({ run }: { run: RunState }) {
  if (run.status === "idle") return <span className="hidden shrink-0 sm:inline">Query: ready</span>;
  if (run.status === "running")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-accent">
        <LoaderCircle size={11} className="animate-spin" /> Running…
      </span>
    );
  const { outcome } = run;
  if (outcome.error)
    return <span className="shrink-0 text-danger">Query: {outcome.error.kind === "compile" ? "syntax error" : outcome.error.kind}</span>;
  return (
    <span className="shrink-0">
      Query: {outcome.outputs.length.toLocaleString()} {outcome.outputs.length === 1 ? "result" : "results"} in{" "}
      {outcome.durationMs < 10 ? outcome.durationMs.toFixed(1) : Math.round(outcome.durationMs)} ms
    </span>
  );
}
