/** Local file import/export. Files are read in the browser and never uploaded. */

export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export class FileImportError extends Error {}

export function isJsonLikeFile(file: File): boolean {
  return (
    file.type === "application/json" ||
    file.type === "text/plain" ||
    file.type === "" ||
    /\.(json|geojson|jsonl|ndjson|txt|map|webmanifest)$/i.test(file.name) ||
    file.type.endsWith("+json")
  );
}

export async function readJsonFile(file: File): Promise<string> {
  if (!isJsonLikeFile(file)) {
    throw new FileImportError(`"${file.name}" doesn't look like a JSON file (${file.type || "unknown type"}).`);
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new FileImportError(`"${file.name}" is too large (${Math.round(file.size / 1024 / 1024)} MB). The limit is 100 MB.`);
  }
  return file.text();
}

/** Open the native file picker and resolve with the chosen file (or null if cancelled). */
export function pickFile(accept = ".json,application/json,.txt,.geojson"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    input.addEventListener("cancel", () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

export function downloadText(text: string, filename: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampedName(base: string, ext = "json"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
}
