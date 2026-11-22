import type { StoredFile as AssetInfo } from "@app/schema";
import { createVideoLayer } from "@app/schema";
import { Clapperboard, Trash2 } from "lucide-react";
import { useState } from "react";
import { getVideoMeta } from "../../lib/media";
import { useEditor, useProjectFormat } from "../../store/editorStore";
import { TabHeader } from "./LibraryPanel";
import { UploadButton } from "./UploadButton";
import { useAssets } from "./useAssets";

/** Vidéos importées : un clic ajoute un calque vidéo au centre de la scène. */
export function VideoTab() {
  const project = useProjectFormat();
  const { addLayer } = useEditor.getState();
  const { assets, error, uploading, upload, remove } = useAssets("video");
  const [adding, setAdding] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const use = async (asset: AssetInfo) => {
    setAdding(asset.id);
    setProblem(null);
    try {
      const meta = await getVideoMeta(asset.url);
      const ratio = meta.width && meta.height ? meta.width / meta.height : 16 / 9;
      // Au plus 70 % de l'image, dans le ratio de la vidéo.
      const k = Math.min((project.width * 0.7) / ratio, project.height * 0.7);
      const h = Math.round(k);
      const w = Math.round(k * ratio);
      addLayer(
        createVideoLayer({
          name: asset.name,
          src: asset.url,
          sourceDurationSeconds: meta.duration > 0 ? meta.duration : null,
          transform: {
            x: Math.round((project.width - w) / 2),
            y: Math.round((project.height - h) / 2),
            width: w,
            height: h,
          },
        }),
      );
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Impossible d'ajouter cette vidéo");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div>
      <TabHeader
        title="Vidéos"
        hint="Clique une vidéo pour l'ajouter à la scène. Elle démarre quand le calque apparaît ; son et vitesse se règlent dans le panneau de droite."
      />
      <div className="px-3">
        <UploadButton
          accept="video/mp4,video/webm"
          label="Importer des vidéos"
          uploading={uploading}
          onFiles={(f) => void upload(f)}
        />
        <p className="mt-1.5 text-[10px] text-ink-faint leading-snug">MP4 ou WebM (H.264, VP9). Pas de .mov.</p>
        {error || problem ? <p className="mt-2 text-[11px] text-red-300">{error ?? problem}</p> : null}
      </div>
      {assets.length === 0 && !error ? (
        <div className="m-3 flex flex-col items-center gap-2 rounded-md border border-line border-dashed p-6 text-center text-[11px] text-ink-faint">
          <Clapperboard size={22} />
          Aucune vidéo pour l'instant
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 p-3">
        {assets.map((a) => (
          <div key={a.id} className="group relative">
            <button
              type="button"
              disabled={adding === a.id}
              onClick={() => void use(a)}
              className="block aspect-video w-full overflow-hidden rounded-md bg-black ring-1 ring-line transition hover:ring-2 hover:ring-accent disabled:opacity-60"
            >
              <video src={`${a.url}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
            </button>
            <span className="mt-0.5 block truncate text-[10px] text-ink-muted">{a.name}</span>
            <button
              type="button"
              title="Supprimer de ma bibliothèque (les projets qui l'utilisent la perdront)"
              onClick={() => void remove(a.id)}
              className="absolute top-1 right-1 hidden rounded bg-black/70 p-1 text-white hover:bg-red-600 group-hover:block"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
