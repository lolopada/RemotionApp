import type { Mask } from "@app/schema";
import type { CSSProperties } from "react";
import { shapePath } from "./shapes";

/**
 * Transforme un masque du schéma en style CSS.
 *
 * Contraintes du rendu navigateur de Remotion (@remotion/web-renderer) :
 *  - clip-path : polygon/path/circle/ellipse/inset OK, pas d'url(#svg)
 *  - mask-image : dégradé linéaire OU une image raster (data:/blob:) en 100% 100%
 * Le bord flou (feather) passe donc par une image de masque générée sur canvas,
 * ce qui marche à l'identique dans l'aperçu et à l'export.
 */
export function getMaskStyle(mask: Mask, width: number, height: number): CSSProperties {
  if (mask.shape === "none") return {};

  if (mask.feather <= 0) {
    switch (mask.shape) {
      case "rect":
        return { overflow: "hidden" };
      case "rounded":
        return { overflow: "hidden", borderRadius: mask.radius };
      case "circle":
        return { overflow: "hidden", borderRadius: "50%" };
      default:
        return { clipPath: `path('${shapePath(mask.shape, width, height)}')` };
    }
  }

  const url = getFeatheredMaskUrl(mask, width, height);
  if (!url) return { overflow: "hidden" };
  return {
    maskImage: `url(${url})`,
    maskSize: "100% 100%",
    maskPosition: "0% 0%",
    maskRepeat: "no-repeat",
    WebkitMaskImage: `url(${url})`,
    WebkitMaskSize: "100% 100%",
    WebkitMaskPosition: "0% 0%",
    WebkitMaskRepeat: "no-repeat",
  };
}

/** Taille max du canvas de masque : il est étiré, inutile de le faire en 4K. */
const MAX_MASK_SIZE = 512;
const cache = new Map<string, string>();

function getFeatheredMaskUrl(mask: Mask, width: number, height: number): string | null {
  if (typeof document === "undefined") return null;
  const key = `${mask.shape}|${Math.round(width)}|${Math.round(height)}|${mask.radius}|${mask.feather}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const scale = Math.min(1, MAX_MASK_SIZE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const blur = mask.feather * scale;
  // On rentre la forme pour que le dégradé finisse à 0 au bord du calque.
  const inset = Math.min(blur * 0.8, w / 4, h / 4);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const iw = w - inset * 2;
  const ih = h - inset * 2;
  const d = shapePath(mask.shape, iw, ih, { radius: mask.radius * scale, x: inset, y: inset });

  // Astuce compatible Safari (pas de ctx.filter) : on dessine la forme hors
  // champ et on ne garde que son ombre floutée, décalée pile au bon endroit.
  const offset = w + h + blur * 4;
  ctx.shadowColor = "#000";
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offset;
  ctx.translate(-offset, 0);
  ctx.fill(new Path2D(d));

  const url = canvas.toDataURL("image/png");
  cache.set(key, url);
  return url;
}
