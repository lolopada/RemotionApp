import type { StoredFile } from "@app/schema";
import { framesToSeconds, getProjectDurationInFrames } from "@app/schema";
import { CheckCircle2, Download, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../../components/ui";
import { api } from "../../lib/api";
import { downloadBlob } from "../../lib/media";
import { navigate } from "../../lib/router";
import { useEditor } from "../../store/editorStore";
import { playerRef } from "../preview/playerController";

type State =
  | { status: "idle" }
  | { status: "rendering"; progress: number }
  | { status: "uploading"; progress: number }
  | { status: "done"; blob: Blob; filename: string; saved: StoredFile | null; uploadError?: string }
  | { status: "error"; message: string };

/**
 * Export : rendu dans le navigateur, puis envoi automatique de la vidéo au
 * serveur (onglet « Mes vidéos »). Le fichier reste téléchargeable tout de suite.
 */
export function ExportButton() {
  const [state, setState] = useState<State>({ status: "idle" });
  const abort = useRef<AbortController | null>(null);

  const start = async () => {
    const { project } = useEditor.getState();
    playerRef.current?.pause();
    abort.current = new AbortController();
    setState({ status: "rendering", progress: 0 });
    let blob: Blob;
    try {
      // Chargé à la demande : le moteur d'export est lourd, inutile au démarrage.
      const { exportVideo } = await import("./exportVideo");
      blob = await exportVideo(project, {
        signal: abort.current.signal,
        onProgress: (progress) => setState({ status: "rendering", progress }),
      });
    } catch (err) {
      if (abort.current?.signal.aborted) return setState({ status: "idle" });
      console.error(err);
      return setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }

    const name = project.name.trim() || "Montage";
    const filename = `${name}.mp4`;
    setState({ status: "uploading", progress: 0 });
    try {
      const saved = await api.uploadVideo(
        blob,
        {
          name,
          projectId: project.id,
          width: project.width,
          height: project.height,
          duration: framesToSeconds(getProjectDurationInFrames(project), project.fps),
        },
        (progress) => setState({ status: "uploading", progress }),
      );
      setState({ status: "done", blob, filename, saved });
    } catch (err) {
      setState({
        status: "done",
        blob,
        filename,
        saved: null,
        uploadError: err instanceof Error ? err.message : "Envoi impossible",
      });
    }
  };

  if (state.status === "rendering" || state.status === "uploading") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-8 items-center gap-2 rounded-md bg-accent-soft px-3 text-sm">
          <LoaderCircle size={14} className="animate-spin" />
          {state.status === "rendering" ? "Export…" : "Enregistrement…"} {Math.round(state.progress * 100)}%
        </div>
        {state.status === "rendering" ? (
          <Button size="sm" onClick={() => abort.current?.abort()} title="Annuler l'export">
            <X size={14} />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button variant="primary" onClick={() => void start()}>
        <Download size={15} />
        Exporter MP4
      </Button>
      {state.status === "error" || state.status === "done" ? (
        <div className="absolute top-10 right-0 z-20 w-80 rounded-lg border border-line bg-panel p-3 text-xs shadow-2xl shadow-black/50">
          {state.status === "error" ? (
            <p className="text-red-200">{state.message}</p>
          ) : (
            <>
              {state.saved ? (
                <p className="flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 size={14} /> Vidéo enregistrée dans « Mes vidéos ».
                </p>
              ) : (
                <p className="text-amber-200">
                  Vidéo prête, mais pas enregistrée sur le serveur ({state.uploadError}). Télécharge-la pour la garder.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="primary" onClick={() => downloadBlob(state.blob, state.filename)}>
                  <Download size={13} /> Télécharger
                </Button>
                {state.saved ? (
                  <Button size="sm" onClick={() => void navigate("/videos")}>
                    Voir mes vidéos
                  </Button>
                ) : null}
              </div>
            </>
          )}
          <button
            type="button"
            className="absolute top-2 right-2 text-ink-faint hover:text-ink"
            aria-label="Fermer"
            onClick={() => setState({ status: "idle" })}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
