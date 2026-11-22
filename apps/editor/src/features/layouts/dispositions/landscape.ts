import type { MediaOptions, PageBuilder } from "../builder";
import { fitInside, freeMosaic, goldenSplit, grid, inset, isWide, jumbled, rect, squareIn } from "../fit";
import { dims, INK, noteCard, nth, PAPER } from "./creative";
import { avgAspect, type LayoutDef } from "./helpers";

/**
 * Compositions créatives réservées au paysage (16:9, 21:9) : elles jouent sur la largeur de
 * l'image (bandes, diagonales, pellicules, livre ouvert, constellations…). Refusées dans les
 * autres formats (la disposition renvoie false).
 */

/** Rotation d'un point autour d'un centre (degrés, sens de CSS : positif = horaire). */
function rotateAround(x: number, y: number, cx: number, cy: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Trait (plein, tirets ou pointillés) d'un point à un autre. */
function link(
  b: PageBuilder,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  opts: { width?: number; dotted?: boolean; dashed?: boolean } = {},
) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const t = opts.width ?? 5 * b.u;
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  b.addPanel(rect((x1 + x2) / 2 - d / 2, (y1 + y2) / 2 - t / 2, d, t), color, {
    name: "Trait (déborde)",
    shape: "line",
    outline: t,
    dotted: opts.dotted,
    dashed: opts.dashed,
    rotation: deg,
  });
}

/** Ligne de perforations de pellicule (verticale si `vertical`). */
function perforations(b: PageBuilder, cx: number, cy: number, length: number, vertical: boolean) {
  const hole = Math.round(16 * b.u);
  b.addPanel(rect(cx - length / 2, cy - hole / 2, length, hole), "#f4f1ea", {
    name: "Perforations (déborde)",
    shape: "line",
    outline: hole,
    dotted: true,
    rotation: vertical ? 90 : 0,
  });
}

/** Punaise : petite pastille d'accent avec une ombre. */
function pin(b: PageBuilder, cx: number, cy: number) {
  const s = 30 * b.u;
  b.addPanel(rect(cx - s / 2, cy - s / 2, s, s), b.theme.colors.accent, {
    name: "Punaise",
    shape: "circle",
    shadow: true,
  });
}

/** Version paysage seulement. */
const wideOnly = (def: LayoutDef): LayoutDef => ({
  ...def,
  build: (b) => (isWide(b.f) ? def.build(b) : false),
});

const PAPER_BORDER: MediaOptions = { mode: "fit", treatment: "border" };

