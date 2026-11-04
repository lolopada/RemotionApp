import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { navigate } from "../../lib/router";
import { useProjectSync } from "../../store/useProjectSync";
import { useShortcuts } from "../../store/useShortcuts";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { LibraryPanel } from "../library/LibraryPanel";
import { PreviewStage } from "../preview/PreviewStage";
import { Storyboard } from "../storyboard/Storyboard";
import { TopBar } from "../topbar/TopBar";

/**
 *  ┌──────────────── TopBar ────────────────┐
 *  │ Bibliothèque │   Aperçu    │ Réglages  │
 *  │              │ (Player)    │           │
 *  ├──────────────┴─ Storyboard + audio ────┤
 */
export function EditorPage({ projectId }: { projectId: string }) {
  const [revision, setRevision] = useState(0);
  const { state: sync, flush } = useProjectSync(projectId, revision);
  useShortcuts();

  // Pendant un rechargement (après restauration), on garde l'éditeur affiché.
  if (sync.status === "loading" && revision === 0) {
    return (
      <div className="flex h-full items-center justify-center text-ink-muted">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  }

  if (sync.status === "notfound" || sync.status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-muted">
        <p>{sync.status === "notfound" ? "Ce projet n'existe pas (ou plus)." : sync.message}</p>
        <button type="button" className="text-accent underline" onClick={() => void navigate("/")}>
          Retour à mes projets
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        restoredDraft={sync.status === "ready" && sync.restoredDraft}
        flush={flush}
        reload={() => setRevision((r) => r + 1)}
      />
      <div className="flex min-h-0 flex-1">
        <LibraryPanel />
        <main className="flex min-w-0 flex-1 flex-col bg-canvas">
          <PreviewStage />
        </main>
        <InspectorPanel />
      </div>
      <Storyboard />
    </div>
  );
}
