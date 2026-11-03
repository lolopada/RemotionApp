import { useEffect } from "react";
import { playerRef } from "../features/preview/playerController";
import { useEditor } from "./editorStore";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Raccourcis clavier globaux de l'éditeur. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const { selectedLayerId, removeLayer, updateLayer, duplicateLayer, selectLayer } = useEditor.getState();
      const { undo, redo } = useEditor.temporal.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d" && selectedLayerId) {
        e.preventDefault();
        duplicateLayer(selectedLayerId);
      } else if (e.key === " ") {
        e.preventDefault();
        playerRef.current?.toggle();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedLayerId) {
        e.preventDefault();
        removeLayer(selectedLayerId);
      } else if (e.key === "Escape") {
        selectLayer(null);
      } else if (e.key.startsWith("Arrow") && selectedLayerId) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        updateLayer(selectedLayerId, (l) => {
          if (e.key === "ArrowLeft") l.transform.x -= step;
          if (e.key === "ArrowRight") l.transform.x += step;
          if (e.key === "ArrowUp") l.transform.y -= step;
          if (e.key === "ArrowDown") l.transform.y += step;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
