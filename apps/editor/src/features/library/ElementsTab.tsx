import {
  createImageLayer,
  createShapeLayer,
  createTextLayer,
  DECOR_SHAPES,
  type DecorShape,
  type Layer,
  type MaskShape,
  SHAPES,
} from "@app/schema";
import { Type } from "lucide-react";
import type { ReactNode } from "react";
import { ShapeIcon } from "../../components/ShapeIcon";
import { useEditor, useProject } from "../../store/editorStore";
import { SHAPE_LABELS } from "../inspector/sections/ImageSection";
import { DECOR_LABELS } from "../inspector/sections/ShapeSection";
import { TabHeader } from "./LibraryPanel";
import { StickerGrid } from "./StickerGrid";
import { TextStyles } from "./TextStyles";

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

  /** Forme simple, avec une couleur et des proportions adaptées à son dessin. */
  const newShape = (shape: DecorShape) => {
    const w = unit * 0.3;
    const wide = shape === "arrow" ? w * 1.4 : shape === "bubble" || shape === "cloud" ? w * 1.2 : w;
    const tall = shape === "arrow" ? w * 0.7 : shape === "bubble" || shape === "cloud" ? w * 0.8 : w;
    if (shape === "line") {
      return createShapeLayer({
        name: DECOR_LABELS.line,
        shape,
        stroke: { enabled: true, color: "#ffffff", width: 10 },
        transform: centered(unit * 0.6, 40),
      });
    }
    return createShapeLayer({
      name: DECOR_LABELS[shape],
      shape,
      fill:
        shape === "heart"
          ? "#f43f5e"
          : shape === "star" || shape === "burst"
            ? "#facc15"
            : shape === "arrow"
              ? "#fb923c"
              : "#ffffff",
      transform: centered(wide, tall),
    });
  };

  return (
    <div>
      <TabHeader
        title="Styles de texte"
        hint="Clique pour ajouter un texte, ou pour changer le style du texte sélectionné."
      />
      <TextStyles />

      <TabHeader title="Textes simples" />
      <div className="grid grid-cols-3 gap-2 px-3">
        <Tile
          label="Titre"
          icon={<Type size={20} />}
          onClick={() =>
            add(
              createTextLayer({
                name: "Titre",
                text: "Un titre",
                ...(project.theme ? { fontFamily: project.theme.headingFont, color: project.theme.colors.title } : {}),
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
                fontFamily: project.theme?.bodyFont ?? "Montserrat",
                ...(project.theme ? { color: project.theme.colors.text } : {}),
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
      <div className="grid grid-cols-4 gap-2 px-3">
        {SHAPES.map((shape) => (
          <Tile
            key={shape}
            label={SHAPE_LABELS[shape]}
            icon={<ShapeIcon shape={shape} size={22} />}
            onClick={() => frame(shape)}
          />
        ))}
        <Tile
          label="Polaroid"
          icon={<ShapeIcon shape="rect" size={22} className="text-white" />}
          onClick={() =>
            add(
              createImageLayer({
                name: "Polaroid",
                frame: "polaroid",
                caption: "Souvenir",
                dropShadow: { enabled: true },
                transform: { ...centered(unit * 0.46, unit * 0.56), rotation: -4 },
              }),
            )
          }
        />
        <Tile
          label="Rond flou"
          icon={<ShapeIcon shape="circle" size={22} className="blur-[1.5px]" />}
          onClick={() => frame("circle", 60)}
        />
        <Tile
          label="Cœur flou"
          icon={<ShapeIcon shape="heart" size={22} className="blur-[1.5px]" />}
          onClick={() => frame("heart", 40)}
        />
        <Tile
          label="Nuage flou"
          icon={<ShapeIcon shape="cloud" size={22} className="blur-[1.5px]" />}
          onClick={() => frame("cloud", 30)}
        />
      </div>

      <TabHeader
        title="Formes"
        hint="Pleines, en dégradé ou vides : tout se règle ensuite dans le panneau de droite."
      />
      <div className="grid grid-cols-4 gap-2 px-3">
        {DECOR_SHAPES.map((shape) => (
          <Tile
            key={shape}
            label={DECOR_LABELS[shape]}
            icon={<ShapeIcon shape={shape} size={22} />}
            onClick={() => add(newShape(shape))}
          />
        ))}
      </div>

      <TabHeader title="Formes prêtes à l'emploi" />
      <div className="grid grid-cols-3 gap-2 px-3 pb-3">
        <Tile
          label="Cadre vide"
          icon={<ShapeIcon shape="rounded" size={22} className="opacity-60" />}
          onClick={() =>
            add(
              createShapeLayer({
                name: "Cadre vide",
                shape: "rounded",
                radius: 28,
                fillMode: "none",
                stroke: { enabled: true, color: "#ffffff", width: 10 },
                transform: centered(unit * 0.6, unit * 0.6),
              }),
            )
          }
        />
        <Tile
          label="Pastille dégradée"
          icon={<ShapeIcon shape="circle" size={22} className="text-fuchsia-400" />}
          onClick={() =>
            add(
              createShapeLayer({
                name: "Pastille dégradée",
                shape: "circle",
                fillMode: "gradient",
                gradient: { colors: ["#f472b6", "#7c3aed"], angle: 135 },
                dropShadow: { enabled: true, blur: 36, y: 18, opacity: 0.5 },
                transform: centered(unit * 0.3, unit * 0.3),
              }),
            )
          }
        />
        <Tile
          label="Bulle de BD"
          icon={<ShapeIcon shape="bubble" size={22} />}
          onClick={() =>
            add(
              createShapeLayer({
                name: "Bulle de BD",
                shape: "bubble",
                fill: "#ffffff",
                stroke: { enabled: true, color: "#0f172a", width: 8 },
                dropShadow: { enabled: true, blur: 20, y: 10, opacity: 0.35 },
                transform: centered(unit * 0.5, unit * 0.36),
              }),
            )
          }
        />
        <Tile
          label="Explosion BD"
          icon={<ShapeIcon shape="burst" size={22} className="text-yellow-300" />}
          onClick={() =>
            add(
              createShapeLayer({
                name: "Explosion",
                shape: "burst",
                fill: "#fde047",
                stroke: { enabled: true, color: "#dc2626", width: 10 },
                transform: { ...centered(unit * 0.4, unit * 0.4), rotation: -8 },
              }),
            )
          }
        />
        <Tile
          label="Flèche contour"
          icon={<ShapeIcon shape="arrow" size={22} className="opacity-60" />}
          onClick={() =>
            add(
              createShapeLayer({
                name: "Flèche",
                shape: "arrow",
                fillMode: "none",
                stroke: { enabled: true, color: "#ffffff", width: 8 },
                transform: centered(unit * 0.4, unit * 0.2),
              }),
            )
          }
        />
        <Tile
          label="Ligne pointillée"
          icon={<ShapeIcon shape="line" size={22} />}
          onClick={() =>
            add(
              createShapeLayer({
                name: "Ligne pointillée",
                shape: "line",
                stroke: { enabled: true, color: "#ffffff", width: 8, style: "dotted" },
                transform: centered(unit * 0.6, 40),
              }),
            )
          }
        />
      </div>

      <StickerGrid />
    </div>
  );
}
