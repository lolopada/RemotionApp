import { createImageLayer, createShapeLayer, createTextLayer, type Layer, type MaskShape } from "@app/schema";
import { Circle, Heart, Square, Type } from "lucide-react";
import type { ReactNode } from "react";
import { useEditor, useProject } from "../../store/editorStore";
import { TabHeader } from "./LibraryPanel";

function Tile({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md bg-canvas text-[11px] text-ink-muted ring-1 ring-line transition hover:text-ink hover:ring-accent"
    >
      {icon}
      {label}
    </button>
  );
}

export function ElementsTab() {
  const project = useProject();
  const addLayer = useEditor((s) => s.addLayer);
  const unit = Math.min(project.width, project.height);

  /** Centre un calque de taille (w, h) dans l'image. */
  const centered = (w: number, h: number) => ({
    x: Math.round((project.width - w) / 2),
    y: Math.round((project.height - h) / 2),
    width: Math.round(w),
    height: Math.round(h),
  });

  const add = (layer: Layer) => addLayer(layer);
  const frame = (shape: MaskShape, feather = 0) =>
    add(
      createImageLayer({
        name: "Cadre photo",
        mask: { shape, feather },
        transform: centered(unit * 0.5, unit * 0.5),
      }),
    );

  return (
    <div>
      <TabHeader title="Textes" />
      <div className="grid grid-cols-3 gap-2 px-3">
        <Tile
          label="Titre"
          icon={<Type size={20} />}
          onClick={() =>
            add(
              createTextLayer({
                name: "Titre",
                text: "Un titre",
                fontSize: Math.round(unit / 9),
                fontWeight: 900,
                transform: centered(project.width * 0.8, unit * 0.18),
              }),
            )
          }
        />
        <Tile
          label="Sous-titre"
          icon={<Type size={16} />}
          onClick={() =>
            add(
              createTextLayer({
                name: "Sous-titre",
                text: "Un sous-titre",
                fontFamily: "Montserrat",
                fontWeight: 400,
                fontSize: Math.round(unit / 20),
                transform: centered(project.width * 0.7, unit * 0.1),
              }),
            )
          }
        />
        <Tile
          label="Manuscrit"
          icon={<Type size={16} className="italic" />}
          onClick={() =>
            add(
              createTextLayer({
                name: "Manuscrit",
                text: "Avec amour",
                fontFamily: "Dancing Script",
                fontSize: Math.round(unit / 11),
                transform: centered(project.width * 0.7, unit * 0.14),
              }),
            )
          }
        />
      </div>

      <TabHeader title="Cadres photo" hint="Dépose ensuite une photo dessus : elle prend la forme du cadre." />
      <div className="grid grid-cols-3 gap-2 px-3">
        <Tile label="Carré" icon={<Square size={20} />} onClick={() => frame("rect")} />
        <Tile label="Arrondi" icon={<Square size={20} className="rounded" />} onClick={() => frame("rounded")} />
        <Tile label="Rond" icon={<Circle size={20} />} onClick={() => frame("circle")} />
        <Tile label="Cœur" icon={<Heart size={20} />} onClick={() => frame("heart")} />
        <Tile
          label="Rond flou"
          icon={<Circle size={20} className="blur-[1.5px]" />}
          onClick={() => frame("circle", 60)}
        />
        <Tile
          label="Cœur flou"
          icon={<Heart size={20} className="blur-[1.5px]" />}
          onClick={() => frame("heart", 40)}
        />
      </div>

      <TabHeader title="Formes" />
      <div className="grid grid-cols-3 gap-2 px-3 pb-3">
        {(
          [
            ["rect", "Rectangle", <Square key="r" size={20} />],
            ["circle", "Rond", <Circle key="c" size={20} />],
            ["heart", "Cœur", <Heart key="h" size={20} />],
          ] as const
        ).map(([shape, label, icon]) => (
          <Tile
            key={shape}
            label={label}
            icon={icon}
            onClick={() =>
              add(
                createShapeLayer({
                  name: label,
                  shape,
                  fill: shape === "heart" ? "#f43f5e" : "#ffffff",
                  transform: centered(unit * 0.3, unit * 0.3),
                }),
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
