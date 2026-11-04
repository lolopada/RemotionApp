import type { PageBuilder } from "./builder";
import type { MediaItem } from "./content";
import { bestGrid, fitInside, inset, type Rect, rect, splitLong, strip } from "./fit";

/**
 * Bibliothèque des dispositions. Chacune dit combien de photos/vidéos elle accepte et pose
 * les éléments avec le `PageBuilder` (qui gère thème, habillage, animations et note).
 * `build` renvoie false si la disposition ne convient pas au contenu.
 * Ajouter une disposition = ajouter une entrée ici (le moteur la propose automatiquement).
 */
export interface LayoutDef {
  id: string;
  name: string;
  minMedia: number;
  maxMedia: number;
  /** Faut-il au moins un texte ? */
  needsText?: boolean;
  /** Bonus de départ (préférence à note égale). */
  prior?: number;
  build: (b: PageBuilder) => boolean | undefined;
}

const avgAspect = (media: MediaItem[]) =>
  media.length ? Math.exp(media.reduce((a, m) => a + Math.log(m.aspect), 0) / media.length) : 1;

/** Panneau de couleur centré derrière les textes, posé par-dessus des photos. */
function textPanel(b: PageBuilder, width = 0.62, height = 0.42) {
  const { f, theme } = b;
  const w = f.width * (f.width >= f.height ? width : 0.84);
  const h = f.height * (f.width >= f.height ? height : 0.3);
  const panel = rect((f.width - w) / 2, (f.height - h) / 2, w, h);
  b.addPanel(panel, theme.colors.background, { opacity: 0.88 });
  b.addTexts(inset(panel, b.m * 0.7, b.m * 0.5), { maxSize: 96 });
}

