import { createStore } from "./store";

/** Cursor position of the input editor (kept outside React state to avoid app re-renders). */
export const inputCursorStore = createStore({ line: 1, column: 1 });
