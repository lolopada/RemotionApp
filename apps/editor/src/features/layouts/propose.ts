import { type BackgroundInput, createScene, type ProjectFormat, type Scene, type Theme } from "@app/schema";
import { DEFAULT_THEME, LAYOUT_STYLES, type LayoutStyle, PageBuilder } from "./builder";
import {
  type ContentItem,
  MAX_MEDIA,
  MAX_TEXTS,
  type MediaItem,
  orderTexts,
  resolveRoles,
  type TextItem,
} from "./content";
import { LAYOUTS, type LayoutDef } from "./library";

export interface Proposal {
  /** Identifiant stable (disposition + style), pour React et les tests. */
  key: string;
  layoutId: string;
  layoutName: string;
  styleId: string;
  styleName: string;
  score: number;
  scene: Scene;
}

/** Fond de la page selon le style (la photo floutée a besoin d'une photo, sinon dégradé). */
function styleBackground(style: LayoutStyle, theme: Theme, media: MediaItem[]): BackgroundInput {
  const c = theme.colors;
  switch (style.background) {
    case "solid":
      return { type: "color", color: c.background };
    case "pattern":
      return { type: "pattern", pattern: "dots", base: c.background, ink: c.background2, size: 56, thickness: 0.16 };
    case "radial":
      return { type: "gradient", kind: "radial", colors: [c.background2, c.background], radius: 1.1 };
    case "motion":
      return {
        type: "gradient",
        colors: [c.background, c.background2, c.accent],
        angle: 135,
        motion: { enabled: true },
      };
    case "photo": {
      const photo = media.find((m) => m.kind === "image");
      if (photo) {
        return {
          type: "image",
          src: photo.src,
          blur: 36,
          veil: { enabled: true, color: c.background, opacity: 0.6, mode: "solid" },
        };
      }
      return { type: "gradient", colors: [c.background, c.background2], angle: 160 };
    }
    default:
      return { type: "gradient", colors: [c.background, c.background2], angle: 135 };
  }
}

/** Format du projet + durée choisie par l'utilisateur pour chaque page (`defaultSceneSeconds`). */
export type PageFormat = ProjectFormat & { sceneSeconds?: number | null };

/**
 * Durée d'une nouvelle page : celle choisie par l'utilisateur si elle existe (sans couper une
 * vidéo), sinon la durée conseillée : de quoi voir les photos et lire les textes
 * (3 à 12 s, plus pour une vidéo).
 */
export function suggestedDurationSeconds(media: MediaItem[], texts: TextItem[], chosen?: number | null): number {
  const video = Math.max(0, ...media.map((m) => (m.kind === "video" ? (m.durationSeconds ?? 0) : 0)));
  if (chosen) return Math.max(chosen, video);
  const words = texts.reduce((n, t) => n + t.text.trim().split(/\s+/).filter(Boolean).length, 0);
  let seconds = 3 + media.length * 0.5 + words / 4;
  seconds = Math.min(12, Math.max(3, seconds));
  if (video > 0) seconds = Math.max(seconds, Math.min(15, video));
  return Math.round(seconds * 2) / 2;
}

function split(content: ContentItem[]) {
  const media = content.filter((c): c is MediaItem => c.kind !== "text").slice(0, MAX_MEDIA);
  const rawTexts = content.filter((c): c is TextItem => c.kind === "text" && c.text.trim() !== "").slice(0, MAX_TEXTS);
  return { media, rawTexts, texts: orderTexts(resolveRoles(rawTexts)) };
}

/** Dispositions qui acceptent ce contenu. */
export function applicableLayouts(content: ContentItem[]): LayoutDef[] {
  const { media, texts } = split(content);
  if (media.length === 0 && texts.length === 0) return [];
  return LAYOUTS.filter(
    (l) => media.length >= l.minMedia && media.length <= l.maxMedia && (!l.needsText || texts.length > 0),
  );
}

