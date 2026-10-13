import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { dismissToast, toastStore } from "../lib/toast";
import { useStore } from "../lib/store";
import { cx } from "./ui";

export function Toaster() {
  const toasts = useStore(toastStore);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-9 right-3 z-[60] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="animate-toast pointer-events-auto flex items-start gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] text-fg shadow-pop"
        >
          <span className={cx("mt-px shrink-0", t.kind === "success" && "text-success", t.kind === "error" && "text-danger", t.kind === "info" && "text-accent")}>
            {t.kind === "success" ? <CircleCheck size={15} /> : t.kind === "error" ? <CircleAlert size={15} /> : <Info size={15} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{t.message}</div>
            {t.detail && <div className="mt-0.5 break-words font-mono text-[11.5px] text-fg-muted">{t.detail}</div>}
          </div>
          <button className="shrink-0 text-fg-faint hover:text-fg" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
