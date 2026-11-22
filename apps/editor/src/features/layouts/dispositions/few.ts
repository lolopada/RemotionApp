import type { MediaItem } from "../content";
import { cascade, fitInside, inset, isWide, type Rect, rect, splitLong, splitX, splitY, squareIn, strip } from "../fit";
import { aspects, bottomText, type LayoutDef, place, stacked, textPanel, texts } from "./helpers";

const nth = (b: { media: MediaItem[] }, i: number) => b.media[i] as MediaItem;

/** Deux ou trois photos. */
export const FEW_LAYOUTS: LayoutDef[] = [
  // ------------------------------------------------------------ Deux photos
  {
    id: "big-small",
    name: "Grande et médaillon",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { media, text } = b.areas(0.76);
      const [big, rest] = splitLong(media, 0.68, b.gap);
      b.addMedia(nth(b, 0), big);
      b.addMedia(nth(b, 1), rest, { mode: "fit", treatment: "border", scale: 0.86, rotation: 3 });
      texts(b, text);
      return true;
    },
  },
  {
    id: "duo-bleed",
    name: "Deux moitiés",
    minMedia: 2,
    maxMedia: 2,
    prior: 0.15,
    build: (b) => {
      const g = Math.round(b.gap * 0.3);
      place(b, strip(b.page, 2, g), { bleed: true });
      if (b.hasText) textPanel(b, 0.5, 0.34);
      return true;
    },
  },
  {
    id: "duo-divider",
    name: "Avant / après",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const cells = strip(b.page, 2, 0);
      place(b, cells, { bleed: true });
      const t = 8 * b.u;
      b.addPanel(
        isWide(b.f) ? rect(b.f.width / 2 - t / 2, 0, t, b.f.height) : rect(0, b.f.height / 2 - t / 2, b.f.width, t),
        b.theme.colors.accent,
        { radius: 0, name: "Séparation" },
      );
      if (b.hasText) {
        // Encart en bas, par-dessus le trait de séparation.
        const w = b.f.width * (isWide(b.f) ? 0.5 : 0.8);
        const h = b.f.height * (isWide(b.f) ? 0.26 : 0.2);
        const panel = rect((b.f.width - w) / 2, b.f.height - b.m - h, w, h);
        b.addPanel(panel, b.theme.colors.background, { opacity: 0.9 });
        b.addTexts(inset(panel, b.m * 0.6, b.m * 0.4), { maxSize: 90 });
      }
      return true;
    },
  },
  {
    id: "duo-offset",
    name: "Deux photos décalées",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { media, text } = b.areas(0.76);
      const w = media.width * 0.6;
      const h = media.height * 0.72;
      b.addMedia(nth(b, 0), rect(media.x, media.y, w, h), { treatment: "border" });
      b.addMedia(nth(b, 1), rect(media.x + media.width - w, media.y + media.height - h, w, h), {
        treatment: "border",
      });
      texts(b, text);
      return true;
    },
  },
  {
    id: "duo-polaroids",
    name: "Deux polaroids",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { media, text } = b.areas(0.74);
      place(b, strip(media, 2, -b.m * 0.8), (i) => ({ treatment: "polaroid", rotation: i ? 5 : -6, scale: 0.94 }));
      texts(b, text);
      return true;
    },
  },
  {
    id: "duo-circles",
    name: "Deux médaillons",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { media, text } = b.areas(0.7);
      strip(media, 2, b.gap * 2).forEach((cell, i) => {
        const slot = squareIn(cell, 0.9);
        b.addPanel(inset(slot, -slot.width * 0.035), b.theme.colors.accent, { shape: "circle", name: "Anneau" });
        b.addMedia(nth(b, i), slot, { treatment: "circle" });
      });
      texts(b, text);
      return true;
    },
  },
  {
    id: "duo-arches",
    name: "Deux arches",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { media, text } = b.areas(0.72);
      place(
        b,
        strip(media, 2, b.gap * 2).map((c) => fitInside(c, 0.74, 0.96)),
        { treatment: "arch" },
      );
      texts(b, text);
      return true;
    },
  },
  {
    id: "duo-inset",
    name: "Photo dans la photo",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      b.addMedia(nth(b, 0), b.page, { bleed: true });
      const small = Math.min(b.f.width, b.f.height) * 0.38;
      const box = fitInside(rect(b.f.width - b.m - small * 1.3, b.m, small * 1.3, small * 1.3), nth(b, 1).aspect, 1);
      b.addMedia(nth(b, 1), box, { mode: "fit", treatment: "border", rotation: 4 });
      if (b.hasText) {
        b.addScrim(rect(0, b.f.height * 0.5, b.f.width, b.f.height * 0.5));
        b.addTexts(
          rect(
            b.m * 1.5,
            b.f.height * 0.58,
            b.f.width * (isWide(b.f) ? 0.62 : 1) - b.m * 3,
            b.f.height * 0.42 - b.m * 1.3,
          ),
          {
            align: isWide(b.f) ? "left" : "center",
            valign: "bottom",
            onPhoto: true,
            maxSize: 100,
          },
        );
      }
      return true;
    },
  },
  {
    id: "duo-across",
    name: "L'une au-dessus de l'autre",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      // Sens contraire de la bande : l'une sous l'autre en paysage, côte à côte en portrait.
      const { media, text } = b.areas(0.66, "side");
      const cells = isWide(b.f) ? [...splitY(media, 0.5, b.gap)] : [...splitX(media, 0.5, b.gap)];
      place(b, cells);
      texts(b, text);
      return true;
    },
  },

  // ------------------------------------------------------------ Trois photos
  {
    id: "one-plus-two",
    name: "Une grande, deux petites",
    minMedia: 3,
    maxMedia: 3,
    prior: 0.2,
    build: (b) => {
      const { media, text } = bottomText(b);
      const [big, rest] = splitLong(media, 0.58, b.gap);
      place(b, [big, ...splitLong(rest, 0.5, b.gap)]);
      texts(b, text);
      return true;
    },
  },
  {
    id: "two-plus-one",
    name: "Deux petites, une grande",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      const { media, text } = bottomText(b);
      const [rest, big] = splitLong(media, 0.42, b.gap);
      place(b, [big, ...splitLong(rest, 0.5, b.gap)]);
      texts(b, text);
      return true;
    },
  },
  {
    id: "top-and-two",
    name: "Une en haut, deux en bas",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      const { media, text } = isWide(b.f) ? bottomText(b) : stacked(b);
      const [top, bottom] = splitY(media, 0.58, b.gap);
      place(b, [top, ...splitX(bottom, 0.5, b.gap)]);
      texts(b, text);
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
      place(b, [big, ...splitLong(rest, 0.5, g)], { bleed: true });
      if (b.hasText) textPanel(b, 0.5, 0.34);
      return true;
    },
  },
  {
    id: "trio-columns",
    name: "Trois bandes",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      place(b, strip(b.page, 3, Math.round(b.gap * 0.3)), { bleed: true });
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
      place(b, strip(media, 3, -b.m), (i) => ({ treatment: "polaroid", rotation: [-8, 0, 8][i], scale: 0.95 }));
      texts(b, text);
      return true;
    },
  },
  {
    id: "trio-arches",
    name: "Trois arches",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      const { media, text } = b.areas(0.72);
      place(
        b,
        strip(media, 3, b.gap * 1.5).map((c) => fitInside(c, 0.72, 0.96)),
        { treatment: "arch" },
      );
      texts(b, text);
      return true;
    },
  },
  {
    id: "trio-circles",
    name: "Trois médaillons",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      const { media, text } = b.areas(0.7);
      strip(media, 3, b.gap).forEach((cell, i) => {
        // Celui du milieu est plus grand.
        const slot = squareIn(cell, i === 1 ? 1 : 0.62);
        b.addMedia(nth(b, i === 1 ? 0 : i === 0 ? 1 : 2), slot, { treatment: "circle" });
      });
      texts(b, text);
      return true;
    },
  },
  {
    id: "stagger",
    name: "En escalier",
    minMedia: 3,
    maxMedia: 4,
    build: (b) => {
      const { media, text } = b.areas(0.76);
      const n = b.media.length;
      const wide = media.width >= media.height;
      const cells = strip(media, n, b.gap).map((c, i): Rect => {
        // Chaque case est plus courte et décalée un peu plus loin que la précédente.
        const t = n === 1 ? 0 : i / (n - 1);
        return wide
          ? rect(c.x, c.y + c.height * 0.25 * t, c.width, c.height * 0.75)
          : rect(c.x + c.width * 0.25 * t, c.y, c.width * 0.75, c.height);
      });
      place(b, cells);
      texts(b, text);
      return true;
    },
  },
  {
    id: "cascade",
    name: "Cascade",
    minMedia: 3,
    maxMedia: 6,
    build: (b) => {
      const { media, text } = bottomText(b, 0.76);
      const n = b.media.length;
      const size = n <= 3 ? 0.7 : n <= 4 ? 0.62 : 0.55;
      // Compromis entre le format de la zone et celui des photos (peu de place perdue, peu rogné).
      const box = fitInside(media, Math.sqrt(avg(aspects(b)) * (media.width / media.height)), 1);
      place(b, cascade(box, n, size), { treatment: "border" });
      texts(b, text);
      return true;
    },
  },
];

function avg(values: number[]) {
  return Math.exp(values.reduce((a, v) => a + Math.log(v), 0) / Math.max(1, values.length));
}