/** Construit une page (disposition × style). null si la disposition refuse ce contenu. */
export function buildPage(
  layout: LayoutDef,
  style: LayoutStyle,
  content: ContentItem[],
  format: PageFormat,
  theme: Theme | null,
): Proposal | null {
  const { media, rawTexts, texts } = split(content);
  const t = theme ?? DEFAULT_THEME;
  const b = new PageBuilder(format, t, style, media, texts);
  if (layout.build(b) === false) return null;
  b.animate();
  const title = texts
    .find((x) => x.role === "title")
    ?.text.trim()
    .split("\n")[0];
  const scene = createScene({
    name: title ? title.slice(0, 40) : layout.name,
    durationInFrames: Math.round(suggestedDurationSeconds(media, rawTexts, format.sceneSeconds) * format.fps),
    background: b.background ?? styleBackground(style, t, media),
    transitionIn: { kind: "fade", durationInFrames: Math.round(format.fps * 0.6) },
    layers: b.layers,
  });
  return {
    key: `${layout.id}:${style.id}`,
    layoutId: layout.id,
    layoutName: layout.name,
    styleId: style.id,
    styleName: style.name,
    score: b.score + (layout.prior ?? 0),
    scene,
  };
}

/**
 * Toutes les propositions pour ce contenu, des plus adaptées aux moins adaptées.
 * Ordre : on classe les dispositions par note, puis on fait des « tours » : au tour r, chaque
 * disposition reçoit un style différent (décalé selon son rang). La première page de
 * propositions montre donc les meilleures dispositions, chacune avec un style varié ;
 * « Autres idées » fait défiler les tours suivants.
 */
export function proposeAll(content: ContentItem[], format: PageFormat, theme: Theme | null): Proposal[] {
  const layouts = applicableLayouts(content);
  const S = LAYOUT_STYLES.length;
  // Note d'une disposition = celle de son premier style (les styles changent peu la géométrie).
  const ranked = layouts
    .map((layout, index) => ({
      layout,
      index,
      best: buildPage(layout, LAYOUT_STYLES[0] as LayoutStyle, content, format, theme),
    }))
    .filter((r) => r.best !== null)
    .sort((a, b) => (b.best as Proposal).score - (a.best as Proposal).score || a.index - b.index);
  // Les dispositions vraiment inadaptées (photos très rognées, texte illisible) passent à la fin.
  const good = ranked.filter((r) => (r.best as Proposal).score > -2.5);
  const ordered = good.length > 0 ? [...good, ...ranked.filter((r) => !good.includes(r))] : ranked;

  const out: Proposal[] = [];
  for (let round = 0; round < S; round++) {
    ordered.forEach(({ layout }, rank) => {
      const style = LAYOUT_STYLES[(rank + round) % S] as LayoutStyle;
      const p = buildPage(layout, style, content, format, theme);
      if (p) out.push(p);
    });
  }
  return out;
}

/** Une « page » de propositions (6 par défaut) ; `page` fait le tour quand on arrive au bout. */
export function proposeLayouts(
  content: ContentItem[],
  format: PageFormat,
  theme: Theme | null,
  page = 0,
  count = 6,
): Proposal[] {
  const all = proposeAll(content, format, theme);
  if (all.length <= count) return all;
  const pages = Math.ceil(all.length / count);
  const start = (page % pages) * count;
  return all.slice(start, start + count);
}

/**
 * Remplace la mise en page d'une scène existante par une proposition, en gardant son
 * identité (id, nom, durée, transition d'entrée). Mute la scène.
 */
export function relayoutScene(target: Scene, proposal: Proposal): void {
  // Un nom donné automatiquement (nom d'une disposition) suit la nouvelle disposition.
  if (LAYOUTS.some((l) => l.name === target.name)) target.name = proposal.scene.name;
  target.layers = proposal.scene.layers;
  target.background = proposal.scene.background;
}
