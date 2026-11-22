import type { MediaOptions, PageBuilder, TextOptions } from "../builder";
import type { MediaItem } from "../content";
import { inset, isWide, type Rect, rect, splitY } from "../fit";

/**
 * Une disposition dit combien de photos/vidéos elle accepte et pose les éléments avec le
 * `PageBuilder` (qui gère thème, habillage, animations et note).
 * `build` renvoie false si la disposition ne convient pas au contenu (ou au format).
 */
export interface LayoutDef {
  id: string;
  name: string;
  minMedia: number;
  maxMedia: number;
  /** Faut-il au moins un texte ? */
  needsText?: boolean;
  /** Bonus de départ (préférence à note égale ; négatif pour les dispositions « fantaisie »). */
  prior?: number;
  build: (b: PageBuilder) => boolean | undefined;
}

/** Ratio moyen (géométrique) des photos. */
export const avgAspect = (media: MediaItem[]) =>
  media.length ? Math.exp(media.reduce((a, m) => a + Math.log(m.aspect), 0) / media.length) : 1;

export const aspects = (b: PageBuilder, from = 0) => b.media.slice(from).map((m) => m.aspect);

/** Aligné à gauche dans une colonne étroite, centré sinon. */
export const alignFor = (b: PageBuilder, zone: Rect) => (zone.width < b.f.width * 0.5 ? "left" : "center");

/** Textes dans la zone, alignés selon sa largeur. */
export function texts(b: PageBuilder, zone: Rect | null, opts: TextOptions = {}) {
  if (!zone) return null;
  return b.addTexts(zone, { align: alignFor(b, zone), ...opts });
}

/** Pose les photos `from…` dans les cases, dans l'ordre. */
export function place(
  b: PageBuilder,
  cells: Rect[],
  opts: MediaOptions | ((i: number) => MediaOptions) = {},
  from = 0,
) {
  cells.forEach((cell, i) => {
    const item = b.media[i + from];
    if (item) b.addMedia(item, cell, typeof opts === "function" ? opts(i) : opts);
  });
}

/** Panneau de couleur centré derrière les textes, posé par-dessus des photos. */
export function textPanel(b: PageBuilder, width = 0.62, height = 0.42) {
  const { f, theme } = b;
  const w = f.width * (f.width >= f.height ? width : 0.84);
  const h = f.height * (f.width >= f.height ? height : 0.3);
  const panel = rect((f.width - w) / 2, (f.height - h) / 2, w, h);
  b.addPanel(panel, theme.colors.background, { opacity: 0.88 });
  b.addTexts(inset(panel, b.m * 0.7, b.m * 0.5), { maxSize: 96 });
}

/**
 * Titre dans une zone, sous-titre et texte dans une autre. S'il n'y a que l'un des deux
 * groupes, il va dans la zone principale.
 */
export function titleAndRest(b: PageBuilder, main: Rect, other: Rect, titleOpts: TextOptions, restOpts: TextOptions) {
  const hasTitle = b.pickTexts("title").length > 0;
  const hasRest = b.pickTexts("rest").length > 0;
  if (hasTitle && hasRest) {
    b.addTexts(main, { ...titleOpts, pick: "title" });
    b.addTexts(other, { ...restOpts, pick: "rest" });
  } else {
    b.addTexts(main, titleOpts);
  }
}

/** Bandeau de texte en bas (ou à côté en paysage, s'il y a plusieurs textes et peu de photos). */
export function bottomText(b: PageBuilder, share = 0.76) {
  return b.areas(share, b.texts.length > 1 && b.media.length <= 4 && isWide(b.f) ? "side" : "bottom");
}

/** Haut / bas forcés (même en paysage). */
export function stacked(b: PageBuilder, share = 0.74) {
  if (!b.hasText) return { media: b.safe, text: null };
  const [media, text] = splitY(b.safe, share, b.gap * 2);
  return { media, text };
}
