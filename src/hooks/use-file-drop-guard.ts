import { useEffect } from "react";
import { acceptsFileDrop, carriesFiles } from "@/lib/dropped-files";

export function useFileDropGuard() {
  useEffect(() => {
    const guard = (event: DragEvent) => {
      if (!event.dataTransfer || !carriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (event.type === "dragover") event.dataTransfer.dropEffect = acceptsFileDrop(event.target) ? "copy" : "none";
    };
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => {
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
    };
  }, []);
}
