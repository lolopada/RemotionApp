import type { StoredFile } from "@app/schema";
import { framesToSeconds, getProjectDurationInFrames } from "@app/schema";
import clsx from "clsx";
import { CheckCircle2, Download, LoaderCircle, X } from "lucide-react";
import { useRef, useState } from "react";
import { Popover } from "../../components/Popover";
import { Button } from "../../components/ui";
import { api } from "../../lib/api";
import { downloadBlob } from "../../lib/media";
import { navigate } from "../../lib/router";
import { useEditor } from "../../store/editorStore";
import { playerRef } from "../preview/playerController";
import { EXPORT_QUALITIES, type ExportQuality, exportScale, exportSize } from "./quality";

const QUALITY_KEY = "export-quality";
const readQuality = (): ExportQuality => {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    return EXPORT_QUALITIES.some((q) => q.id === v) ? (v as ExportQuality) : "1080p";
  } catch {
    return "1080p";
  }
};

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
  const [quality, setQuality] = useState<ExportQuality>(readQuality);
  const width = useEditor((s) => s.project.width);
  const height = useEditor((s) => s.project.height);
  const fps = useEditor((s) => s.project.fps);

  const chooseQuality = (q: ExportQuality) => {
    setQuality(q);
    try {
      localStorage.setItem(QUALITY_KEY, q);
    } catch {
      // stockage indisponible : le choix vaut pour cette session seulement
    }
  };

  const start = async () => {
    const { project } = useEditor.getState();
    const scale = exportScale(project.width, project.height, quality);
    const size = exportSize(project.width, project.height, quality);
    playerRef.current?.pause();
    abort.current = new AbortController();
    setState({ status: "rendering", progress: 0 });
    let blob: Blob;
    try {
      // Chargé à la demande : le moteur d'export est lourd, inutile au démarrage.
      const { exportVideo } = await import("./exportVideo");
      blob = await exportVideo(project, {
        scale,
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
          width: size.width,
          height: size.height,
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
      <Popover
        className="w-64 p-2"
        trigger={({ toggle }) => (
          <Button variant="primary" onClick={toggle}>
            <Download size={15} />
            Exporter MP4
          </Button>
        )}
      >
        {(close) => (
          <div className="space-y-2 p-1">
            <p className="text-[11px] text-ink-faint uppercase tracking-wider">Qualité</p>
            <div className="grid gap-1">
              {EXPORT_QUALITIES.map((q) => {
                const size = exportSize(width, height, q.id);
                return (
                  <button
                    type="button"
                    key={q.id}
                    onClick={() => chooseQuality(q.id)}
                    className={clsx(
                      "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                      quality === q.id
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-line text-ink-muted hover:text-ink",
                    )}
                  >
                    <span>{q.label}</span>
                    <span className="text-[10px] text-ink-faint tabular-nums">
                      {size.width} × {size.height}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-ink-faint leading-snug">
              {fps} images/s. La 4K prend nettement plus de temps et n'est pas gérée par tous les navigateurs.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => {
                close();
                void start();
              }}
            >
              Lancer l'export
            </Button>
          </div>
        )}
      </Popover>
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
