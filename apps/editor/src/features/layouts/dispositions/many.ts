import type { MediaItem } from "../content";
import {
  bestGrid,
  grid,
  inset,
  isTall,
  isWide,
  justifiedRows,
  masonry,
  polaroidInside,
  type Rect,
  rect,
  ring,
  splitLong,
  splitX,
  splitY,
  squareIn,
  strip,
} from "../fit";
import { aspects, avgAspect, bottomText, type LayoutDef, place, stacked, textPanel, texts } from "./helpers";

/** `rows` bandes horizontales égales. */
function splitRows(r: Rect, rows: number, gap: number): Rect[] {
  return grid(r, 1, rows, gap);
}

const ROTATIONS = [-7, 5, -3, 8, -6, 4, -4, 6, -8, 3];

/** Quatre photos et plus (et les dispositions qui vont de 2 à 10). */
export const MANY_LAYOUTS: LayoutDef[] = [
  {
    id: "strip",
    name: "Bande",
    minMedia: 5,
    maxMedia: 6,
    prior: 0.1,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      place(b, strip(media, b.media.length, b.gap));
      texts(b, text);
      return true;
    },
  },
  {
    id: "grid",
    name: "Grille",
    minMedia: 4,
    maxMedia: 10,
    prior: 0.15,
    build: (b) => {
      const { media, text } = bottomText(b, 0.74);
      place(b, bestGrid(media, b.media.length, b.gap, avgAspect(b.media)));
      texts(b, text);
      return true;
    },
  },
  {
    id: "justified",
    name: "Mosaïque ajustée",
    minMedia: 2,
    maxMedia: 10,
    prior: 0.25,
    build: (b) => {
      const { media, text } = bottomText(b, 0.76);
      place(b, justifiedRows(media, aspects(b), b.gap * 0.6));
      texts(b, text);
      return true;
    },
  },
  {
    id: "justified-bleed",
    name: "Mosaïque ajustée pleine page",
    minMedia: 4,
    maxMedia: 10,
    build: (b) => {
      place(b, justifiedRows(b.page, aspects(b), Math.round(b.gap * 0.3)), { bleed: true });
      if (b.hasText) textPanel(b, 0.5, 0.34);
      return true;
    },
  },
  {
    id: "grid-bleed",
    name: "Grille pleine page",
    minMedia: 4,
    maxMedia: 10,
    build: (b) => {
      const g = Math.round(b.gap * 0.4);
      place(b, bestGrid(b.page, b.media.length, g, avgAspect(b.media)), { bleed: true });
      if (b.hasText) textPanel(b, 0.5, 0.34);
      return true;
    },
  },
  {
    id: "masonry",
    name: "Colonnes",
    minMedia: 4,
    maxMedia: 10,
    build: (b) => {
      const { media, text } = bottomText(b, 0.76);
      const n = b.media.length;
      const cols = Math.max(
        2,
        Math.min(n - 1, Math.round(Math.sqrt((n * (media.width / media.height)) / avgAspect(b.media)))),
      );
      place(b, masonry(media, aspects(b), cols, b.gap * 0.6));
      texts(b, text);
      return true;
    },
  },
  {
    id: "bands",
    name: "Bandes pleine page",
    minMedia: 4,
    maxMedia: 6,
    build: (b) => {
      place(b, strip(b.page, b.media.length, Math.round(b.gap * 0.25)), { bleed: true });
      if (b.hasText) textPanel(b, 0.5, 0.34);
      return true;
    },
  },
  {
    id: "hero-thumbs",
    name: "Une grande et des vignettes",
    minMedia: 3,
    maxMedia: 10,
    build: (b) => {
      const { media, text } = b.areas(0.76);
      const [hero, thumbs] = splitLong(media, b.media.length > 6 ? 0.5 : 0.62, b.gap);
      b.addMedia(b.media[0] as MediaItem, hero);
      place(b, bestGrid(thumbs, b.media.length - 1, b.gap, avgAspect(b.media.slice(1))), {}, 1);
      texts(b, text);
      return true;
    },
  },
  {
    id: "hero-row",
    name: "Une grande et une rangée",
    minMedia: 3,
    maxMedia: 7,
    build: (b) => {
      const { media, text } = isWide(b.f) ? bottomText(b) : stacked(b);
      const [hero, row] = splitY(media, isTall(b.f) ? 0.7 : 0.64, b.gap);
      b.addMedia(b.media[0] as MediaItem, hero);
      place(b, grid(row, b.media.length - 1, 1, b.gap), {}, 1);
      texts(b, text);
      return true;
    },
  },
  {
    id: "hero-column",
    name: "Une grande et une colonne",
    minMedia: 3,
    maxMedia: 6,
    build: (b) => {
      if (!isWide(b.f)) return false;
      const { media, text } = stacked(b, 0.78);
      const [hero, col] = splitX(media, 0.7, b.gap);
      b.addMedia(b.media[0] as MediaItem, hero);
      place(b, grid(col, 1, b.media.length - 1, b.gap), {}, 1);
      texts(b, text);
      return true;
    },
  },
  {
    id: "four-corners",
    name: "Quatre coins",
    minMedia: 4,
    maxMedia: 4,
    build: (b) => {
      const cells = grid(b.safe, 2, 2, b.m * 1.2);
      place(b, cells, (i) => ({ mode: "fit", treatment: "border", rotation: [-4, 3, 3, -4][i], scale: 0.95 }));
      if (b.hasText) textPanel(b, 0.46, 0.3);
      return true;
    },
  },
  {
    id: "sandwich",
    name: "Photos en haut et en bas",
    minMedia: 4,
    maxMedia: 10,
    needsText: true,
    build: (b) => {
      const n = b.media.length;
      const top = Math.ceil(n / 2);
      const [upper, rest] = splitY(b.safe, 0.36, b.gap);
      const [middle, lower] = splitY(rest, 0.44, b.gap);
      place(b, [...grid(upper, top, 1, b.gap), ...grid(lower, n - top, 1, b.gap)]);
      b.addTexts(inset(middle, b.m, b.gap * 0.5), { maxSize: 100 });
      return true;
    },
  },
  {
    id: "ring",
    name: "Cadre de photos",
    minMedia: 8,
    maxMedia: 10,
    needsText: true,
    build: (b) => {
      const n = b.media.length;
      if (n === 9) return false;
      const [cols, rows] = n === 8 ? [3, 3] : isTall(b.f) ? [3, 4] : [4, 3];
      const { cells, center } = ring(b.safe, cols, rows, b.gap * 0.6);
      place(b, cells);
      b.addTexts(inset(center, b.gap), { maxSize: 100 });
      return true;
    },
  },
  {
    id: "collage",
    name: "Collage",
    minMedia: 3,
    maxMedia: 10,
    build: (b) => {
      const { media, text } = b.areas(0.76);
      place(b, bestGrid(media, b.media.length, -b.m * 0.25, avgAspect(b.media)), (i) => ({
        treatment: "border",
        rotation: (ROTATIONS[i] as number) * 0.5,
      }));
      texts(b, text);
      return true;
    },
  },
  {
    id: "scattered",
    name: "Polaroids éparpillés",
    minMedia: 2,
    maxMedia: 10,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      place(b, bestGrid(media, b.media.length, -b.m * 0.6, avgAspect(b.media)), (i) => ({
        treatment: "polaroid",
        rotation: ROTATIONS[i],
        scale: 0.98,
      }));
      texts(b, text);
      return true;
    },
  },
  {
    id: "contact-sheet",
    name: "Planche contact",
    minMedia: 4,
    maxMedia: 10,
    build: (b) => {
      const { media, text } = b.areas(0.78);
      b.addPanel(inset(media, -b.gap), "#111111", { radius: Math.round(8 * b.u), name: "Planche" });
      place(b, bestGrid(inset(media, b.gap * 0.5), b.media.length, b.gap * 1.2, avgAspect(b.media)), {
        mode: "fit",
        treatment: "border",
        scale: 0.94,
      });
      texts(b, text);
      return true;
    },
  },
  {
    id: "film",
    name: "Pellicule",
    minMedia: 2,
    maxMedia: 6,
    build: (b) => {
      const n = b.media.length;
      if (!isWide(b.f) && n > 4) return false;
      const { media, text } = stacked(b, 0.68);
      const hole = Math.round(18 * b.u);
      const band = rect(0, media.y, b.f.width, media.height);
      b.addPanel(band, "#111111", { radius: 0, name: "Pellicule" });
      for (const y of [band.y + hole * 1.4, band.y + band.height - hole * 2.4]) {
        b.addPanel(rect(hole, y, b.f.width - hole * 2, hole), "#f4f1ea", {
          shape: "line",
          outline: hole,
          dotted: true,
          name: "Perforations",
        });
      }
      const inner = rect(b.m, band.y + hole * 4.2, b.f.width - b.m * 2, band.height - hole * 8.4);
      place(b, strip(inner, n, b.gap * 0.6), { treatment: "plain" });
      texts(b, text, { maxSize: 96 });
      return true;
    },
  },
  {
    id: "clothesline",
    name: "Corde à linge",
    minMedia: 2,
    maxMedia: 6,
    build: (b) => {
      const n = b.media.length;
      const { media, text } = stacked(b, 0.74);
      // Une corde (paysage, ou peu de photos), sinon deux cordes l'une sous l'autre.
      const rows = !isWide(b.f) && n >= 3 ? 2 : 1;
      if (rows === 1 && n > 4 && !isWide(b.f)) return false;
      const pin = 34 * b.u;
      const perRow = Math.ceil(n / rows);
      splitRows(media, rows, b.gap).forEach((band, r) => {
        const items = b.media.slice(r * perRow, (r + 1) * perRow);
        const lineY = band.y + band.height * 0.06;
        b.addPanel(rect(0, lineY, b.f.width, 4 * b.u), b.theme.colors.accent, { radius: 0, name: "Corde" });
        const cells = grid(
          rect(band.x, lineY + pin * 0.5, band.width, band.height * 0.94 - pin * 0.5),
          items.length,
          1,
          b.gap,
        );
        cells.forEach((cell, i) => {
          const item = items[i] as MediaItem;
          // La carte pend sous la corde (collée en haut de sa case).
          const card = polaroidInside(cell, item.aspect, 0.92);
          b.addMedia(item, rect(card.x, cell.y, card.width, card.height), {
            treatment: "polaroid",
            rotation: (r * perRow + i) % 2 ? 3 : -3,
          });
          // La pince, à cheval sur la corde.
          b.addPanel(rect(card.x + card.width / 2 - pin / 4, lineY - pin * 0.35, pin / 2, pin), b.theme.colors.accent, {
            radius: Math.round(5 * b.u),
            name: "Pince",
          });
        });
      });
      texts(b, text);
      return true;
    },
  },
  {
    id: "circles-grid",
    name: "Médaillons",
    minMedia: 3,
    maxMedia: 10,
    prior: -0.1,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      place(
        b,
        bestGrid(media, b.media.length, b.gap, 1).map((c) => squareIn(c, 0.94)),
        { treatment: "circle" },
      );
      texts(b, text);
      return true;
    },
  },
  {
    id: "hex-grid",
    name: "Alvéoles",
    minMedia: 3,
    maxMedia: 10,
    prior: -0.2,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      place(
        b,
        bestGrid(media, b.media.length, b.gap * 0.3, 1).map((c) => squareIn(c, 0.98)),
        { treatment: "hexagon" },
      );
      texts(b, text);
      return true;
    },
  },
  {
    id: "stamps",
    name: "Timbres",
    minMedia: 2,
    maxMedia: 8,
    prior: -0.3,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      place(
        b,
        bestGrid(media, b.media.length, b.gap, 0.85).map((c): Rect => squareIn(c, 0.9)),
        (i) => ({ treatment: "stamp", rotation: (ROTATIONS[i] as number) * 0.4 }),
      );
      texts(b, text);
      return true;
    },
  },
];