export const LAYOUTS: LayoutDef[] = [
  // ------------------------------------------------------------ Textes seuls
  {
    id: "text-center",
    name: "Titre centré",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    prior: 0.3,
    build: (b) => {
      const zone = inset(b.page, b.m * 2.2, b.m * 2);
      const used = b.addTexts(zone, { maxSize: 130 });
      if (used) {
        const w = Math.min(zone.width * 0.16, 220 * b.u);
        b.addAccentBar(rect(b.f.width / 2 - w / 2, used.y + used.height + b.gap * 1.4, w, 8 * b.u));
      }
      return true;
    },
  },
  {
    id: "text-left-bar",
    name: "Colonne avec trait",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const zone = inset(b.page, b.m * 2.4, b.m * 2);
      const used = b.addTexts(rect(zone.x + 30 * b.u, zone.y, zone.width * 0.8, zone.height), {
        align: "left",
        maxSize: 120,
      });
      if (used) b.addAccentBar(rect(zone.x, used.y, 10 * b.u, used.height));
      return true;
    },
  },
  {
    id: "text-big-bottom",
    name: "Grand titre en bas",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const s = Math.min(b.f.width, b.f.height) * 0.9;
      b.addPanel(rect(b.f.width - s * 0.62, -s * 0.38, s, s), b.theme.colors.accent, {
        shape: "circle",
        opacity: 0.25,
        name: "Décor (déborde)",
      });
      b.addTexts(rect(b.m * 2, b.f.height * 0.38, b.f.width - b.m * 4, b.f.height * 0.62 - b.m * 2), {
        align: "left",
        valign: "bottom",
        maxSize: 160,
      });
      return true;
    },
  },
  {
    id: "text-card",
    name: "Carte",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const card = inset(b.page, b.m * 2.5, b.m * 2.2);
      b.addPanel(card, b.theme.colors.background2, { opacity: 0.45, radius: Math.round(36 * b.u) });
      b.addTexts(inset(card, b.m * 1.2), { maxSize: 110 });
      return true;
    },
  },

  // ------------------------------------------------------------ Une photo
  {
    id: "bleed-bottom",
    name: "Pleine page, titre en bas",
    minMedia: 1,
    maxMedia: 1,
    prior: 0.4,
    build: (b) => {
      const [item] = b.media as [MediaItem];
      b.addMedia(item, b.page, { bleed: true });
      if (b.hasText) {
        b.addScrim(rect(0, b.f.height * 0.45, b.f.width, b.f.height * 0.55));
        const wide = b.f.width >= b.f.height;
        b.addTexts(
          rect(b.m * 1.5, b.f.height * 0.55, b.f.width * (wide ? 0.7 : 1) - b.m * 3, b.f.height * 0.45 - b.m * 1.5),
          {
            align: wide ? "left" : "center",
            valign: "bottom",
            onPhoto: true,
            maxSize: 110,
          },
        );
      }
      return true;
    },
  },
  {
    id: "bleed-panel",
    name: "Pleine page, encart",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    build: (b) => {
      b.addMedia(b.media[0] as MediaItem, b.page, { bleed: true });
      textPanel(b, 0.56, 0.38);
      return true;
    },
  },
  {
    id: "photo-background",
    name: "Photo en fond",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    build: (b) => {
      const item = b.media[0] as MediaItem;
      if (item.kind !== "image") return false;
      b.background = {
        type: "image",
        src: item.src,
        blur: 0,
        veil: { enabled: true, color: "#000000", opacity: 0.45, mode: "solid" },
        motion: { enabled: true },
      };
      b.penalty += Math.abs(Math.log(item.aspect / (b.f.width / b.f.height))) * 1.6;
      b.addTexts(inset(b.page, b.m * 2.5, b.m * 2), { onPhoto: true, maxSize: 130 });
      return true;
    },
  },
  {
    id: "half",
    name: "Moitié photo, moitié texte",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    prior: 0.2,
    build: (b) => {
      const [media, text] = splitLong(b.page, 0.55);
      b.addMedia(b.media[0] as MediaItem, media, { bleed: true });
      b.addTexts(inset(text, b.m * 1.3), { align: b.f.width >= b.f.height ? "left" : "center", maxSize: 100 });
      return true;
    },
  },
  {
    id: "framed",
    name: "Photo encadrée",
    minMedia: 1,
    maxMedia: 1,
    prior: 0.1,
    build: (b) => {
      const { media, text } = b.areas(0.74, b.f.width >= b.f.height && b.texts.length > 1 ? "side" : "bottom");
      b.addMedia(b.media[0] as MediaItem, media, { mode: "fit" });
      if (text) b.addTexts(text, { align: text.width < b.f.width * 0.5 ? "left" : "center" });
      return true;
    },
  },
  {
    id: "polaroid-single",
    name: "Polaroid",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { media, text } = b.areas(0.62, "side");
      b.addMedia(b.media[0] as MediaItem, media, { treatment: "polaroid", rotation: -4, scale: 0.92 });
      if (text) b.addTexts(text, { align: text.width < b.f.width * 0.5 ? "left" : "center", maxSize: 96 });
      return true;
    },
  },
  {
    id: "circle",
    name: "Médaillon rond",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { media, text } = b.areas(0.6, "side");
      const s = Math.min(media.width, media.height) * 0.92;
      const slot = rect(media.x + (media.width - s) / 2, media.y + (media.height - s) / 2, s, s);
      b.addPanel(inset(slot, -s * 0.04), b.theme.colors.accent, { shape: "circle", name: "Anneau" });
      b.addMedia(b.media[0] as MediaItem, slot, { treatment: "circle" });
      if (text) b.addTexts(text, { align: text.width < b.f.width * 0.5 ? "left" : "center", maxSize: 96 });
      return true;
    },
  },
  {
    id: "arch",
    name: "Arche",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { media, text } = b.areas(0.58, "side");
      b.addMedia(b.media[0] as MediaItem, fitInside(media, 0.78, 0.96), { treatment: "arch" });
      if (text) b.addTexts(text, { align: text.width < b.f.width * 0.5 ? "left" : "center", maxSize: 96 });
      return true;
    },
  },

  // ------------------------------------------------------------ Deux photos et plus
  {
    id: "big-small",
    name: "Grande et médaillon",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { media, text } = b.areas(0.76);
      const [big, rest] = splitLong(media, 0.68, b.gap);
      b.addMedia(b.media[0] as MediaItem, big);
      b.addMedia(b.media[1] as MediaItem, rest, { mode: "fit", treatment: "border", scale: 0.86, rotation: 3 });
      if (text) b.addTexts(text);
      return true;
    },
  },
  {
    id: "one-plus-two",
    name: "Une grande, deux petites",
    minMedia: 3,
    maxMedia: 3,
    prior: 0.2,
    build: (b) => {
      const { media, text } = b.areas(0.76, "side");
      const [big, rest] = splitLong(media, 0.58, b.gap);
      const [a, c] = splitLong(rest, 0.5, b.gap);
      b.addMedia(b.media[0] as MediaItem, big);
      b.addMedia(b.media[1] as MediaItem, a);
      b.addMedia(b.media[2] as MediaItem, c);
      if (text) b.addTexts(text, { align: text.width < b.f.width * 0.5 ? "left" : "center" });
      return true;
    },
  },
  {
    id: "mosaic-bleed",
    name: "Mosaïque pleine page",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      const g = Math.round(b.gap * 0.4);
      const [big, rest] = splitLong(b.page, 0.6, g);
      const [a, c] = splitLong(rest, 0.5, g);
      b.addMedia(b.media[0] as MediaItem, big, { bleed: true });
      b.addMedia(b.media[1] as MediaItem, a, { bleed: true });
      b.addMedia(b.media[2] as MediaItem, c, { bleed: true });
      if (b.hasText) textPanel(b, 0.5, 0.34);
      return true;
    },
  },
  {
    id: "fan",
    name: "Polaroids en éventail",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      const cells = strip(media, 3, -b.m);
      [-8, 0, 8].forEach((rot, i) => {
        b.addMedia(b.media[i] as MediaItem, cells[i] as Rect, { treatment: "polaroid", rotation: rot, scale: 0.95 });
      });
      if (text) b.addTexts(text);
      return true;
    },
  },
  {
    id: "strip",
    name: "Bande",
    minMedia: 2,
    maxMedia: 5,
    prior: 0.1,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      strip(media, b.media.length, b.gap).forEach((cell, i) => {
        b.addMedia(b.media[i] as MediaItem, cell);
      });
      if (text) b.addTexts(text);
      return true;
    },
  },
  {
    id: "grid",
    name: "Grille",
    minMedia: 2,
    maxMedia: 6,
    prior: 0.15,
    build: (b) => {
      const { media, text } = b.areas(0.74, b.texts.length > 1 ? "side" : "bottom");
      bestGrid(media, b.media.length, b.gap, avgAspect(b.media)).forEach((cell, i) => {
        b.addMedia(b.media[i] as MediaItem, cell);
      });
      if (text) b.addTexts(text, { align: text.width < b.f.width * 0.5 ? "left" : "center" });
      return true;
    },
  },
  {
    id: "grid-bleed",
    name: "Grille pleine page",
    minMedia: 2,
    maxMedia: 6,
    build: (b) => {
      const g = Math.round(b.gap * 0.4);
      bestGrid(b.page, b.media.length, g, avgAspect(b.media)).forEach((cell, i) => {
        b.addMedia(b.media[i] as MediaItem, cell, { bleed: true });
      });
      if (b.hasText) textPanel(b, 0.5, 0.34);
      return true;
    },
  },
  {
    id: "hero-thumbs",
    name: "Une grande et des vignettes",
    minMedia: 3,
    maxMedia: 6,
    build: (b) => {
      const { media, text } = b.areas(0.76);
      const [hero, thumbs] = splitLong(media, 0.62, b.gap);
      b.addMedia(b.media[0] as MediaItem, hero);
      bestGrid(thumbs, b.media.length - 1, b.gap, avgAspect(b.media.slice(1))).forEach((cell, i) => {
        b.addMedia(b.media[i + 1] as MediaItem, cell);
      });
      if (text) b.addTexts(text);
      return true;
    },
  },
  {
    id: "scattered",
    name: "Polaroids éparpillés",
    minMedia: 2,
    maxMedia: 6,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      const rotations = [-7, 5, -3, 8, -6, 4];
      bestGrid(media, b.media.length, -b.m * 0.6, avgAspect(b.media)).forEach((cell, i) => {
        b.addMedia(b.media[i] as MediaItem, cell, {
          treatment: "polaroid",
          rotation: rotations[i % rotations.length],
          scale: 0.98,
        });
      });
      if (text) b.addTexts(text);
      return true;
    },
  },
];
