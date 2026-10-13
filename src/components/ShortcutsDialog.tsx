import { EDITOR_SHORTCUTS, SHORTCUTS, type ShortcutDef } from "../shortcuts";
import { Dialog, Kbd } from "./ui";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const all: ShortcutDef[] = [...Object.values(SHORTCUTS), ...EDITOR_SHORTCUTS];
  const groups = ["Query", "JSON", "App", "Editor"] as const;
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" width={560}>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g}>
            <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">{g}</h3>
            <ul>
              {all
                .filter((s) => s.group === g)
                .map((s) => (
                  <li key={s.combo + s.label} className="flex items-center justify-between gap-3 py-1 text-[12.5px]">
                    <span className="text-fg">{s.label}</span>
                    <Kbd combo={s.combo} />
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
