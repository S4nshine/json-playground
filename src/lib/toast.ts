import { createStore } from "./store";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
}

export const toastStore = createStore<Toast[]>([]);
let nextId = 1;

function show(kind: ToastKind, message: string, detail?: string, durationMs = kind === "error" ? 5000 : 2200) {
  const id = nextId++;
  toastStore.set((list) => [...list.slice(-3), { id, kind, message, detail }]);
  setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: number) {
  toastStore.set((list) => list.filter((t) => t.id !== id));
}

export const toast = {
  success: (message: string, detail?: string) => show("success", message, detail),
  error: (message: string, detail?: string) => show("error", message, detail),
  info: (message: string, detail?: string) => show("info", message, detail),
};
