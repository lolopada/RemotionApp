import { ArrowLeft, Cloud, CloudOff, LoaderCircle, Redo2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { Logo } from "../../components/Logo";
import { IconButton } from "../../components/ui";
import { navigate } from "../../lib/router";
import { type SaveStatus, useEditor } from "../../store/editorStore";
import { ExportButton } from "../export/ExportButton";

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "",
  pending: "Modifications…",
  saving: "Enregistrement…",
  saved: "Enregistré",
  error: "Échec d'enregistrement, nouvel essai…",
  offline: "Hors ligne, gardé sur cet appareil",
};

export function TopBar({ restoredDraft = false }: { restoredDraft?: boolean }) {
  const name = useEditor((s) => s.project.name);
  const renameProject = useEditor((s) => s.renameProject);
  const saveStatus = useEditor((s) => s.saveStatus);
  const { undo, redo, pastStates, futureStates } = useStore(useEditor.temporal);
  const [showRestored, setShowRestored] = useState(restoredDraft);

  useEffect(() => {
    if (!showRestored) return;
    const t = setTimeout(() => setShowRestored(false), 6000);
    return () => clearTimeout(t);
  }, [showRestored]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-line border-b bg-panel px-3">
      <IconButton label="Mes projets (enregistre avant de quitter)" onClick={() => void navigate("/")}>
        <ArrowLeft size={16} />
      </IconButton>
      <Logo />
      <div className="h-5 w-px bg-line" />
      <input
        className="w-64 rounded-md bg-transparent px-2 py-1 text-sm outline-none hover:bg-panel-hover focus:bg-canvas focus:ring-1 focus:ring-accent"
        value={name}
        onChange={(e) => renameProject(e.currentTarget.value)}
        aria-label="Nom du projet"
      />
      <span className="flex items-center gap-1.5 text-[11px] text-ink-faint" data-save-status={saveStatus}>
        {saveStatus === "saving" || saveStatus === "pending" ? (
          <LoaderCircle size={12} className="animate-spin" />
        ) : null}
        {saveStatus === "saved" ? <Cloud size={12} /> : null}
        {saveStatus === "offline" || saveStatus === "error" ? <CloudOff size={12} className="text-amber-400" /> : null}
        {SAVE_LABEL[saveStatus]}
      </span>
      {showRestored ? (
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
          Modifications non envoyées récupérées
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Annuler (Ctrl+Z)" disabled={pastStates.length === 0} onClick={() => undo()}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Rétablir (Ctrl+Maj+Z)" disabled={futureStates.length === 0} onClick={() => redo()}>
          <Redo2 size={16} />
        </IconButton>
        <div className="mx-2 h-5 w-px bg-line" />
        <ExportButton />
      </div>
    </header>
  );
}
