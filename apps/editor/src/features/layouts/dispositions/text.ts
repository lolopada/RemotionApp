import { fitInside, inset, isWide, type Rect, rect, splitY } from "../fit";
import { type LayoutDef, titleAndRest } from "./helpers";

/** Forme décorative centrale : ovale qui suit la page, sans devenir trop étirée en portrait. */
function centralShape(page: Rect, margin: number, scale: number): Rect {
  const area = inset(page, margin);
  const aspect = Math.min(1.6, Math.max(0.85, area.width / area.height));
  return fitInside(area, aspect, scale);
}

/** Pages sans photo : un titre, un sous-titre, un texte. */
export const TEXT_LAYOUTS: LayoutDef[] = [
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
  {
    id: "text-band",
    name: "Bandeau",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    prior: 0.1,
    build: (b) => {
      const h = b.f.height * (isWide(b.f) ? 0.46 : 0.36);
      const band = rect(0, (b.f.height - h) / 2, b.f.width, h);
      b.addPanel(band, b.theme.colors.background2, { opacity: 0.9, radius: 0, name: "Bandeau" });
      const line = 6 * b.u;
      b.addPanel(rect(0, band.y - line * 3, b.f.width, line), b.theme.colors.accent, { radius: 0, name: "Trait" });
      b.addPanel(rect(0, band.y + band.height + line * 2, b.f.width, line), b.theme.colors.accent, {
        radius: 0,
        name: "Trait",
      });
      b.addTexts(inset(band, b.m * 2, b.m * 0.6), { maxSize: 120 });
      return true;
    },
  },
  {
    id: "text-frame",
    name: "Double cadre",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const c = b.theme.colors.accent;
      const outer = inset(b.page, b.m * 1.2);
      b.addPanel(outer, c, { outline: 5 * b.u, radius: 0, name: "Cadre" });
      b.addPanel(inset(outer, b.m * 0.35), c, { outline: 2 * b.u, radius: 0, name: "Cadre", opacity: 0.7 });
      b.addTexts(inset(outer, b.m * 1.6), { maxSize: 120 });
      return true;
    },
  },
  {
    id: "text-badge",
    name: "Pastille",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      // Ovale qui suit la page : plus de place pour le texte qu'un rond.
      const disc = centralShape(b.page, b.m, 0.92);
      b.addPanel(disc, b.theme.colors.accent, { shape: "circle", opacity: 0.22, name: "Pastille" });
      b.addPanel(inset(disc, -disc.width * 0.03), b.theme.colors.accent, {
        shape: "circle",
        outline: 3 * b.u,
        opacity: 0.6,
        name: "Anneau",
      });
      // Rectangle inscrit dans l'ovale (≈ 70 %) : le texte reste dedans.
      b.addTexts(inset(disc, disc.width * 0.15, disc.height * 0.17), { maxSize: 120 });
      return true;
    },
  },
  {
    id: "text-two-tone",
    name: "Deux tons",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const [top, bottom] = splitY(b.page, 0.55);
      b.addPanel(bottom, b.theme.colors.background2, { radius: 0, name: "Bas de page" });
      const zone = inset(b.page, b.m * 2.2, 0);
      titleAndRest(
        b,
        rect(zone.x, top.y + b.m * 1.5, zone.width, top.height - b.m * 2.2),
        rect(zone.x, bottom.y + b.m * 0.8, zone.width, bottom.height - b.m * 2),
        { valign: "bottom", maxSize: 150, align: "left" },
        { valign: "top", maxSize: 90, align: "left" },
      );
      return true;
    },
  },
  {
    id: "text-corner",
    name: "Titre en haut, rond en bas",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const s = Math.min(b.f.width, b.f.height) * 0.75;
      b.addPanel(rect(b.f.width - s * 0.7, b.f.height - s * 0.7, s, s), b.theme.colors.accent, {
        shape: "circle",
        opacity: 0.85,
        name: "Décor (déborde)",
      });
      b.addTexts(rect(b.m * 2, b.m * 2, b.f.width * 0.72 - b.m * 2, b.f.height * 0.6), {
        align: "left",
        valign: "top",
        maxSize: 140,
      });
      return true;
    },
  },
  {
    id: "text-burst",
    name: "Étoile",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    prior: -0.2,
    build: (b) => {
      const star = centralShape(b.page, b.m * 0.5, 1);
      b.addPanel(star, b.theme.colors.accent, { shape: "burst", opacity: 0.9, name: "Étoile" });
      b.addTexts(inset(star, star.width * 0.22, star.height * 0.25), { maxSize: 110 });
      return true;
    },
  },
  {
    id: "text-lines",
    name: "Entre deux traits",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    build: (b) => {
      const zone = inset(b.page, b.m * 2.6, b.m * 2.6);
      const used = b.addTexts(zone, { maxSize: 120 });
      if (used) {
        const w = Math.min(zone.width, Math.max(used.width * 0.5, 300 * b.u));
        const x = b.f.width / 2 - w / 2;
        const t = 4 * b.u;
        b.addPanel(rect(x, used.y - b.gap * 1.6, w, t), b.theme.colors.accent, { radius: 0, name: "Trait" });
        b.addPanel(rect(x, used.y + used.height + b.gap * 1.6, w, t), b.theme.colors.accent, {
          radius: 0,
          name: "Trait",
        });
      }
      return true;
    },
  },
  {
    id: "text-confetti",
    name: "Confettis",
    minMedia: 0,
    maxMedia: 0,
    needsText: true,
    prior: -0.1,
    build: (b) => {
      const { width: W, height: H } = b.f;
      const s = Math.min(W, H);
      // Ronds posés près des bords (positions fixes, proportionnelles à la page).
      const dots: [number, number, number, number][] = [
        [0.08, 0.12, 0.09, 0.9],
        [0.86, 0.1, 0.05, 0.6],
        [0.9, 0.78, 0.11, 0.8],
        [0.12, 0.84, 0.06, 0.5],
        [0.72, 0.9, 0.035, 0.7],
        [0.3, 0.06, 0.03, 0.6],
      ];
      dots.forEach(([x, y, r, o], i) => {
        const d = s * r;
        b.addPanel(
          rect(W * x - d / 2, H * y - d / 2, d, d),
          i % 2 ? b.theme.colors.background2 : b.theme.colors.accent,
          {
            shape: "circle",
            opacity: o,
            name: "Confetti",
          },
        );
      });
      b.addTexts(inset(b.page, b.m * 3, b.m * 2.6), { maxSize: 130 });
      return true;
    },
  },
];
