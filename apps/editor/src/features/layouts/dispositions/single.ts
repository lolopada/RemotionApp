import type { Treatment } from "../builder";
import type { MediaItem } from "../content";
import { fitInside, inset, isWide, rect, splitLong, splitX, splitY, squareIn } from "../fit";
import { type LayoutDef, textPanel, texts, titleAndRest } from "./helpers";

const first = (b: { media: MediaItem[] }) => b.media[0] as MediaItem;

/** Photo dans une forme (cœur, hexagone…), texte à côté ou dessous. */
function shaped(id: string, name: string, shape: Treatment, prior = -0.25): LayoutDef {
  return {
    id,
    name,
    minMedia: 1,
    maxMedia: 1,
    prior,
    build: (b) => {
      const { media, text } = b.areas(0.6, "side");
      b.addMedia(first(b), squareIn(media, 0.94), { treatment: shape });
      texts(b, text, { maxSize: 96 });
      return true;
    },
  };
}

/** Une seule photo ou vidéo. */
export const SINGLE_LAYOUTS: LayoutDef[] = [
  {
    id: "bleed-bottom",
    name: "Pleine page, titre en bas",
    minMedia: 1,
    maxMedia: 1,
    prior: 0.4,
    build: (b) => {
      b.addMedia(first(b), b.page, { bleed: true });
      if (b.hasText) {
        b.addScrim(rect(0, b.f.height * 0.45, b.f.width, b.f.height * 0.55));
        const wide = b.f.width >= b.f.height;
        b.addTexts(
          rect(b.m * 1.5, b.f.height * 0.55, b.f.width * (wide ? 0.7 : 1) - b.m * 3, b.f.height * 0.45 - b.m * 1.5),
          { align: wide ? "left" : "center", valign: "bottom", onPhoto: true, maxSize: 110 },
        );
      }
      return true;
    },
  },
  {
    id: "bleed-top",
    name: "Pleine page, titre en haut",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    prior: 0.1,
    build: (b) => {
      b.addMedia(first(b), b.page, { bleed: true });
      b.addScrim(rect(0, 0, b.f.width, b.f.height * 0.5), "top");
      b.addTexts(rect(b.m * 1.5, b.m * 1.3, b.f.width - b.m * 3, b.f.height * 0.4), {
        valign: "top",
        onPhoto: true,
        maxSize: 110,
      });
      return true;
    },
  },
  {
    id: "bleed-center",
    name: "Pleine page, titre au centre",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    prior: 0.2,
    build: (b) => {
      b.addMedia(first(b), b.page, { bleed: true });
      b.addScrim(b.page, "all");
      b.addTexts(inset(b.page, b.m * 2.5, b.m * 2.2), { onPhoto: true, maxSize: 140 });
      return true;
    },
  },
  {
    id: "bleed-side",
    name: "Pleine page, texte à gauche",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    build: (b) => {
      if (!isWide(b.f)) return false;
      b.addMedia(first(b), b.page, { bleed: true });
      b.addScrim(rect(0, 0, b.f.width * 0.6, b.f.height), "left");
      b.addTexts(rect(b.m * 1.5, b.m * 1.5, b.f.width * 0.42, b.f.height - b.m * 3), {
        align: "left",
        onPhoto: true,
        maxSize: 110,
      });
      return true;
    },
  },
  {
    id: "magazine",
    name: "Couverture de magazine",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    build: (b) => {
      b.addMedia(first(b), b.page, { bleed: true });
      b.addScrim(rect(0, 0, b.f.width, b.f.height * 0.42), "top");
      b.addScrim(rect(0, b.f.height * 0.7, b.f.width, b.f.height * 0.3));
      titleAndRest(
        b,
        rect(b.m * 1.2, b.m * 0.9, b.f.width - b.m * 2.4, b.f.height * 0.3),
        rect(b.m * 1.5, b.f.height * 0.74, b.f.width - b.m * 3, b.f.height * 0.26 - b.m * 1.2),
        { valign: "top", onPhoto: true, maxSize: 200 },
        { valign: "bottom", onPhoto: true, maxSize: 90 },
      );
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
      b.addMedia(first(b), b.page, { bleed: true });
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
      const item = first(b);
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
      b.addMedia(first(b), media, { bleed: true });
      b.addTexts(inset(text, b.m * 1.3), { align: isWide(b.f) ? "left" : "center", maxSize: 100 });
      return true;
    },
  },
  {
    id: "half-reverse",
    name: "Texte puis photo",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    build: (b) => {
      const [text, media] = splitLong(b.page, 0.45);
      b.addMedia(first(b), media, { bleed: true });
      b.addTexts(inset(text, b.m * 1.3), { align: isWide(b.f) ? "left" : "center", maxSize: 100 });
      return true;
    },
  },
  {
    id: "color-column",
    name: "Photo et colonne de couleur",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    build: (b) => {
      const [media, side] = splitLong(b.page, 0.64);
      b.addMedia(first(b), media, { bleed: true });
      b.addPanel(side, b.theme.colors.background2, { radius: 0, name: "Colonne" });
      b.addPanel(
        isWide(b.f) ? rect(side.x, side.y, 10 * b.u, side.height) : rect(side.x, side.y, side.width, 10 * b.u),
        b.theme.colors.accent,
        { radius: 0, name: "Trait" },
      );
      b.addTexts(inset(side, b.m * 1.1), { align: isWide(b.f) ? "left" : "center", maxSize: 96 });
      return true;
    },
  },
  {
    id: "corner-photo",
    name: "Photo en coin",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const wide = isWide(b.f);
      const box = wide
        ? rect(b.f.width * 0.38, 0, b.f.width * 0.62, b.f.height * 0.78)
        : rect(0, 0, b.f.width, b.f.height * 0.6);
      b.addMedia(first(b), box, { bleed: true });
      b.addAccentBar(
        wide
          ? rect(box.x - 14 * b.u, box.y + box.height * 0.2, 8 * b.u, box.height * 0.6)
          : rect(b.m, box.height + b.gap, 160 * b.u, 8 * b.u),
      );
      const zone = wide
        ? rect(b.m * 1.4, b.f.height * 0.35, b.f.width * 0.38 - b.m * 2.4, b.f.height * 0.65 - b.m * 1.4)
        : rect(b.m * 1.4, box.height + b.gap * 3, b.f.width - b.m * 2.8, b.f.height - box.height - b.gap * 3 - b.m);
      if (b.hasText) b.addTexts(zone, { align: "left", valign: wide ? "bottom" : "center", maxSize: 100 });
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
      const { media, text } = b.areas(0.74, isWide(b.f) && b.texts.length > 1 ? "side" : "bottom");
      b.addMedia(first(b), media, { mode: "fit" });
      texts(b, text);
      return true;
    },
  },
  {
    id: "passe-partout",
    name: "Passe-partout",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const mat = inset(b.page, b.m * 0.8);
      b.addPanel(mat, b.theme.colors.background2, { radius: Math.round(10 * b.u), name: "Passe-partout" });
      const inner = inset(mat, b.m * 0.9);
      if (!b.hasText) {
        b.addMedia(first(b), inner, { mode: "fit", treatment: "plain" });
        return true;
      }
      const [media, text] =
        isWide(b.f) && b.texts.length > 1 ? splitX(inner, 0.66, b.m) : splitY(inner, 0.72, b.gap * 2);
      b.addMedia(first(b), media, { mode: "fit", treatment: "plain" });
      texts(b, text, { maxSize: 90 });
      return true;
    },
  },
  {
    id: "offset-block",
    name: "Bloc de couleur décalé",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { media, text } = b.areas(0.7, "side");
      const d = b.gap * 1.4;
      const photo = fitInside(inset(media, d / 2), first(b).aspect, 0.94);
      b.addPanel(rect(photo.x + d, photo.y + d, photo.width, photo.height), b.theme.colors.accent, {
        radius: 0,
        name: "Bloc",
      });
      b.addMedia(first(b), photo, { treatment: "plain" });
      texts(b, text, { maxSize: 96 });
      return true;
    },
  },
  {
    id: "tilted",
    name: "Photo inclinée",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { media, text } = b.areas(0.64, "side");
      const photo = fitInside(media, first(b).aspect, 0.84);
      b.addPanel(inset(photo, -b.gap * 0.6), b.theme.colors.accent, {
        radius: 0,
        rotation: 5,
        opacity: 0.8,
        name: "Fond",
      });
      b.addMedia(first(b), photo, { treatment: "border", rotation: -3 });
      texts(b, text, { maxSize: 96 });
      return true;
    },
  },
  {
    id: "postcard",
    name: "Carte postale",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    build: (b) => {
      const card = inset(b.page, b.m * 1.3, b.m * 1.2);
      b.addPanel(card, b.theme.colors.background2, { radius: Math.round(14 * b.u), name: "Carte" });
      const inner = inset(card, b.m * 0.7);
      const [media, text] = splitLong(inner, 0.56, b.m * 1.4);
      b.addMedia(first(b), media, { treatment: "plain" });
      b.addPanel(
        isWide(b.f)
          ? rect(media.x + media.width + b.m * 0.7 - 1.5 * b.u, inner.y + b.m * 0.5, 3 * b.u, inner.height - b.m)
          : rect(inner.x + b.m * 0.5, media.y + media.height + b.m * 0.7 - 1.5 * b.u, inner.width - b.m, 3 * b.u),
        b.theme.colors.accent,
        { radius: 0, name: "Trait", opacity: 0.7 },
      );
      b.addTexts(inset(text, b.gap * 0.5), { align: "left", maxSize: 90 });
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
      b.addMedia(first(b), media, { treatment: "polaroid", rotation: -4, scale: 0.92 });
      texts(b, text, { maxSize: 96 });
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
      const slot = squareIn(media, 0.92);
      b.addPanel(inset(slot, -slot.width * 0.04), b.theme.colors.accent, { shape: "circle", name: "Anneau" });
      b.addMedia(first(b), slot, { treatment: "circle" });
      texts(b, text, { maxSize: 96 });
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
      b.addMedia(first(b), fitInside(media, 0.78, 0.96), { treatment: "arch" });
      texts(b, text, { maxSize: 96 });
      return true;
    },
  },
  shaped("heart", "Cœur", "heart", -0.1),
  shaped("hexagon", "Hexagone", "hexagon"),
  shaped("diamond", "Losange", "diamond", -0.3),
  shaped("cloud", "Nuage", "cloud", -0.3),
  shaped("stamp", "Timbre", "stamp"),
  shaped("bubble", "Bulle", "bubble", -0.35),
  shaped("star", "Étoile", "star", -0.45),
];
