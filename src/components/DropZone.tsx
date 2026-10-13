import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { FileUp } from "lucide-react";

/**
 * Accepts dropped files over its children. Handlers run in the capture phase
 * so CodeMirror doesn't insert the file contents at the drop position.
 */
export function DropZone({ onFile, children, label = "Drop a JSON file to load it" }: { onFile: (file: File) => void; children: ReactNode; label?: string }) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");

  return (
    <div
      className="relative h-full min-h-0"
      onDragEnterCapture={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setActive(true);
      }}
      onDragOverCapture={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeaveCapture={(e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setActive(false);
      }}
      onDropCapture={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        depth.current = 0;
        setActive(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      {children}
      {active && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accent bg-accent-soft text-accent backdrop-blur-[1px]">
          <FileUp size={28} />
          <div className="text-[13px] font-medium">{label}</div>
        </div>
      )}
    </div>
  );
}
