import type { ImageLayer } from "@app/schema";
import type { CSSProperties } from "react";
import { Img } from "remotion";
import { useRenderMode } from "../context";
import { useKenBurns } from "../effects/animations";
import { getMaskStyle } from "../effects/masks";
import { imageBox, photoArea, photoFilterCss } from "../effects/photo";
import { isBoxShape, shapePath } from "../effects/shapes";
import { ensureFont } from "../fonts";
import { withOpacity } from "./TextLayerView";
import type { LayerViewProps } from "./types";

/**
 * Photo dans son cadre :
 *   [ombre portée] → [carte polaroid] → [zone masquée : image + bordure]
 * Les bordures sont dessinées PAR-DESSUS l'image, dans un calque à part :
 * à l'export navigateur, une photo zoomée recouvrirait sinon la bordure.
 */
export function ImageLayerView({ layer, sceneDurationInFrames }: LayerViewProps<ImageLayer>) {
  const { showPlaceholders } = useRenderMode();
  const kenBurns = useKenBurns(layer.animation.kenBurns, layer.animation.kenBurnsMode, sceneDurationInFrames);
  const polaroid = layer.frame === "polaroid";
  const area = photoArea(layer);
  // En polaroid, la photo est toujours rectangulaire.
  const mask = polaroid ? { ...layer.mask, shape: "rect" as const, feather: 0 } : layer.mask;
  const box = imageBox(layer, area.width, area.height);
  const { zoom, offsetX, offsetY } = layer.crop;
  const ds = layer.dropShadow;
  if (polaroid && layer.caption) ensureFont("Caveat", 700);

  const maskStyle = getMaskStyle(mask, area.width, area.height);
  const clipped = "clipPath" in maskStyle || "maskImage" in maskStyle;
  const overflows =
    !clipped &&
    (box.width > area.width + 0.5 ||
      box.height > area.height + 0.5 ||
      zoom > 1 ||
      layer.animation.kenBurns > 0 ||
      offsetX !== 0 ||
      offsetY !== 0);

  const photo = (
    <div
      style={{
        position: "absolute",
        left: area.x,
        top: area.y,
        width: area.width,
        height: area.height,
        // Rogner au cadre seulement si l'image déborde et qu'aucune forme ne
        // découpe déjà : un rognage inutile laisse un liseré dans l'ombre à l'export.
        overflow: overflows ? "hidden" : undefined,
        ...maskStyle,
      }}
    >
      {layer.src ? (
        <Img
          src={layer.src}
          style={{
            position: "absolute",
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            // L'image déborde volontairement du cadre : on neutralise les
            // « max-width: 100% » des feuilles de style (Tailwind, etc.).
            maxWidth: "none",
            maxHeight: "none",
            objectFit: box.objectFit,
            // object-position n'est pas supporté à l'export : le cadrage passe par transform.
            transform: [
              `translate(${(offsetX + kenBurns.x) * area.width}px, ${(offsetY + kenBurns.y) * area.height}px)`,
              `scale(${zoom * kenBurns.scale})`,
              layer.flipX || layer.flipY ? `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` : "",
            ].join(" "),
            filter: photoFilterCss(layer.filter),
          }}
        />
      ) : showPlaceholders ? (
        <Placeholder width={area.width} height={area.height} />
      ) : null}
      <Border layer={layer} shape={mask.shape} width={area.width} height={area.height} />
    </div>
  );

  const content = polaroid ? (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#fbfaf7",
        borderRadius: 4,
      }}
    >
      {photo}
      {layer.caption ? (
        <div
          style={{
            position: "absolute",
            left: area.x,
            width: area.width,
            top: area.y + area.height,
            height: layer.transform.height - area.y - area.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: '"Caveat", cursive',
            fontWeight: 700,
            fontSize: Math.round((layer.transform.height - area.y - area.height) * 0.42),
            color: "#374151",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {layer.caption}
        </div>
      ) : null}
    </div>
  ) : (
    photo
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        // drop-shadow suit la forme découpée (contrairement à box-shadow).
        filter: ds.enabled
          ? `drop-shadow(${ds.x}px ${ds.y}px ${ds.blur / 2}px ${withOpacity(ds.color, ds.opacity)})`
          : undefined,
      }}
    >
      {content}
    </div>
  );
}

/** Bordure : CSS pour les formes rectangulaires/rondes, tracé SVG pour les autres. */
function Border({ layer, shape, width, height }: { layer: ImageLayer; shape: string; width: number; height: number }) {
  const { width: bw, color, style } = layer.border;
  if (bw <= 0) return null;
  const full: CSSProperties = { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" };

  if (isBoxShape(shape)) {
    const radius = shape === "rounded" ? layer.mask.radius : shape === "circle" ? 9999 : 0;
    if (style === "double") {
      // Dessinée en deux traits : le style CSS « double » n'est pas exporté.
      const line = Math.max(1, bw / 3);
      const inset = bw - line;
      const ring = (offset: number): CSSProperties => ({
        position: "absolute",
        left: offset,
        top: offset,
        width: width - 2 * offset,
        height: height - 2 * offset,
        boxSizing: "border-box",
        border: `${line}px solid ${color}`,
        borderRadius: shape === "circle" ? "50%" : Math.max(0, radius - offset),
      });
      return (
        <>
          <div style={ring(0)} />
          <div style={ring(inset)} />
        </>
      );
    }
    return (
      <div
        style={{
          ...full,
          boxSizing: "border-box",
          border: `${bw}px ${style} ${color}`,
          borderRadius: shape === "circle" ? "50%" : radius || undefined,
        }}
      />
    );
  }
  // Trait centré sur le contour, doublé en épaisseur : la moitié extérieure
  // est coupée par le masque, il reste exactement `bw` à l'intérieur.
  const dash = style === "dashed" ? `${bw * 3} ${bw * 2}` : style === "dotted" ? `0 ${bw * 2.2}` : undefined;
  return (
    <svg style={full} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path
        d={shapePath(shape, width, height, { radius: layer.mask.radius })}
        fill="none"
        stroke={color}
        strokeWidth={bw * 2}
        strokeDasharray={dash}
        strokeLinecap={style === "dotted" ? "round" : "butt"}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Placeholder({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: "4px dashed rgba(255,255,255,0.6)",
        backgroundColor: "rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.85)",
        fontFamily: "sans-serif",
        fontSize: Math.max(18, Math.min(width, height) / 10),
        textAlign: "center",
      }}
    >
      Dépose une photo
    </div>
  );
}
