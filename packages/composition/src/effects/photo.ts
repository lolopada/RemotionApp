import type { ImageLayer } from "@app/schema";

/**
 * Géométrie et filtres d'une photo, partagés par le rendu (composition)
 * et par l'éditeur (recadrage à la souris).
 */

export type FilterPreset = ImageLayer["filter"]["preset"];

/** Filtres prédéfinis, en fonctions CSS (filter) — exportées sauf sous Safari. */
export const FILTER_PRESETS: Record<FilterPreset, { label: string; css: string }> = {
  none: { label: "Original", css: "" },
  bw: { label: "N&B", css: "grayscale(1) contrast(1.08)" },
  sepia: { label: "Sépia", css: "sepia(0.85) contrast(1.02)" },
  vintage: { label: "Vintage", css: "sepia(0.35) saturate(1.25) contrast(0.92) brightness(1.06) hue-rotate(-8deg)" },
  warm: { label: "Chaud", css: "sepia(0.22) saturate(1.35) hue-rotate(-12deg) brightness(1.03)" },
  cool: { label: "Froid", css: "sepia(0.25) hue-rotate(170deg) saturate(1.15) brightness(1.02)" },
  vivid: { label: "Éclatant", css: "saturate(1.6) contrast(1.12)" },
  fade: { label: "Délavé", css: "saturate(0.7) contrast(0.85) brightness(1.1)" },
};

export function photoFilterCss(filter: ImageLayer["filter"]): string | undefined {
  const parts = [FILTER_PRESETS[filter.preset].css];
  if (filter.brightness !== 1) parts.push(`brightness(${filter.brightness})`);
  if (filter.contrast !== 1) parts.push(`contrast(${filter.contrast})`);
  if (filter.saturation !== 1) parts.push(`saturate(${filter.saturation})`);
  if (filter.blur > 0) parts.push(`blur(${filter.blur}px)`);
  const css = parts.filter(Boolean).join(" ");
  return css || undefined;
}

/** Zone de la photo dans le calque (plus petite que le calque en mode polaroid). */
export function photoArea(layer: ImageLayer): { x: number; y: number; width: number; height: number } {
  const { width, height } = layer.transform;
  if (layer.frame !== "polaroid") return { x: 0, y: 0, width, height };
  const m = Math.round(Math.min(width, height) * 0.06);
  const bottom = Math.round(height * 0.2);
  return { x: m, y: m, width: Math.max(1, width - 2 * m), height: Math.max(1, height - m - bottom) };
}

/**
 * Taille et position de l'image (avant zoom et décalage) dans sa zone.
 * Quand le ratio de l'image est connu, elle déborde du cadre en « cover » :
 * on peut alors la faire glisser pour choisir la partie visible.
 */
export function imageBox(layer: ImageLayer, areaW: number, areaH: number) {
  const aspect = layer.imageAspect;
  if (!aspect) return { left: 0, top: 0, width: areaW, height: areaH, objectFit: layer.fit };
  const wider = aspect > areaW / areaH;
  const fitHeight = layer.fit === "cover" ? wider : !wider;
  const width = fitHeight ? areaH * aspect : areaW;
  const height = fitHeight ? areaH : areaW / aspect;
  return { left: (areaW - width) / 2, top: (areaH - height) / 2, width, height, objectFit: "fill" as const };
}

/**
 * Décalage maximal (en fraction de la zone) pour que l'image couvre toujours
 * le cadre, à un zoom donné. Sert à borner le glisser du recadrage.
 */
export function maxOffset(layer: ImageLayer, areaW: number, areaH: number, zoom: number) {
  const box = imageBox(layer, areaW, areaH);
  return {
    x: Math.max(0, (box.width * zoom - areaW) / 2 / areaW),
    y: Math.max(0, (box.height * zoom - areaH) / 2 / areaH),
  };
}
