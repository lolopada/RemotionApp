import type { MediaOptions, PageBuilder, TextOptions } from "../builder";
import type { MediaItem } from "../content";
import {
  fanArc,
  fitInside,
  freeMosaic,
  goldenSplit,
  grid,
  inset,
  isWide,
  jumbled,
  type Rect,
  rect,
  seeded,
  squareIn,
} from "../fit";
import { avgAspect, type LayoutDef, stacked, texts } from "./helpers";

/**
 * Compositions « créatives » : rien n'est centré ni symétrique. Photos penchées et qui se
 * chevauchent, scotchées, en pile, en éventail, coupées par le bord ; cadres variés (bords
 * flous, liserés en pointillés ou doubles, arches, médaillons) ; textes manuscrits, en dégradé,
 * surlignés ou écrits sur une carte de papier. Tout reste aux couleurs du thème.
 */

export const PAPER = "#fbf7ee";
export const INK = { title: "#2b2622", text: "#6b5f55" };

export const nth = (b: PageBuilder, i: number) => b.media[i] as MediaItem;
export const dims = (b: PageBuilder) => ({ W: b.f.width, H: b.f.height, wide: isWide(b.f), m: b.m, u: b.u });

/** Carte de papier penchée, retenue par un ruban : les textes y sont écrits à la main. */
export function noteCard(b: PageBuilder, box: Rect, rotation: number) {
  b.addPanel(box, PAPER, { name: "Carte", radius: Math.round(6 * b.u), rotation, shadow: true });
  b.addTexts(inset(box, box.width * 0.1, box.height * 0.16), {
    colors: INK,
    look: "script",
    rotation,
    maxSize: 86,
    align: "left",
  });
  b.addTape(box.x + box.width / 2, box.y + 4 * b.u, Math.min(box.width * 0.42, 200 * b.u), rotation - 5);
}

/** Bande penchée (couleur ou pellicule) qui traverse la page, photos posées dessus en quinconce. */
function tiltedBand(b: PageBuilder, kind: "color" | "film"): boolean {
  const { W, H, wide, m, u } = dims(b);
  const n = b.media.length;
  if (!wide && n > 3) return false;
  const angle = wide ? -7 : -10;
  const tan = Math.tan((-angle * Math.PI) / 180);
  const band = wide ? rect(-W * 0.1, H * 0.31, W * 1.2, H * 0.42) : rect(-W * 0.25, H * 0.33, W * 1.5, H * 0.34);
  const c = b.theme.colors;
  if (kind === "color") {
    b.addPanel(band, c.accent, {
      name: "Bande (déborde)",
      radius: 0,
      rotation: angle,
      gradientTo: c.background2,
      gradientAngle: 90,
    });
  } else {
    b.addPanel(band, "#111111", { name: "Pellicule (déborde)", radius: 0, rotation: angle });
    const hole = Math.round(16 * u);
    for (const dy of [hole * 1.6, band.height - hole * 1.6]) {
      b.addPanel(rect(band.x, band.y + dy - hole / 2, band.width, hole), "#f4f1ea", {
        name: "Perforations (déborde)",
        shape: "line",
        outline: hole,
        dotted: true,
        rotation: angle,
      });
    }
  }
  const span = W * 0.84;
  const slotW = span / n;
  const h = kind === "film" ? band.height * 0.66 : band.height * 0.92;
  const midY = band.y + band.height / 2;
  for (let i = 0; i < n; i++) {
    const cx = (W - span) / 2 + slotW * (i + 0.5);
    // Le long de la bande (qui monte vers la droite), un peu au-dessus / en dessous en couleur.
    const jitter = kind === "color" ? (i % 2 ? 1 : -1) * h * 0.1 : 0;
    const cy = midY - tan * (cx - W / 2) + jitter;
    const slot = rect(cx - (slotW * 0.9) / 2, cy - h / 2, slotW * 0.9, h);
    b.addMedia(
      nth(b, i),
      slot,
      kind === "film"
        ? { treatment: "plain", rotation: angle, shadow: false }
        : { mode: "fit", treatment: "border", rotation: i % 2 ? 4 : -5 },
    );
  }
  if (b.hasText) {
    const hasTitle = b.pickTexts("title").length > 0;
    const hasRest = b.pickTexts("rest").length > 0;
    const top = rect(m * 1.5, m * 0.9, W * (wide ? 0.6 : 1) - m * 3, band.y - m * 1.2);
    const bottom = rect(
      W * (wide ? 0.4 : 0) + m * 1.5,
      band.y + band.height + m * 0.6,
      W * (wide ? 0.6 : 1) - m * 3,
      H - band.y - band.height - m * 1.4,
    );
    if (hasTitle) b.addTexts(top, { pick: "title", look: "caps", align: "left", valign: "bottom", maxSize: 130 });
    if (hasRest) {
      b.addTexts(hasTitle ? bottom : top, {
        pick: "rest",
        look: "script",
        align: wide ? "right" : "left",
        valign: wide ? "top" : "center",
        maxSize: wide ? 90 : 130,
      });
    }
  }
  return true;
}

