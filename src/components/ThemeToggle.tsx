import { Moon, Sun } from "lucide-react";
import type { Theme } from "../lib/storage";
import { IconButton } from "./ui";

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <IconButton label={`Switch to ${next} theme`} onClick={onToggle}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}
