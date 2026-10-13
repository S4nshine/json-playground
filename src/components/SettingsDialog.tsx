import { DEFAULT_SETTINGS, type Settings } from "../lib/storage";
import { Button, Dialog, Segmented, Select, Switch } from "./ui";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClearData: () => void;
}

export function SettingsDialog({ open, onClose, settings, onChange, onClearData }: SettingsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Settings"
      footer={
        <>
          <Button variant="ghost" onClick={() => onChange(DEFAULT_SETTINGS)}>
            Reset to defaults
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <h3 className="pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">Formatting</h3>
      <div className="flex items-center justify-between gap-4 py-2">
        <div>
          <div className="text-[13px] font-medium">Indentation</div>
          <div className="text-[12px] text-fg-muted">Used by Format and for query results.</div>
        </div>
        <Segmented
          ariaLabel="Indentation"
          value={String(settings.indent) as "2" | "4" | "tab"}
          onChange={(v) => onChange({ indent: v === "tab" ? "tab" : (Number(v) as 2 | 4) })}
          options={[
            { value: "2", label: "2 spaces" },
            { value: "4", label: "4 spaces" },
            { value: "tab", label: "Tab" },
          ]}
        />
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <div>
          <div className="text-[13px] font-medium">Format style</div>
          <div className="text-[12px] text-fg-muted">Compact keeps short arrays and objects on one line.</div>
        </div>
        <Segmented
          ariaLabel="Format style"
          value={settings.formatStyle}
          onChange={(v) => onChange({ formatStyle: v })}
          options={[
            { value: "expanded", label: "Expanded" },
            { value: "compact", label: "Compact" },
          ]}
        />
      </div>

      <h3 className="mt-3 border-t border-line pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">Editor</h3>
      <Switch checked={settings.wordWrap} onChange={(v) => onChange({ wordWrap: v })} label="Word wrap" description="Wrap long lines instead of scrolling horizontally." />
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="text-[13px] font-medium">Font size</div>
        <Select
          ariaLabel="Font size"
          value={settings.fontSize}
          onChange={(v) => onChange({ fontSize: v })}
          options={[11, 12, 13, 14, 15, 16, 18].map((n) => ({ value: n, label: `${n}px` }))}
        />
      </div>

      <h3 className="mt-3 border-t border-line pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">Query</h3>
      <Switch
        checked={settings.autoRun}
        onChange={(v) => onChange({ autoRun: v })}
        label="Run automatically"
        description="Re-run the query as you edit the input or the query."
      />
      <Switch checked={settings.sortKeys} onChange={(v) => onChange({ sortKeys: v })} label="Sort keys (-S)" description="Output object keys in sorted order." />
      <Switch
        checked={settings.slurp}
        onChange={(v) => onChange({ slurp: v })}
        label="Slurp (-s)"
        description="Read all input values into a single array (useful for multiple JSON values / JSON Lines)."
      />

      <h3 className="mt-3 border-t border-line pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-fg-faint">Storage</h3>
      <Switch
        checked={settings.persistWorkspace}
        onChange={(v) => onChange({ persistWorkspace: v })}
        label="Remember workspace"
        description="Keep input, query and comparison in this browser's local storage (inputs over 2 MB are not saved)."
      />
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="text-[12px] text-fg-muted">Remove saved workspace, history and snippets from this browser.</div>
        <Button variant="danger" onClick={onClearData}>
          Clear local data
        </Button>
      </div>
    </Dialog>
  );
}
