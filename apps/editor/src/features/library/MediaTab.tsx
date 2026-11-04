import type { StoredFile as AssetInfo } from "@app/schema";
import { createBackground, createImageLayer } from "@app/schema";
import { ImagePlus, Trash2 } from "lucide-react";
import { assignImage } from "../../lib/images";
import { getImageSize } from "../../lib/media";
import { useEditor, useProject, useSelectedLayer } from "../../store/editorStore";
import { setDraggedAsset } from "../preview/dnd";
import { TabHeader } from "./LibraryPanel";
import { UploadButton } from "./UploadButton";
import { useAssets } from "./useAssets";

export function MediaTab() {
  const project = useProject();
  const selected = useSelectedLayer();
  const { addLayer, updateScene } = useEditor.getState();
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const { assets, error, uploading, upload, remove } = useAssets("image");

  /** Clic : remplit le cadre sélectionné, sinon ajoute une photo au centre. */
  const use = async (asset: AssetInfo) => {
    if (selected?.type === "image") {
      assignImage(selected.id, asset.url);
      return;
    }
    const { width, height } = await getImageSize(asset.url).catch(() => ({ width: 1, height: 1 }));
    const max = Math.min(project.width, project.height) * 0.6;
    const k = max / Math.max(width, height);
    const w = Math.round(width * k);
    const h = Math.round(height * k);
    addLayer(
      createImageLayer({
        name: asset.name,
        src: asset.url,
        imageAspect: width / height,
        transform: {
          x: Math.round((project.width - w) / 2),
          y: Math.round((project.height - h) / 2),
          width: w,
          height: h,
        },
      }),
    );
  };

  const setAsBackground = (asset: AssetInfo) =>
    updateScene(selectedSceneId, (s) => {
      // On garde le flou, le voile et l'animation si le fond était déjà une photo.
      if (s.background.type === "image") s.background.src = asset.url;
      else s.background = createBackground({ type: "image", src: asset.url, blur: 0, grain: s.background.grain });
    });

  return (
    <div>
      <TabHeader
        title="Photos"
        hint="Clique pour ajouter (ou remplir le cadre sélectionné). Glisse une photo sur un cadre de l'aperçu pour la remplacer."
      />
      <div className="px-3">
        <UploadButton
          accept="image/*"
          label="Importer des photos"
          uploading={uploading}
          onFiles={(f) => void upload(f)}
        />
        {error ? <p className="mt-2 text-[11px] text-red-300">{error}</p> : null}
      </div>
      {assets.length === 0 && !error ? (
        <div className="m-3 flex flex-col items-center gap-2 rounded-md border border-line border-dashed p-6 text-center text-[11px] text-ink-faint">
          <ImagePlus size={22} />
          Aucune photo pour l'instant
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 p-3">
        {assets.map((a) => (
          <div key={a.id} className="group relative">
            <button
              type="button"
              draggable
              onDragStart={(e) => setDraggedAsset(e, { url: a.url, kind: "image", name: a.name })}
              onClick={() => void use(a)}
              className="block aspect-square w-full overflow-hidden rounded-md bg-canvas ring-1 ring-line transition hover:ring-2 hover:ring-accent"
            >
              <img src={a.url} alt={a.name} loading="lazy" className="size-full object-cover" />
            </button>
            <button
              type="button"
              onClick={() => setAsBackground(a)}
              className="absolute right-1 bottom-1 hidden rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white group-hover:block"
            >
              En fond
            </button>
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