/** Photos dans les cases, la case `textAt` (si texte) devient un aplat avec les textes. */
export function cellsWithText(
  b: PageBuilder,
  cells: Rect[],
  textAt: number,
  opts: MediaOptions,
  look: TextOptions["look"],
) {
  const c = b.theme.colors;
  let photo = 0;
  cells.forEach((cell, i) => {
    if (b.hasText && i === textAt) {
      b.addPanel(cell, c.accent, {
        name: "Case de texte",
        radius: Math.round(18 * b.u),
        gradientTo: c.background2,
        gradientAngle: 150,
      });
      b.addTexts(inset(cell, Math.min(cell.width, cell.height) * 0.12), {
        look,
        colors: { title: "#ffffff", text: "#ffffff" },
        maxSize: 100,
        align: "left",
      });
      return;
    }
    const item = b.media[photo++];
    if (item) b.addMedia(item, cell, opts);
  });
}

export const CREATIVE_LAYOUTS: LayoutDef[] = [
  // ------------------------------------------------------------ Une photo
  {
    id: "c-taped",
    name: "Photo scotchée",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, wide, m, u } = dims(b);
      const slot = !b.hasText
        ? inset(b.page, m * 1.6)
        : wide
          ? rect(W * 0.06, H * 0.1, W * 0.54, H * 0.8)
          : rect(W * 0.08, H * 0.07, W * 0.84, H * 0.55);
      const box = b.addMedia(nth(b, 0), slot, { mode: "fit", treatment: "border", rotation: -4, scale: 0.94 });
      b.addTape(box.x + box.width * 0.1, box.y + box.height * 0.03, box.width * 0.24, -32);
      b.addTape(box.x + box.width * 0.9, box.y + box.height * 0.05, box.width * 0.24, 28);
      b.addSticker("sparkle", rect(box.x + box.width - 70 * u, box.y - 40 * u, 110 * u, 110 * u), 0, "float");
      if (b.hasText) {
        const zone = wide ? rect(W * 0.64, H * 0.16, W * 0.32, H * 0.68) : rect(W * 0.1, H * 0.68, W * 0.8, H * 0.27);
        b.addTexts(zone, { align: "left", look: "script", rotation: 2, maxSize: 104 });
      }
      return true;
    },
  },
  {
    id: "c-dreamy",
    name: "Bord flou rêveur",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, wide, m } = dims(b);
      const slot = !b.hasText ? b.page : wide ? rect(0, 0, W * 0.64, H) : rect(0, 0, W, H * 0.62);
      b.addMedia(nth(b, 0), slot, { treatment: "plain", feather: 110, shadow: false });
      if (b.hasText) {
        const zone = wide ? rect(W * 0.6, H * 0.18, W * 0.35, H * 0.64) : rect(m * 1.5, H * 0.6, W - m * 3, H * 0.34);
        b.addTexts(zone, { align: wide ? "left" : "center", look: "gradient", maxSize: 120 });
      }
      return true;
    },
  },
  {
    id: "c-offset-dashed",
    name: "Cadre décalé en tirets",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, wide, m, u } = dims(b);
      const item = nth(b, 0);
      const slot = !b.hasText
        ? inset(b.page, m * 1.8)
        : wide
          ? rect(W * 0.38, H * 0.12, W * 0.54, H * 0.7)
          : rect(W * 0.14, H * 0.07, W * 0.76, H * 0.52);
      const photo = fitInside(slot, item.aspect, 0.92);
      const d = b.gap * 1.8;
      b.addPanel(rect(photo.x - d, photo.y + d, photo.width, photo.height), b.theme.colors.accent, {
        name: "Cadre en tirets",
        outline: 5 * u,
        dashed: true,
        radius: 0,
      });
      b.addMedia(item, photo, { treatment: "plain", shadow: true });
      if (b.hasText) {
        const zone = wide ? rect(m * 1.5, H * 0.3, W * 0.3, H * 0.56) : rect(m * 1.5, H * 0.66, W - m * 3, H * 0.29);
        b.addTexts(zone, { align: "left", valign: wide ? "bottom" : "center", look: "highlight", maxSize: 110 });
      }
      return true;
    },
  },
  {
    id: "c-title-behind",
    name: "Titre derrière la photo",
    minMedia: 1,
    maxMedia: 1,
    needsText: true,
    build: (b) => {
      const { W, H, wide, m } = dims(b);
      const hasTitle = b.pickTexts("title").length > 0;
      // Le titre d'abord : la photo, posée ensuite, passe devant lui.
      const titleZone = wide ? rect(m, m * 0.7, W - m * 2, H * 0.42) : rect(m, m * 1.2, W - m * 2, H * 0.3);
      const used = b.addTexts(titleZone, {
        pick: hasTitle ? "title" : undefined,
        look: "caps",
        valign: "top",
        maxSize: 240,
      });
      // L'arche monte sur le bas du titre (assez pour passer devant, pas assez pour le cacher).
      const top = used ? used.y + used.height * 0.72 : H * 0.27;
      const slot = wide
        ? rect(W * 0.3, top, W * 0.4, H - top - m * 0.6)
        : rect(W * 0.12, top, W * 0.76, H * 0.84 - top);
      b.addMedia(nth(b, 0), fitInside(slot, 0.78, 1), { treatment: "arch" });
      if (hasTitle) {
        const rest = wide ? rect(W * 0.73, H * 0.58, W * 0.23, H * 0.32) : rect(m * 1.5, H * 0.86, W - m * 3, H * 0.11);
        b.addTexts(rest, { pick: "rest", look: "script", align: "left", maxSize: 80 });
      }
      return true;
    },
  },
  {
    id: "c-porthole",
    name: "Hublot coupé par le bord",
    minMedia: 1,
    maxMedia: 1,
    bleedsOff: true,
    build: (b) => {
      const { W, H, wide, m, u } = dims(b);
      const s = wide ? H * 1.05 : W * 1.1;
      const box = wide ? rect(W - s * 0.7, (H - s) / 2, s, s) : rect((W - s) / 2, H - s * 0.68, s, s);
      b.addPanel(inset(box, -s * 0.03), b.theme.colors.accent, {
        name: "Anneau (déborde)",
        shape: "circle",
        outline: 10 * u,
      });
      b.addMedia(nth(b, 0), box, { treatment: "circle", shadow: false });
      if (b.hasText) {
        const zone = wide
          ? rect(m * 1.5, m * 1.5, W - s * 0.7 - m * 3, H - m * 3)
          : rect(m * 1.5, m * 1.4, W - m * 3, H - s * 0.68 - m * 2.6);
        b.addTexts(zone, { align: "left", look: "outline", maxSize: 130 });
      }
      return true;
    },
  },
  {
    id: "c-own-blur",
    name: "Sur son propre flou",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, wide, m } = dims(b);
      const item = nth(b, 0);
      if (item.kind !== "image") return false;
      b.background = {
        type: "image",
        src: item.src,
        blur: 40,
        veil: { enabled: true, color: b.theme.colors.background, opacity: 0.4, mode: "solid" },
      };
      const slot = !b.hasText
        ? inset(b.page, m * 1.5)
        : wide
          ? rect(W * 0.07, H * 0.12, W * 0.5, H * 0.76)
          : rect(W * 0.1, H * 0.08, W * 0.8, H * 0.56);
      b.addMedia(item, slot, { mode: "fit", treatment: "border", rotation: 3, borderWidth: 0.018 });
      if (b.hasText) {
        const zone = wide ? rect(W * 0.62, H * 0.18, W * 0.33, H * 0.64) : rect(m * 1.5, H * 0.69, W - m * 3, H * 0.26);
        b.addTexts(zone, { align: "left", onPhoto: true, look: "caps", maxSize: 120 });
      }
      return true;
    },
  },
  {
    id: "c-soft-circle",
    name: "Rond flou et paillettes",
    minMedia: 1,
    maxMedia: 1,
    prior: -0.1,
    build: (b) => {
      const { media, text } = b.areas(0.6, "side");
      const slot = squareIn(media, 1);
      b.addMedia(nth(b, 0), slot, { treatment: "circle", feather: 70, shadow: false });
      const s = slot.width;
      b.addSticker("sparkle", rect(slot.x + s * 0.78, slot.y + s * 0.02, s * 0.2, s * 0.2), 0, "float");
      b.addSticker("star", rect(slot.x + s * 0.04, slot.y + s * 0.76, s * 0.13, s * 0.13), -12, "sway");
      texts(b, text, { look: "script", maxSize: 104 });
      return true;
    },
  },
  {
    id: "c-double-frame",
    name: "Double liseré et pastille",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { media, text } = b.areas(0.66, "side");
      const item = nth(b, 0);
      const photo = fitInside(media, item.aspect, 0.84);
      const c = b.theme.colors;
      const d = photo.width * 0.62;
      b.addPanel(rect(photo.x - d * 0.22, photo.y + photo.height - d * 0.7, d, d), c.accent, {
        name: "Pastille (déborde)",
        shape: "circle",
        gradientTo: c.background2,
        opacity: 0.9,
      });
      b.addMedia(item, photo, {
        treatment: "border",
        borderStyle: "double",
        borderColor: c.accent,
        borderWidth: 0.035,
        rotation: -2,
      });
      texts(b, text, { look: "gradient", maxSize: 104 });
      return true;
    },
  },

  // ------------------------------------------------------------ Deux photos
  {
    id: "c-overlap-duo",
    name: "Deux photos qui se chevauchent",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { W, H, wide, m } = dims(b);
      const solo = !b.hasText;
      const [aSlot, bSlot] = wide
        ? [
            rect(W * 0.05, H * 0.08, W * (solo ? 0.58 : 0.5), H * 0.72),
            rect(W * (solo ? 0.5 : 0.4), H * 0.42, W * (solo ? 0.42 : 0.32), H * 0.5),
          ]
        : [rect(W * 0.05, H * 0.05, W * 0.75, H * 0.42), rect(W * 0.35, H * 0.33, W * 0.6, H * 0.34)];
      b.addMedia(nth(b, 0), aSlot, { mode: "fit", treatment: "border", rotation: -3, scale: 0.96 });
      const small = b.addMedia(nth(b, 1), bSlot, { mode: "fit", treatment: "border", rotation: 6 });
      b.addTape(small.x + small.width * 0.5, small.y + 6 * b.u, small.width * 0.3, -6);
      if (b.hasText) {
        const zone = wide ? rect(W * 0.68, H * 0.1, W * 0.28, H * 0.5) : rect(m * 1.5, H * 0.71, W - m * 3, H * 0.25);
        b.addTexts(zone, { align: "left", look: "script", rotation: -2, maxSize: 100 });
      }
      return true;
    },
  },
  {
    id: "c-soft-and-circle",
    name: "Grande floue et médaillon",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { W, H, wide, m, u } = dims(b);
      const big = wide ? rect(0, 0, W * 0.62, H) : rect(0, 0, W, H * 0.56);
      b.addMedia(nth(b, 0), big, { treatment: "plain", feather: 100, shadow: false });
      const s = wide ? H * 0.46 : W * 0.5;
      const circle = wide ? rect(W * 0.5, H * 0.44, s, s) : rect(W * 0.42, H * 0.44, s, s);
      b.addPanel(inset(circle, -s * 0.035), b.theme.colors.accent, { name: "Anneau", shape: "circle" });
      b.addMedia(nth(b, 1), circle, { treatment: "circle" });
      b.addSticker("sparkle", rect(circle.x - 30 * u, circle.y - 10 * u, 90 * u, 90 * u), 0, "float");
      if (b.hasText) {
        const zone = wide ? rect(W * 0.67, H * 0.08, W * 0.29, H * 0.34) : rect(m * 1.5, H * 0.74, W * 0.4, H * 0.22);
        b.addTexts(zone, { align: "left", look: "caps", maxSize: 100, valign: wide ? "top" : "center" });
      }
      return true;
    },
  },

  // ------------------------------------------------------------ Trois photos
  {
    id: "c-one-color",
    name: "Une en couleur, les autres en noir et blanc",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      const { W, H, wide, m } = dims(b);
      const hero = wide ? rect(m, m, W * 0.54, H - m * 2) : rect(m, m, W - m * 2, H * 0.52);
      b.addMedia(nth(b, 0), hero, { treatment: "rounded" });
      const [s1, s2] = wide
        ? [rect(W * 0.6, H * 0.07, W * 0.34, H * 0.42), rect(W * 0.63, H * 0.5, W * 0.3, H * 0.43)]
        : [rect(m, H * 0.56, W * 0.48, H * 0.36), rect(W * 0.47, H * 0.6, W * 0.47, H * 0.36)];
      b.addMedia(nth(b, 1), s1, { mode: "fit", treatment: "border", rotation: 3, filter: "bw", scale: 0.95 });
      b.addMedia(nth(b, 2), s2, { mode: "fit", treatment: "border", rotation: -4, filter: "bw", scale: 0.95 });
      if (b.hasText) {
        b.addScrim(rect(hero.x, hero.y + hero.height * 0.5, hero.width, hero.height * 0.5));
        b.addTexts(rect(hero.x + m, hero.y + hero.height * 0.56, hero.width - m * 2, hero.height * 0.4), {
          align: "left",
          valign: "bottom",
          onPhoto: true,
          look: "highlight",
          maxSize: 100,
        });
      }
      return true;
    },
  },
  {
    id: "c-staircase",
    name: "Escalier penché",
    minMedia: 3,
    maxMedia: 4,
    freeOrder: true,
    build: (b) => {
      const { W, H, wide, m } = dims(b);
      const zone = !b.hasText ? b.safe : wide ? rect(m, m, W * 0.66, H - m * 2) : rect(m, m, W - m * 2, H * 0.68);
      const n = b.media.length;
      const rotations = [-6, 4, -3, 5];
      for (let i = 0; i < n; i++) {
        const k = 0.6 - i * 0.07;
        const t = i / (n - 1);
        const w = zone.width * k;
        const h = zone.height * k;
        const slot = rect(zone.x + (zone.width - w) * t, zone.y + (zone.height - h) * (1 - t), w, h);
        b.addMedia(nth(b, i), slot, { mode: "fit", treatment: "border", rotation: rotations[i] });
      }
      if (b.hasText) {
        const text = wide ? rect(W * 0.7, H * 0.42, W * 0.26, H * 0.48) : rect(m * 1.5, H * 0.72, W - m * 3, H * 0.24);
        b.addTexts(text, { align: "left", valign: "bottom", look: "script", maxSize: 100 });
      }
      return true;
    },
  },
  {
    id: "c-arch-bubbles",
    name: "Arche et bulles",
    minMedia: 3,
    maxMedia: 3,
    freeOrder: true,
    build: (b) => {
      const { W, H, wide, m } = dims(b);
      const c = b.theme.colors;
      if (wide) {
        b.addMedia(nth(b, 0), fitInside(rect(W * 0.06, H * 0.08, W * 0.38, H * 0.84), 0.72, 1), { treatment: "arch" });
        const s1 = H * 0.42;
        const s2 = H * 0.27;
        b.addPanel(rect(W * 0.6, H * 0.56, H * 0.1, H * 0.1), c.accent, { name: "Bulle", shape: "circle" });
        b.addMedia(nth(b, 1), rect(W * 0.4, H * 0.1, s1, s1), { treatment: "circle" });
        b.addMedia(nth(b, 2), rect(W * 0.45, H * 0.6, s2, s2), { treatment: "circle" });
        if (b.hasText) b.addTexts(rect(W * 0.68, H * 0.18, W * 0.28, H * 0.64), { align: "left", look: "gradient" });
      } else {
        b.addMedia(nth(b, 0), fitInside(rect(W * 0.06, H * 0.05, W * 0.56, H * 0.5), 0.72, 1), {
          treatment: "arch",
        });
        const s1 = W * 0.4;
        const s2 = W * 0.28;
        b.addMedia(nth(b, 1), rect(W * 0.55, H * 0.12, s1, s1), { treatment: "circle" });
        b.addMedia(nth(b, 2), rect(W * 0.62, H * 0.12 + s1 + b.gap, s2, s2), { treatment: "circle" });
        if (b.hasText) {
          b.addTexts(rect(m * 1.5, H * 0.62, W - m * 3, H * 0.32), { align: "left", look: "gradient" });
        }
      }
      return true;
    },
  },

  // ------------------------------------------------------------ Plusieurs photos
  {
    id: "c-golden",
    name: "Spirale dorée",
    minMedia: 2,
    maxMedia: 8,
    freeOrder: true,
    build: (b) => {
      // En portrait, au-delà de 4 photos les dernières cases deviendraient minuscules.
      if (!isWide(b.f) && b.media.length > 4) return false;
      const n = b.media.length + (b.hasText ? 1 : 0);
      const cells = goldenSplit(b.safe, n, b.gap * 0.6);
      cellsWithText(b, cells, 1, { treatment: "rounded" }, "caps");
      return true;
    },
  },
  {
    id: "c-free-mosaic",
    name: "Mosaïque libre",
    minMedia: 3,
    maxMedia: 9,
    freeOrder: true,
    build: (b) => {
      const n = b.media.length + (b.hasText ? 1 : 0);
      const cells = freeMosaic(b.safe, n, b.gap * 0.6);
      // Texte dans la case la plus logeable (pas trop étroite), hors de la plus grande (photo n° 1).
      let textAt = 1;
      cells.forEach((c, i) => {
        const score = (x: Rect) => Math.min(x.width, x.height * 1.8);
        if (i > 0 && score(c) > score(cells[textAt] as Rect)) textAt = i;
      });
      cellsWithText(b, cells, textAt, { treatment: "rounded" }, "highlight");
      return true;
    },
  },
  {
    id: "c-moodboard",
    name: "Tableau d'inspiration",
    minMedia: 3,
    maxMedia: 10,
    freeOrder: true,
    build: (b) => {
      const { W, H, wide, m, u } = dims(b);
      const n = b.media.length;
      const zone = !b.hasText ? b.safe : wide ? rect(m, m, W * 0.7, H - m * 2) : rect(m, m, W - m * 2, H * 0.72);
      const spots = jumbled(zone, n, b.gap * 0.4, avgAspect(b.media));
      const c = b.theme.colors;
      spots.forEach(({ box, rotation }, i) => {
        const kind = i % 4;
        const opts: MediaOptions =
          kind === 0
            ? { treatment: "polaroid", scale: 0.98 }
            : kind === 1
              ? { mode: "fit", treatment: "border" }
              : kind === 2
                ? { mode: "fit", treatment: "border", borderColor: c.accent, borderStyle: "dashed", borderWidth: 0.02 }
                : { mode: "fit", treatment: "rounded" };
        const placed = b.addMedia(nth(b, i), box, { ...opts, rotation });
        if (kind === 1) b.addTape(placed.x + placed.width / 2, placed.y + 4 * u, placed.width * 0.32, rotation - 6);
      });
      const first = spots[0]?.box;
      if (first) b.addSticker("sparkle", rect(first.x - 20 * u, first.y - 20 * u, 90 * u, 90 * u), 0, "float");
      if (b.hasText) {
        noteCard(
          b,
          wide ? rect(W * 0.735, H * 0.2, W * 0.235, H * 0.52) : rect(W * 0.12, H * 0.755, W * 0.76, H * 0.2),
          wide ? 3 : -2,
        );
      }
      return true;
    },
  },
  {
    id: "c-pile",
    name: "Pile de souvenirs",
    minMedia: 3,
    maxMedia: 6,
    freeOrder: true,
    build: (b) => {
      const { W, H, wide, m } = dims(b);
      const n = b.media.length;
      const zone = !b.hasText ? b.safe : wide ? rect(m, m, W * 0.6, H - m * 2) : rect(m, m, W - m * 2, H * 0.66);
      const s = Math.min(zone.width, zone.height) * 0.74;
      const rand = seeded(n * 31 + 7);
      const cx0 = zone.x + zone.width / 2;
      const cy0 = zone.y + zone.height / 2;
      // Les dernières photos d'abord (dessous), la photo mise en avant en dernier (dessus).
      const spots = Array.from({ length: n }, (_, i) => {
        if (i === 0) return { cx: cx0, cy: cy0, rotation: -2 };
        return {
          cx: cx0 + (rand() - 0.5) * (zone.width - s) * 0.9,
          cy: cy0 + (rand() - 0.5) * (zone.height - s) * 0.9,
          rotation: Math.round((rand() - 0.5) * 30),
        };
      });
      for (let i = n - 1; i >= 0; i--) {
        const { cx, cy, rotation } = spots[i] as { cx: number; cy: number; rotation: number };
        b.addMedia(nth(b, i), rect(cx - s / 2, cy - s / 2, s, s), { mode: "fit", treatment: "border", rotation });
      }
      if (b.hasText) {
        noteCard(
          b,
          wide ? rect(W * 0.66, H * 0.26, W * 0.29, H * 0.46) : rect(W * 0.1, H * 0.71, W * 0.8, H * 0.23),
          wide ? -3 : 2,
        );
      }
      return true;
    },
  },
  {
    id: "c-fan-arc",
    name: "Éventail en arc",
    minMedia: 3,
    maxMedia: 7,
    freeOrder: true,
    build: (b) => {
      if (!isWide(b.f) && b.media.length > 4) return false;
      const { media, text } = stacked(b, 0.74);
      fanArc(
        media,
        b.media.map((x) => x.aspect),
      ).forEach(({ box, rotation }, i) => {
        b.addMedia(nth(b, i), box, { treatment: "polaroid", rotation });
      });
      texts(b, text, { look: "script", maxSize: 100 });
      return true;
    },
  },
  {
    id: "c-wave",
    name: "Vague",
    minMedia: 3,
    maxMedia: 7,
    freeOrder: true,
    build: (b) => {
      const n = b.media.length;
      if (!isWide(b.f) && n > 4) return false;
      const { media, text } = stacked(b, 0.74);
      grid(media, n, 1, b.gap).forEach((cell, i) => {
        // Hauteur qui ondule d'une photo à l'autre ; une sur deux en médaillon.
        const dy = Math.sin((i / Math.max(1, n - 1)) * Math.PI * 1.5) * cell.height * 0.12;
        const shrunk = rect(cell.x, cell.y + cell.height * 0.12 + dy, cell.width, cell.height * 0.76);
        b.addMedia(
          nth(b, i),
          i % 2 ? squareIn(shrunk, 0.96) : shrunk,
          i % 2 ? { treatment: "circle" } : { treatment: "rounded", rotation: i % 4 === 0 ? -4 : 4 },
        );
      });
      texts(b, text, { look: "typewriter", maxSize: 100 });
      return true;
    },
  },
  {
    id: "c-color-band",
    name: "Sur une bande de couleur",
    minMedia: 2,
    maxMedia: 5,
    freeOrder: true,
    build: (b) => tiltedBand(b, "color"),
  },
  {
    id: "c-film-tilt",
    name: "Pellicule penchée",
    minMedia: 2,
    maxMedia: 6,
    freeOrder: true,
    build: (b) => tiltedBand(b, "film"),
  },
];
