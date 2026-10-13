/** Small, dependency-free UI primitives shared across the app. */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { formatCombo } from "../hooks/useHotkeys";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "default" | "primary" | "ghost" | "danger";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
  /** Hide the text label below a breakpoint (icon stays). `true` means `sm`. */
  collapseLabel?: boolean | "lg" | "xl";
}

const variants: Record<Variant, string> = {
  default:
    "border border-line bg-surface text-fg hover:bg-surface-3 hover:border-line-strong active:bg-surface-3 disabled:hover:bg-surface",
  primary: "border border-accent bg-accent text-accent-fg hover:bg-accent-hover hover:border-accent-hover shadow-sm",
  ghost: "border border-transparent text-fg-muted hover:text-fg hover:bg-surface-3",
  danger: "border border-transparent text-fg-muted hover:text-danger hover:bg-danger-soft",
};

export function Button({ variant = "default", size = "sm", icon, collapseLabel, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-3 text-[13px]",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children != null && (
        <span
          className={cx(
            collapseLabel === true && "hidden sm:inline",
            collapseLabel === "lg" && "hidden lg:inline",
            collapseLabel === "xl" && "hidden xl:inline",
          )}
        >
          {children}
        </span>
      )}
    </button>
  );
}

interface IconButtonProps extends ComponentProps<"button"> {
  label: string;
  active?: boolean;
  shortcut?: string;
}

export function IconButton({ label, active, shortcut, className, children, ...rest }: IconButtonProps) {
  const title = shortcut ? `${label} (${formatCombo(shortcut).join(" ")})` : label;
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      aria-pressed={active}
      className={cx(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-surface-3 text-fg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Kbd({ combo, className }: { combo: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)}>
      {formatCombo(combo).map((k, i) => (
        <kbd
          key={i}
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line-strong bg-surface-2 px-1 font-sans text-[10.5px] font-medium text-fg-muted"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div role="separator" aria-orientation="vertical" className={cx("mx-1 h-5 w-px shrink-0 bg-line", className)} />;
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx("inline-flex h-7 shrink-0 rounded-md border border-line bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex items-center gap-1 rounded-[4px] px-2 text-[11.5px] font-medium transition-colors",
            value === o.value ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      title={ariaLabel}
      value={String(value)}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
      className={cx(
        "h-7 shrink-0 cursor-pointer rounded-md border border-line bg-surface pl-2 pr-6 text-[12px] text-fg hover:border-line-strong",
        className,
      )}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        {description && <div className="mt-0.5 text-[12px] leading-snug text-fg-muted">{description}</div>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[16px]" : "translate-x-[2px]",
          )}
        />
      </button>
    </div>
  );
}

/* ---------------- Popover ---------------- */

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void; ref: (el: HTMLElement | null) => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: number;
  label: string;
}

/** A click-triggered popover rendered in a portal (so panels can't clip it). */
export function Popover({ trigger, children, align = "start", width = 280, label }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    anchorRef.current?.focus();
  }, []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const place = () => {
      const r = anchorRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const w = Math.min(width, vw - 16);
      let left = align === "end" ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      const below = window.innerHeight - r.bottom - 12;
      setPos({ top: r.bottom + 4, left, maxHeight: Math.max(160, below) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    // Focus the first focusable element for keyboard users.
    requestAnimationFrame(() => {
      const first = popRef.current?.querySelector<HTMLElement>("input, [role=menuitem], button");
      first?.focus();
    });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...(popRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    if (items.length === 0) return;
    e.preventDefault();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <>
      {trigger({
        open,
        toggle,
        ref: (el) => {
          anchorRef.current = el;
        },
      })}
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            style={{ top: pos.top, left: pos.left, width: Math.min(width, window.innerWidth - 16), maxHeight: pos.maxHeight }}
            className="animate-pop fixed z-50 flex flex-col overflow-hidden rounded-lg border border-line-strong bg-surface text-fg shadow-pop"
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  onSelect,
  children,
  hint,
  icon,
  className,
  danger,
}: {
  onSelect: () => void;
  children: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cx(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] outline-none hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none",
        danger ? "text-danger" : "text-fg",
        className,
      )}
    >
      {icon && <span className="shrink-0 text-fg-muted">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[11px] text-fg-faint">{hint}</span>}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">{children}</div>;
}

/* ---------------- Dialog ---------------- */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && ref.current) {
        // Simple focus trap
        const focusables = [...ref.current.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")].filter(
          (el) => !el.hasAttribute("disabled"),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("button, input, select")?.focus());
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: width }}
        className="animate-pop w-full overflow-hidden rounded-xl border border-line-strong bg-surface text-fg shadow-pop"
      >
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <h2 id={titleId} className="text-[14px] font-semibold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-4 py-2.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Status chip ---------------- */

export function StatusChip({
  tone,
  children,
  onClick,
  title,
}: {
  tone: "success" | "danger" | "warning" | "neutral" | "accent";
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const tones = {
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    neutral: "bg-surface-3 text-fg-muted",
    accent: "bg-accent-soft text-accent",
  };
  const cls = cx(
    "inline-flex h-5 max-w-full shrink items-center gap-1 truncate rounded-full px-2 text-[11px] font-medium",
    tones[tone],
    onClick && "cursor-pointer hover:brightness-110",
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={title}>
      {children}
    </button>
  ) : (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}