const DEFS: LayoutDef[] = [
  // ============================================================ Textes seuls
  {
    id: "p-text-diagonal",
    name: "Titre en biais",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const { W, H, m } = dims(b);
      const c = b.theme.colors;
      b.addPanel(rect(-W * 0.1, H * 0.3, W * 1.2, H * 0.4), c.accent, {
        name: "Bande (déborde)",
        radius: 0,
        rotation: -6,
        gradientTo: c.background2,
        gradientAngle: 90,
      });
      const hasRest = b.pickTexts("rest").length > 0 && b.pickTexts("title").length > 0;
      b.addTexts(rect(m * 2, H * 0.32, W - m * 4, H * 0.36), {
        pick: hasRest ? "title" : undefined,
        look: "caps",
        rotation: -6,
        colors: { title: "#ffffff", text: "#ffffff" },
        maxSize: 170,
      });
      if (hasRest) {
        b.addTexts(rect(W * 0.45, H * 0.76, W * 0.5, H * 0.18), { pick: "rest", look: "script", align: "right" });
      }
      return true;
    },
  },
  {
    id: "p-text-giant",
    name: "Titre géant et cercles",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      const c = b.theme.colors;
      const s = H * 1.1;
      b.addPanel(rect(W - s * 0.62, -s * 0.3, s, s), c.accent, {
        name: "Cercle (déborde)",
        shape: "circle",
        outline: 6 * u,
      });
      b.addPanel(rect(W - s * 0.42, -s * 0.12, s * 0.6, s * 0.6), c.accent, {
        name: "Cercle (déborde)",
        shape: "circle",
        opacity: 0.25,
      });
      b.addPanel(rect(W * 0.08, H * 0.12, 26 * u, 26 * u), c.accent, { name: "Point", shape: "circle" });
      b.addTexts(rect(m * 2, H * 0.3, W * 0.7, H * 0.62), {
        align: "left",
        valign: "bottom",
        look: "caps",
        maxSize: 210,
      });
      return true;
    },
  },
  {
    id: "p-text-note",
    name: "Mot sur une carte",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const { W, H, u } = dims(b);
      noteCard(b, rect(W * 0.24, H * 0.16, W * 0.5, H * 0.66), -3);
      b.addSticker("arrow-doodle", rect(W * 0.76, H * 0.6, 170 * u, 170 * u), -20, "sway");
      b.addSticker("sparkle", rect(W * 0.18, H * 0.1, 110 * u, 110 * u), 0, "float");
      return true;
    },
  },
  {
    id: "p-text-ticket",
    name: "Billet",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const { W, H, u } = dims(b);
      const c = b.theme.colors;
      const ticket = rect(W * 0.14, H * 0.22, W * 0.72, H * 0.56);
      b.addPanel(ticket, PAPER, { name: "Billet", shape: "stamp", rotation: 3, shadow: true });
      b.addPanel(inset(ticket, ticket.height * 0.12), c.accent, {
        name: "Cadre du billet",
        outline: 3 * u,
        dashed: true,
        radius: Math.round(8 * u),
        rotation: 3,
      });
      b.addTexts(inset(ticket, ticket.width * 0.1, ticket.height * 0.2), {
        colors: INK,
        look: "caps",
        rotation: 3,
        maxSize: 120,
      });
      return true;
    },
  },

  // ============================================================ Une photo
  {
    id: "p-postcard-tilt",
    name: "Carte postale penchée",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, u } = dims(b);
      const c = b.theme.colors;
      const card = rect(W * 0.08, H * 0.1, W * 0.84, H * 0.8);
      const r = -3;
      b.addPanel(card, PAPER, { name: "Carte postale", radius: Math.round(10 * u), rotation: r, shadow: true });
      const photo = rect(card.x + card.width * 0.04, card.y + card.height * 0.08, card.width * 0.5, card.height * 0.84);
      b.addMedia(nth(b, 0), photo, { treatment: "plain", rotation: r, shadow: false });
      const mid = card.x + card.width * 0.6;
      b.addPanel(rect(mid - 2 * u, card.y + card.height * 0.12, 4 * u, card.height * 0.76), c.accent, {
        name: "Séparation",
        radius: 0,
        opacity: 0.5,
        rotation: r,
      });
      const st = card.height * 0.22;
      b.addPanel(rect(card.x + card.width - st * 1.25, card.y + st * 0.3, st, st * 1.15), c.accent, {
        name: "Timbre",
        shape: "stamp",
        outline: 4 * u,
        rotation: r + 6,
      });
      if (b.hasText) {
        b.addTexts(rect(mid + card.width * 0.04, card.y + card.height * 0.38, card.width * 0.34, card.height * 0.5), {
          colors: INK,
          look: "script",
          align: "left",
          rotation: r,
          maxSize: 90,
        });
      }
      return true;
    },
  },
  {
    id: "p-magazine-side",
    name: "Une de magazine",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, m } = dims(b);
      b.addMedia(nth(b, 0), rect(W * 0.42, 0, W * 0.58, H), { bleed: true });
      if (b.hasText) {
        const hasTitle = b.pickTexts("title").length > 0;
        b.addTexts(rect(m * 1.2, H * 0.08, W * 0.54, H * 0.62), {
          pick: hasTitle ? "title" : undefined,
          align: "left",
          valign: "top",
          look: "outline",
          maxSize: 210,
        });
        if (hasTitle)
          b.addTexts(rect(m * 1.5, H * 0.74, W * 0.34, H * 0.2), { pick: "rest", align: "left", look: "script" });
      }
      return true;
    },
  },
  {
    id: "p-badge-burst",
    name: "Photo et étoile",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      const c = b.theme.colors;
      b.addMedia(nth(b, 0), rect(m, m, W * 0.58, H - m * 2), { treatment: "rounded" });
      const s = W * 0.15;
      b.addPanel(rect(m + W * 0.58 - s * 0.6, m * 0.6, s, s), c.accent, {
        name: "Étoile",
        shape: "burst",
        rotation: 12,
        gradientTo: c.background2,
      });
      b.addSticker("sparkle", rect(m + W * 0.58 - s * 0.2, m + s * 0.7, 80 * u, 80 * u), 0, "float");
      if (b.hasText)
        b.addTexts(rect(W * 0.68, H * 0.24, W * 0.28, H * 0.56), { align: "left", look: "caps", maxSize: 110 });
      return true;
    },
  },
  {
    id: "p-paper-stack",
    name: "Photo sur une pile de papiers",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H } = dims(b);
      const c = b.theme.colors;
      const item = nth(b, 0);
      const photo = fitInside(rect(W * 0.07, H * 0.12, W * 0.5, H * 0.76), item.aspect, 0.88);
      b.addPanel(inset(photo, -b.gap), c.background2, { name: "Papier", radius: 0, rotation: -7, shadow: true });
      b.addPanel(inset(photo, -b.gap * 0.6), c.accent, { name: "Papier", radius: 0, rotation: 5, shadow: true });
      b.addMedia(item, photo, { treatment: "border", rotation: -1.5 });
      if (b.hasText)
        b.addTexts(rect(W * 0.64, H * 0.2, W * 0.32, H * 0.6), { align: "left", look: "script", maxSize: 110 });
      return true;
    },
  },
  {
    id: "p-heart-soft",
    name: "Cœur flou",
    minMedia: 1,
    maxMedia: 1,
    prior: -0.1,
    build: (b) => {
      const { W, H, u } = dims(b);
      const slot = squareIn(rect(W * 0.07, H * 0.06, W * 0.5, H * 0.88), 1);
      b.addMedia(nth(b, 0), slot, { treatment: "heart", feather: 30, shadow: false });
      b.addSticker(
        "hearts",
        rect(slot.x + slot.width * 0.82, slot.y + slot.height * 0.06, 130 * u, 130 * u),
        8,
        "float",
      );
      if (b.hasText)
        b.addTexts(rect(W * 0.6, H * 0.2, W * 0.35, H * 0.6), { align: "left", look: "gradient", maxSize: 120 });
      return true;
    },
  },
  {
    id: "p-vignette",
    name: "Plein cadre vaporeux",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, m } = dims(b);
      b.addMedia(nth(b, 0), b.page, { treatment: "plain", feather: 170, shadow: false });
      if (b.hasText) {
        b.addScrim(rect(0, H * 0.4, W, H * 0.6));
        b.addTexts(rect(m * 1.6, H * 0.56, W * 0.52, H * 0.36), {
          align: "left",
          valign: "bottom",
          onPhoto: true,
          look: "caps",
          maxSize: 130,
        });
      }
      return true;
    },
  },
  {
    id: "p-diagonal-cut",
    name: "Coupe en diagonale",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      const c = b.theme.colors;
      b.addMedia(nth(b, 0), b.page, { bleed: true });
      if (!b.hasText) return true;
      const panel = rect(-W * 0.3, -H * 0.2, W * 0.76, H * 1.4);
      const angle = 12;
      b.addPanel(panel, c.background, { name: "Pan (déborde)", radius: 0, rotation: angle, opacity: 0.95 });
      // Filet d'accent le long du bord du pan (calculé dans le repère tourné).
      const pc = { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2 };
      const edge = rotateAround(panel.x + panel.width, pc.y, pc.x, pc.y, angle);
      const t = 12 * u;
      b.addPanel(rect(edge.x - t / 2, edge.y - panel.height / 2, t, panel.height), c.accent, {
        name: "Filet (déborde)",
        radius: 0,
        rotation: angle,
      });
      b.addTexts(rect(m * 1.5, H * 0.18, W * 0.3, H * 0.64), { align: "left", look: "highlight", maxSize: 110 });
      return true;
    },
  },
  {
    id: "p-frame-in-frame",
    name: "Cadre dans le cadre",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      b.addMedia(nth(b, 0), b.page, { bleed: true });
      const frame = inset(b.page, m * 0.7);
      b.addPanel(frame, "#ffffff", { name: "Cadre", outline: 4 * u, radius: 0, opacity: 0.9 });
      if (b.hasText) {
        b.addScrim(rect(0, H * 0.5, W, H * 0.5));
        b.addTexts(rect(m * 1.8, H * 0.58, W * 0.6, H * 0.32), {
          align: "left",
          valign: "bottom",
          onPhoto: true,
          look: "caps",
          maxSize: 120,
        });
      }
      return true;
    },
  },
  {
    id: "p-polaroid-pin",
    name: "Polaroid épinglé",
    minMedia: 1,
    maxMedia: 1,
    build: (b) => {
      const { W, H, m } = dims(b);
      const box = b.addMedia(nth(b, 0), rect(W * 0.46, H * 0.08, W * 0.46, H * 0.86), {
        treatment: "polaroid",
        rotation: 5,
        scale: 0.94,
      });
      pin(b, box.x + box.width / 2, box.y + 22 * b.u);
      if (b.hasText)
        b.addTexts(rect(m * 1.6, H * 0.22, W * 0.38, H * 0.56), { align: "left", look: "highlight", maxSize: 120 });
      return true;
    },
  },
  {
    id: "p-stamp-big",
    name: "Grand timbre oblitéré",
    minMedia: 1,
    maxMedia: 1,
    prior: -0.1,
    build: (b) => {
      const { W, H, u } = dims(b);
      const c = b.theme.colors;
      const item = nth(b, 0);
      const box = b.addMedia(
        item,
        fitInside(rect(W * 0.08, H * 0.1, W * 0.46, H * 0.8), Math.min(1.3, item.aspect), 0.92),
        {
          treatment: "stamp",
          rotation: -4,
        },
      );
      // Tampon : deux cercles en tirets et trois ondes, à cheval sur le coin du timbre.
      const s = box.height * 0.42;
      const cx = box.x + box.width * 0.92;
      const cy = box.y + box.height * 0.18;
      b.addPanel(rect(cx - s / 2, cy - s / 2, s, s), c.accent, {
        name: "Tampon",
        shape: "circle",
        outline: 5 * u,
        dashed: true,
      });
      b.addPanel(rect(cx - s * 0.34, cy - s * 0.34, s * 0.68, s * 0.68), c.accent, {
        name: "Tampon",
        shape: "circle",
        outline: 3 * u,
      });
      for (let i = 0; i < 3; i++) {
        b.addPanel(rect(cx + s * 0.55, cy - s * 0.2 + i * s * 0.2, s * 0.9, 4 * u), c.accent, {
          name: "Onde",
          radius: 0,
          opacity: 0.8,
        });
      }
      if (b.hasText)
        b.addTexts(rect(W * 0.62, H * 0.38, W * 0.34, H * 0.5), { align: "left", look: "script", maxSize: 110 });
      return true;
    },
  },

  // ============================================================ Deux photos
  {
    id: "p-duo-cross",
    name: "Deux photos croisées",
    minMedia: 2,
    maxMedia: 2,
    freeOrder: true,
    build: (b) => {
      const { W, H } = dims(b);
      const a = b.addMedia(nth(b, 0), rect(W * 0.05, H * 0.1, W * 0.42, H * 0.74), { ...PAPER_BORDER, rotation: -8 });
      const c = b.addMedia(nth(b, 1), rect(W * 0.33, H * 0.22, W * 0.32, H * 0.7), { ...PAPER_BORDER, rotation: 7 });
      b.addTape(a.x + a.width * 0.2, a.y + 6 * b.u, a.width * 0.26, -20);
      b.addTape(c.x + c.width * 0.75, c.y + 6 * b.u, c.width * 0.3, 16);
      if (b.hasText)
        b.addTexts(rect(W * 0.69, H * 0.16, W * 0.27, H * 0.66), { align: "left", look: "script", maxSize: 110 });
      return true;
    },
  },
  {
    id: "p-duo-arch-circle",
    name: "Arche et médaillon",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { W, H } = dims(b);
      const c = b.theme.colors;
      b.addMedia(nth(b, 0), fitInside(rect(W * 0.05, H * 0.08, W * 0.36, H * 0.84), 0.72, 1), { treatment: "arch" });
      const s = H * 0.5;
      const circle = rect(W * 0.31, H * 0.4, s, s);
      b.addPanel(inset(circle, -s * 0.04), c.accent, { name: "Anneau", shape: "circle" });
      b.addMedia(nth(b, 1), circle, { treatment: "circle" });
      if (b.hasText)
        b.addTexts(rect(W * 0.64, H * 0.18, W * 0.32, H * 0.6), { align: "left", look: "gradient", maxSize: 120 });
      return true;
    },
  },
  {
    id: "p-duo-slash",
    name: "Avant / après en biais",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      const c = b.theme.colors;
      b.addMedia(nth(b, 0), rect(0, 0, W / 2, H), { bleed: true });
      b.addMedia(nth(b, 1), rect(W / 2, 0, W / 2, H), { bleed: true });
      b.addPanel(rect(W / 2 - 9 * u, -H * 0.1, 18 * u, H * 1.2), c.accent, {
        name: "Barre (déborde)",
        radius: 0,
        rotation: 8,
      });
      if (b.hasText) {
        const panel = rect(m, m, W * 0.34, H * 0.26);
        b.addPanel(panel, c.background, { opacity: 0.9, rotation: -3, shadow: true });
        b.addTexts(inset(panel, m * 0.5, m * 0.35), { look: "caps", rotation: -3, maxSize: 90 });
      }
      return true;
    },
  },
  {
    id: "p-duo-polaroid-dream",
    name: "Polaroid sur fond flou",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { W, H, m } = dims(b);
      b.addMedia(nth(b, 0), b.page, { treatment: "plain", feather: 150, shadow: false });
      if (b.hasText) b.addScrim(rect(0, H * 0.4, W, H * 0.6));
      const card = b.addMedia(nth(b, 1), rect(W * 0.58, H * 0.1, W * 0.34, H * 0.78), {
        treatment: "polaroid",
        rotation: 6,
      });
      b.addTape(card.x + card.width / 2, card.y + 8 * b.u, card.width * 0.34, 3);
      if (b.hasText) {
        b.addTexts(rect(m * 1.6, H * 0.56, W * 0.46, H * 0.36), {
          align: "left",
          valign: "bottom",
          onPhoto: true,
          look: "script",
          maxSize: 120,
        });
      }
      return true;
    },
  },
  {
    id: "p-duo-steps",
    name: "Deux marches",
    minMedia: 2,
    maxMedia: 2,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      b.addMedia(nth(b, 0), rect(m, m, W * 0.42, H * 0.5), { treatment: "rounded" });
      b.addMedia(nth(b, 1), rect(W * 0.36, H * 0.36, W * 0.52, H * 0.6), { treatment: "rounded", shadow: true });
      b.addSticker("arrow-doodle", rect(W * 0.12, H * 0.64, 190 * u, 190 * u), 10, "sway");
      if (b.hasText) {
        const used = b.addTexts(rect(W * 0.52, m, W * 0.44, H * 0.28), { align: "left", look: "caps", maxSize: 100 });
        if (used) b.addAccentBar(rect(used.x, used.y + used.height + b.gap, 120 * u, 8 * u));
      }
      return true;
    },
  },
  {
    id: "p-duo-film-vertical",
    name: "Pellicule verticale",
    minMedia: 2,
    maxMedia: 4,
    build: (b) => {
      const { W, H, u } = dims(b);
      const band = rect(W * 0.07, -H * 0.06, W * 0.27, H * 1.12);
      b.addPanel(band, "#111111", { name: "Pellicule (déborde)", radius: 0 });
      const hole = 16 * u;
      perforations(b, band.x + hole * 1.6, H / 2, H * 1.1, true);
      perforations(b, band.x + band.width - hole * 1.6, H / 2, H * 1.1, true);
      const inner = rect(band.x + hole * 3.6, H * 0.06, band.width - hole * 7.2, H * 0.88);
      grid(inner, 1, b.media.length, b.gap * 0.6).forEach((cell, i) => {
        b.addMedia(nth(b, i), cell, { treatment: "plain", shadow: false });
      });
      if (b.hasText) {
        const used = b.addTexts(rect(W * 0.42, H * 0.2, W * 0.52, H * 0.6), {
          align: "left",
          look: "caps",
          maxSize: 130,
        });
        if (used) b.addAccentBar(rect(used.x, used.y - b.gap * 2, 160 * u, 8 * u));
      }
      return true;
    },
  },

  // ============================================================ Trois photos
  {
    id: "p-trio-slope-line",
    name: "Corde en pente",
    minMedia: 2,
    maxMedia: 5,
    freeOrder: true,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      const n = b.media.length;
      const y0 = H * 0.16;
      const y1 = H * 0.07;
      const cordY = (x: number) => y0 + ((y1 - y0) * x) / W;
      link(b, -W * 0.02, cordY(-W * 0.02), W * 1.02, cordY(W * 1.02), b.theme.colors.accent, { width: 4 * u });
      const span = W * 0.84;
      const slotW = span / n;
      for (let i = 0; i < n; i++) {
        const cx = (W - span) / 2 + slotW * (i + 0.5);
        const top = cordY(cx) + 14 * u;
        const h = H * (n > 3 ? 0.46 : 0.56) * (i % 2 ? 0.88 : 1);
        const box = b.addMedia(nth(b, i), rect(cx - slotW * 0.45, top, slotW * 0.9, h), {
          treatment: "polaroid",
          rotation: i % 2 ? 4 : -4,
        });
        b.addPanel(
          rect(box.x + box.width / 2 - 8 * u, cordY(box.x + box.width / 2) - 14 * u, 16 * u, 34 * u),
          b.theme.colors.accent,
          {
            name: "Pince",
            radius: Math.round(4 * u),
          },
        );
      }
      if (b.hasText)
        b.addTexts(rect(m * 1.5, H * 0.76, W - m * 3, H * 0.19), { align: "left", look: "script", maxSize: 100 });
      return true;
    },
  },
  {
    id: "p-trio-cascade",
    name: "Cascade horizontale",
    minMedia: 3,
    maxMedia: 3,
    freeOrder: true,
    build: (b) => {
      const { W, H } = dims(b);
      b.addMedia(nth(b, 0), rect(W * 0.05, H * 0.1, W * 0.42, H * 0.7), { ...PAPER_BORDER, rotation: -3 });
      b.addMedia(nth(b, 1), rect(W * 0.3, H * 0.24, W * 0.34, H * 0.68), { ...PAPER_BORDER, rotation: 4 });
      b.addMedia(nth(b, 2), rect(W * 0.53, H * 0.06, W * 0.32, H * 0.6), { ...PAPER_BORDER, rotation: -2 });
      if (b.hasText)
        b.addTexts(rect(W * 0.67, H * 0.7, W * 0.29, H * 0.25), { align: "right", look: "caps", maxSize: 90 });
      return true;
    },
  },
  {
    id: "p-trio-orbit",
    name: "Médaillons en orbite",
    minMedia: 3,
    maxMedia: 3,
    freeOrder: true,
    build: (b) => {
      const { W, H, m } = dims(b);
      const c = b.theme.colors;
      const hero = rect(m, m, W * 0.5, H - m * 2);
      b.addMedia(nth(b, 0), hero, { treatment: "rounded" });
      const right = hero.x + hero.width;
      const s1 = H * 0.38;
      const s2 = H * 0.28;
      const c1 = rect(right - s1 * 0.45, H * 0.08, s1, s1);
      const c2 = rect(right - s2 * 0.3, H * 0.62, s2, s2);
      for (const [i, circle] of [c1, c2].entries()) {
        b.addPanel(inset(circle, -circle.width * 0.04), c.accent, { name: "Anneau", shape: "circle" });
        b.addMedia(nth(b, i + 1), circle, { treatment: "circle" });
      }
      if (b.hasText)
        b.addTexts(rect(W * 0.7, H * 0.24, W * 0.26, H * 0.52), { align: "left", look: "highlight", maxSize: 100 });
      return true;
    },
  },
  {
    id: "p-trio-columns",
    name: "Colonnes décalées",
    minMedia: 3,
    maxMedia: 3,
    build: (b) => {
      const { W, H } = dims(b);
      const cols = [
        rect(W * 0.05, H * 0.08, W * 0.22, H * 0.82),
        rect(W * 0.29, H * 0.18, W * 0.15, H * 0.56),
        rect(W * 0.46, H * 0.3, W * 0.19, H * 0.62),
      ];
      cols.forEach((cell, i) => {
        b.addMedia(nth(b, i), cell, { treatment: "rounded" });
      });
      if (b.hasText) {
        b.addTexts(rect(W * 0.69, H * 0.14, W * 0.27, H * 0.6), {
          align: "left",
          valign: "top",
          look: "caps",
          maxSize: 110,
        });
      }
      return true;
    },
  },
  {
    id: "p-constellation",
    name: "Constellation",
    minMedia: 3,
    maxMedia: 5,
    freeOrder: true,
    prior: -0.1,
    build: (b) => {
      const { W, H, m } = dims(b);
      const zone = rect(m, m, W * 0.64, H - m * 2);
      const spots: [number, number, number][] = [
        [0.24, 0.55, 0.25],
        [0.62, 0.24, 0.18],
        [0.8, 0.72, 0.2],
        [0.46, 0.86, 0.1],
        [0.94, 0.14, 0.09],
      ];
      const centers = b.media.map((_, i) => {
        const [x, y, r] = spots[i] as [number, number, number];
        return { x: zone.x + zone.width * x, y: zone.y + zone.height * y, s: zone.height * r * 2 };
      });
      // Les liens d'abord (sous les médaillons).
      for (let i = 0; i < centers.length - 1; i++) {
        const p = centers[i] as { x: number; y: number };
        const q = centers[i + 1] as { x: number; y: number };
        link(b, p.x, p.y, q.x, q.y, b.theme.colors.accent, { dotted: true, width: 7 * b.u });
      }
      centers.forEach(({ x, y, s }, i) => {
        b.addMedia(nth(b, i), rect(x - s / 2, y - s / 2, s, s), { treatment: "circle" });
      });
      b.addSticker("star", rect(zone.x + zone.width * 0.05, zone.y, 70 * b.u, 70 * b.u), 0, "float");
      if (b.hasText)
        b.addTexts(rect(W * 0.7, H * 0.2, W * 0.26, H * 0.6), { align: "left", look: "gradient", maxSize: 110 });
      return true;
    },
  },
  {
    id: "p-book",
    name: "Livre ouvert",
    minMedia: 1,
    maxMedia: 4,
    build: (b) => {
      const { W, H, u } = dims(b);
      const left = rect(W * 0.06, H * 0.1, W * 0.44, H * 0.8);
      const right = rect(W * 0.5, H * 0.1, W * 0.44, H * 0.8);
      b.addPanel(left, PAPER, { name: "Page", radius: Math.round(6 * u), rotation: -1.5, shadow: true });
      b.addPanel(right, PAPER, { name: "Page", radius: Math.round(6 * u), rotation: 1.5, shadow: true });
      b.addPanel(rect(W * 0.5 - 14 * u, H * 0.1, 28 * u, H * 0.8), "rgba(0,0,0,0.25)", {
        name: "Pli",
        radius: 0,
        gradientTo: "rgba(0,0,0,0)",
        gradientAngle: 90,
      });
      b.addMedia(nth(b, 0), inset(left, left.width * 0.08, left.height * 0.08), {
        mode: "fit",
        treatment: "plain",
        rotation: -1.5,
        shadow: false,
      });
      const others = b.media.length - 1;
      const inner = inset(right, right.width * 0.08, right.height * 0.08);
      const textTop = others > 0 ? inner.y + inner.height * 0.5 : inner.y;
      if (others > 0) {
        grid(rect(inner.x, inner.y, inner.width, inner.height * 0.46), others, 1, b.gap * 0.5).forEach((cell, i) => {
          b.addMedia(nth(b, i + 1), cell, { mode: "fit", treatment: "plain", rotation: 1.5, shadow: false });
        });
      }
      if (b.hasText) {
        b.addTexts(rect(inner.x, textTop, inner.width, inner.y + inner.height - textTop), {
          colors: INK,
          look: "script",
          align: "left",
          rotation: 1.5,
          maxSize: 90,
        });
      }
      return true;
    },
  },

  // ============================================================ Plusieurs photos
  {
    id: "p-scrapbook",
    name: "Album scrapbook",
    minMedia: 3,
    maxMedia: 6,
    freeOrder: true,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      b.addPanel(b.page, PAPER, { name: "Papier", radius: 0 });
      const zone = rect(m, m, W * 0.68, H - m * 2);
      jumbled(zone, b.media.length, b.gap * 0.6, avgAspect(b.media)).forEach(({ box, rotation }, i) => {
        const placed = b.addMedia(
          nth(b, i),
          box,
          i % 3 === 1
            ? { treatment: "polaroid", rotation }
            : { mode: "fit", treatment: "plain", rotation, shadow: true },
        );
        b.addTape(
          placed.x + placed.width * (i % 2 ? 0.2 : 0.8),
          placed.y + 4 * u,
          placed.width * 0.28,
          i % 2 ? -18 : 16,
        );
      });
      b.addSticker("hearts", rect(W * 0.66, H * 0.08, 120 * u, 120 * u), 10, "float");
      if (b.hasText) {
        b.addTexts(rect(W * 0.73, H * 0.28, W * 0.23, H * 0.5), {
          colors: INK,
          look: "script",
          align: "left",
          rotation: -2,
          maxSize: 100,
        });
        b.addSticker("arrow-curve", rect(W * 0.7, H * 0.76, 130 * u, 130 * u), 200, "sway");
      }
      return true;
    },
  },
  {
    id: "p-brick-rows",
    name: "Rangées décalées",
    minMedia: 4,
    maxMedia: 8,
    build: (b) => {
      const { W, H, m } = dims(b);
      const n = b.media.length;
      const top = Math.ceil(n / 2);
      const h = (b.hasText ? H * 0.66 : H - m * 2 - b.gap) / 2;
      const rows = [
        ...grid(rect(m, m, W * 0.84 - m, h), top, 1, b.gap),
        ...grid(rect(W * 0.16, m + h + b.gap, W * 0.84 - m, h), n - top, 1, b.gap),
      ];
      rows.forEach((cell, i) => {
        b.addMedia(nth(b, i), cell, { treatment: "rounded" });
      });
      if (b.hasText)
        b.addTexts(rect(m * 1.5, m + h * 2 + b.gap * 2.5, W * 0.6, H - (m + h * 2 + b.gap * 2.5) - m * 0.6), {
          align: "left",
          look: "caps",
          maxSize: 90,
        });
      return true;
    },
  },
  {
    id: "p-diagonal-row",
    name: "Rangée en diagonale",
    minMedia: 3,
    maxMedia: 6,
    freeOrder: true,
    build: (b) => {
      const { W, H, m } = dims(b);
      const n = b.media.length;
      // Moins de photos (ou 21:9, où la diagonale est plus longue) : photos plus grandes.
      const k = Math.min(1.3, Math.max(1, W / H / 1.78) * (n <= 3 ? 1.18 : n === 4 ? 1.08 : 1));
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const s = H * (0.3 + 0.18 * t) * k;
        const cx = W * (0.13 + 0.63 * t);
        const cy = H * (0.27 + 0.39 * t);
        b.addMedia(nth(b, i), rect(cx - s * 0.6, cy - s / 2, s * 1.2, s), {
          ...PAPER_BORDER,
          rotation: i % 2 ? 4 : -4,
        });
      }
      if (b.hasText) {
        const hasTitle = b.pickTexts("title").length > 0;
        b.addTexts(rect(W * 0.6, m, W * 0.4 - m, H * 0.22), {
          pick: hasTitle ? "title" : undefined,
          align: "right",
          look: "caps",
          maxSize: 110,
        });
        if (hasTitle)
          b.addTexts(rect(m * 1.5, H * 0.72, W * 0.32, H * 0.22), { pick: "rest", align: "left", look: "script" });
      }
      return true;
    },
  },
  {
    id: "p-polaroid-wall",
    name: "Mur de polaroids penché",
    minMedia: 4,
    maxMedia: 9,
    freeOrder: true,
    build: (b) => {
      const { W, H, m } = dims(b);
      const zone = rect(m, m, W * 0.68, H - m * 2);
      const cx = zone.x + zone.width / 2;
      const cy = zone.y + zone.height / 2;
      const angle = -4;
      grid(zone, Math.ceil(b.media.length / 2), 2, b.gap).forEach((cell, i) => {
        if (i >= b.media.length) return;
        const p = rotateAround(cell.x + cell.width / 2, cell.y + cell.height / 2, cx, cy, angle);
        const w = cell.width * 0.92;
        const h = cell.height * 0.92;
        b.addMedia(nth(b, i), rect(p.x - w / 2, p.y - h / 2, w, h), { treatment: "polaroid", rotation: angle });
      });
      if (b.hasText) noteCard(b, rect(W * 0.73, H * 0.24, W * 0.23, H * 0.48), 4);
      return true;
    },
  },
  {
    id: "p-bubbles",
    name: "Grappe de bulles",
    minMedia: 3,
    maxMedia: 6,
    freeOrder: true,
    build: (b) => {
      const { W, H, m } = dims(b);
      const zone = rect(m, m, W * 0.64, H - m * 2);
      const spots: [number, number, number][] = [
        [0.36, 0.48, 0.4],
        [0.78, 0.3, 0.24],
        [0.74, 0.78, 0.2],
        [0.12, 0.14, 0.13],
        [0.1, 0.84, 0.12],
        [0.95, 0.55, 0.11],
      ];
      b.media.forEach((item, i) => {
        const [x, y, r] = spots[i] as [number, number, number];
        const s = zone.height * r * 2;
        b.addMedia(item, rect(zone.x + zone.width * x - s / 2, zone.y + zone.height * y - s / 2, s, s), {
          treatment: "circle",
          loop: i > 0 ? "float" : undefined,
        });
      });
      if (b.hasText)
        b.addTexts(rect(W * 0.7, H * 0.2, W * 0.26, H * 0.6), { align: "left", look: "gradient", maxSize: 110 });
      return true;
    },
  },
  {
    id: "p-hero-film",
    name: "Une grande et sa pellicule",
    minMedia: 3,
    maxMedia: 6,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      b.addMedia(nth(b, 0), rect(m, m, W * 0.48, H - m * 2), { treatment: "rounded" });
      const band = rect(W * 0.54, -H * 0.06, W * 0.15, H * 1.12);
      b.addPanel(band, "#111111", { name: "Pellicule (déborde)", radius: 0 });
      const hole = 14 * u;
      perforations(b, band.x + hole * 1.5, H / 2, H * 1.1, true);
      perforations(b, band.x + band.width - hole * 1.5, H / 2, H * 1.1, true);
      const inner = rect(band.x + hole * 3.4, H * 0.05, band.width - hole * 6.8, H * 0.9);
      grid(inner, 1, b.media.length - 1, b.gap * 0.5).forEach((cell, i) => {
        b.addMedia(nth(b, i + 1), cell, { treatment: "plain", shadow: false });
      });
      if (b.hasText)
        b.addTexts(rect(W * 0.72, H * 0.2, W * 0.25, H * 0.6), { align: "left", look: "caps", maxSize: 100 });
      return true;
    },
  },
  {
    id: "p-tilted-spiral",
    name: "Spirale penchée",
    minMedia: 3,
    maxMedia: 6,
    freeOrder: true,
    build: (b) => {
      const { W, H, m } = dims(b);
      const zone = rect(m * 1.4, m * 1.4, W * 0.66, H - m * 2.8);
      goldenSplit(zone, b.media.length, b.gap * 1.2).forEach((cell, i) => {
        b.addMedia(nth(b, i), cell, { treatment: "border", rotation: i % 2 ? 2 : -3 });
      });
      if (b.hasText)
        b.addTexts(rect(W * 0.73, H * 0.22, W * 0.23, H * 0.56), { align: "left", look: "script", maxSize: 100 });
      return true;
    },
  },
  {
    id: "p-zigzag",
    name: "Zigzag",
    minMedia: 4,
    maxMedia: 7,
    freeOrder: true,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      const n = b.media.length;
      const top = b.hasText ? H * 0.3 : m;
      const band = rect(m, top, W - m * 2, H - top - m);
      const h = band.height * 0.56;
      const w = Math.min(h * 1.25, (band.width / n) * 1.35);
      const pts = b.media.map((_, i) => ({
        x: band.x + w / 2 + ((band.width - w) * i) / (n - 1),
        y: i % 2 ? band.y + band.height - h / 2 : band.y + h / 2,
      }));
      for (let i = 0; i < n - 1; i++) {
        const p = pts[i] as { x: number; y: number };
        const q = pts[i + 1] as { x: number; y: number };
        link(b, p.x, p.y, q.x, q.y, b.theme.colors.accent, { dashed: true, width: 5 * u });
      }
      pts.forEach((p, i) => {
        b.addMedia(nth(b, i), rect(p.x - w / 2, p.y - h / 2, w, h), { ...PAPER_BORDER, rotation: i % 2 ? 3 : -3 });
      });
      if (b.hasText) {
        const hasTitle = b.pickTexts("title").length > 0;
        b.addTexts(rect(m * 1.4, m * 0.8, W * 0.55, H * 0.22), {
          pick: hasTitle ? "title" : undefined,
          align: "left",
          look: "caps",
          maxSize: 110,
        });
        if (hasTitle)
          b.addTexts(rect(W * 0.6, m * 0.8, W * 0.36, H * 0.22), { pick: "rest", align: "right", look: "script" });
      }
      return true;
    },
  },
  {
    id: "p-big-collage",
    name: "Grand collage et petit mot",
    minMedia: 5,
    maxMedia: 10,
    freeOrder: true,
    build: (b) => {
      const { W, H } = dims(b);
      freeMosaic(b.page, b.media.length, Math.round(b.gap * 0.25)).forEach((cell, i) => {
        b.addMedia(nth(b, i), cell, { bleed: true });
      });
      if (b.hasText) noteCard(b, rect(W * 0.56, H * 0.52, W * 0.3, H * 0.36), -4);
      return true;
    },
  },
  {
    id: "p-contact-tilt",
    name: "Planche contact posée",
    minMedia: 5,
    maxMedia: 10,
    freeOrder: true,
    build: (b) => {
      const { W, H, u } = dims(b);
      const sheet = rect(W * 0.04, H * 0.08, W * 0.64, H * 0.84);
      const angle = -3;
      b.addPanel(sheet, "#141414", { name: "Planche", radius: Math.round(6 * u), rotation: angle, shadow: true });
      const cx = sheet.x + sheet.width / 2;
      const cy = sheet.y + sheet.height / 2;
      const n = b.media.length;
      const cols = n <= 6 ? 3 : n <= 8 ? 4 : n === 9 ? 3 : 4;
      const cells = grid(inset(sheet, sheet.width * 0.05, sheet.height * 0.07), cols, Math.ceil(n / cols), b.gap * 0.7);
      cells.slice(0, n).forEach((cell, i) => {
        const p = rotateAround(cell.x + cell.width / 2, cell.y + cell.height / 2, cx, cy, angle);
        const box = rect(p.x - cell.width / 2, p.y - cell.height / 2, cell.width, cell.height);
        b.addMedia(nth(b, i), box, { treatment: "plain", rotation: angle, shadow: false });
        // Le coup de crayon gras autour de la photo « choisie », comme sur une vraie planche.
        if (i === 0) {
          b.addPanel(inset(box, -b.gap * 0.6), b.theme.colors.accent, {
            name: "Sélection",
            shape: "circle",
            outline: 6 * u,
            rotation: angle - 4,
          });
        }
      });
      if (b.hasText) noteCard(b, rect(W * 0.71, H * 0.26, W * 0.25, H * 0.46), 4);
      return true;
    },
  },
  {
    id: "p-memory-wall",
    name: "Mur de souvenirs",
    minMedia: 6,
    maxMedia: 10,
    freeOrder: true,
    build: (b) => {
      const { W, H, m, u } = dims(b);
      const zone = rect(m, m, W * 0.7, H - m * 2);
      const c = b.theme.colors;
      jumbled(zone, b.media.length, b.gap * 0.5, avgAspect(b.media)).forEach(({ box, rotation }, i) => {
        const kind = i % 5;
        const opts: MediaOptions =
          kind === 0
            ? { treatment: "polaroid" }
            : kind === 1
              ? { treatment: "circle" }
              : kind === 2
                ? { mode: "fit", treatment: "border", borderColor: c.accent, borderStyle: "dotted", borderWidth: 0.025 }
                : kind === 3
                  ? { mode: "fit", treatment: "rounded" }
                  : { mode: "fit", treatment: "border" };
        b.addMedia(nth(b, i), kind === 1 ? squareIn(box, 0.95) : box, { ...opts, rotation: kind === 1 ? 0 : rotation });
      });
      b.addSticker("sparkle", rect(zone.x + zone.width * 0.45, zone.y - 20 * u, 90 * u, 90 * u), 0, "float");
      b.addSticker("star", rect(zone.x + zone.width * 0.9, zone.y + zone.height * 0.85, 70 * u, 70 * u), 15, "sway");
      if (b.hasText) noteCard(b, rect(W * 0.74, H * 0.24, W * 0.22, H * 0.5), -3);
      return true;
    },
  },
];

export const LANDSCAPE_LAYOUTS: LayoutDef[] = DEFS.map(wideOnly);
