/**
 * Qualité d'export : la vidéo est agrandie ou réduite pour tenir dans le cadre de la
 * résolution choisie (ex. 4K = 3840×2160, dans un sens ou dans l'autre), sans changer son format.
 */
export const EXPORT_QUALITIES = [
  { id: "720p", label: "720p", short: 720, long: 1280 },
  { id: "1080p", label: "1080p (Full HD)", short: 1080, long: 1920 },
  { id: "4k", label: "4K", short: 2160, long: 3840 },
] as const;
export type ExportQuality = (typeof EXPORT_QUALITIES)[number]["id"];

/** Facteur d'échelle de l'export pour un projet de taille `width`×`height`. */
export function exportScale(width: number, height: number, quality: ExportQuality): number {
  const q = EXPORT_QUALITIES.find((x) => x.id === quality) ?? EXPORT_QUALITIES[1];
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  return Math.min(q.short / short, q.long / long);
}

/** Taille réelle de la vidéo exportée (paire, comme l'exige l'encodeur). */
export function exportSize(width: number, height: number, quality: ExportQuality) {
  const s = exportScale(width, height, quality);
  const even = (n: number) => 2 * Math.floor(Math.round(n * s) / 2);
  return { width: even(width), height: even(height) };
}
