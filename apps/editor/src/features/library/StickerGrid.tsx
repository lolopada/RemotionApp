import { createImageLayer } from "@app/schema";
import { useMemo } from "react";
import { useEditor, useProject } from "../../store/editorStore";
import { STICKER_CATEGORIES, STICKERS, stickerUrl } from "../../templates/stickers";
import { TabHeader } from "./LibraryPanel";

/** Stickers intégrés : un clic les ajoute au centre de la scène (calque photo ajusté dans son cadre). */
export function StickerGrid() {
  const project = useProject();
  const addLayer = useEditor((s) => s.addLayer);
  const urls = useMemo(() => new Map(STICKERS.map((s) => [s.id, stickerUrl(s)])), []);
  const size = Math.round(Math.min(project.width, project.height) * 0.28);

  return (
    <div>
      <TabHeader
        title="Stickers"
        hint="Des petits dessins prêts à poser. Ils se déplacent, tournent et reçoivent une ombre comme une photo."
      />
      {STICKER_CATEGORIES.map((category) => (
        <div key={category} className="px-3 pb-3">
          <h3 className="mb-1.5 font-semibold text-[11px] text-ink-faint uppercase tracking-wider">{category}</h3>
          <div className="grid grid-cols-4 gap-2">
            {STICKERS.filter((s) => s.category === category).map((s) => (
              <button
                type="button"
                key={s.id}
                title={s.label}
                aria-label={`Ajouter le sticker « ${s.label} »`}
                onClick={() =>
                  addLayer(
                    createImageLayer({
                      name: s.label,
                      src: urls.get(s.id) ?? null,
                      imageAspect: 1,
                      fit: "contain",
                      transform: {
                        x: Math.round((project.width - size) / 2),
                        y: Math.round((project.height - size) / 2),
                        width: size,
                        height: size,
                      },
                    }),
                  )
                }
                className="flex aspect-square items-center justify-center rounded-md bg-canvas p-1.5 ring-1 ring-line transition hover:ring-2 hover:ring-accent"
              >
                <img src={urls.get(s.id)} alt="" draggable={false} className="size-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
