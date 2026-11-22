import { headingLayerIds, type ImageLayer, type Scene } from "@app/schema";

/**
 * Contenu d'une page, tel que l'utilisateur le pose dans la fenêtre « Nouvelle page »
 * (ou tel qu'on le retrouve dans une scène existante, pour « Changer de mise en page »).
 * Le moteur de mise en page (`propose.ts`) en fait des scènes.
 */
export type TextRole = "title" | "subtitle" | "body";

export interface TextItem {
  kind: "text";
  id: string;
  text: string;
  /** null = deviné d'après la longueur et l'ordre (`resolveRoles`). */
  role: TextRole | null;
}

export interface ImageItem {
  kind: "image";
  id: string;
  src: string;
  /** Largeur / hauteur de la photo. */
  aspect: number;
  name: string;
  /** Réglages repris d'une scène existante (filtres de couleur). */
  filter?: ImageLayer["filter"];
}

export interface VideoItem {
  kind: "video";
  id: string;
  src: string;
  aspect: number;
  name: string;
  durationSeconds: number | null;
  /** Réglages repris d'une scène existante. */
  keep?: { trimStartFrames: number; volume: number; muted: boolean; playbackRate: number };
}

export type MediaItem = ImageItem | VideoItem;
export type ContentItem = TextItem | MediaItem;

export const MAX_MEDIA = 10;
export const MAX_TEXTS = 3;

export type Orientation = "landscape" | "portrait" | "square";

export function orientationOf(aspect: number): Orientation {
  if (aspect > 1.15) return "landscape";
  if (aspect < 0.87) return "portrait";
  return "square";
}

/** Un texte court (≤ 60 caractères, une ligne) peut être un titre ; ≤ 40, un sous-titre. */
const isShort = (t: string, max = 60) => t.trim().length <= max && !t.includes("\n");

/**
 * Rôle de chaque texte : ceux choisis à la main sont gardés ; pour les autres, le premier
 * texte court devient le titre, un texte court suivant le sous-titre, les longs du texte courant.
 */
export function resolveRoles(texts: TextItem[]): (TextItem & { role: TextRole })[] {
  let hasTitle = texts.some((t) => t.role === "title");
  let hasSubtitle = texts.some((t) => t.role === "subtitle");
  const resolved = texts.map((t) => {
    if (t.role) return { ...t, role: t.role };
    let role: TextRole = "body";
    if (isShort(t.text) && !hasTitle) {
      role = "title";
      hasTitle = true;
    } else if (isShort(t.text, 40) && !hasSubtitle) {
      role = "subtitle";
      hasSubtitle = true;
    }
    return { ...t, role };
  });
  // Aucun texte court : le premier devient quand même le titre s'il est seul.
  if (!hasTitle && resolved.length === 1 && resolved[0]) resolved[0].role = "title";
  return resolved;
}

/** Ordre d'affichage : titre, sous-titre, puis textes courants dans l'ordre d'origine. */
export function orderTexts<T extends { role: TextRole }>(texts: T[]): T[] {
  const rank = { title: 0, subtitle: 1, body: 2 } as const;
  return texts
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank[a.t.role] - rank[b.t.role] || a.i - b.i)
    .map(({ t }) => t);
}

/** Les stickers (SVG intégrés) sont de la décoration : on ne les considère pas comme des photos. */
const isSticker = (src: string) => src.startsWith("data:");

/**
 * Contenu d'une scène existante : photos et vidéos (de haut en bas, de gauche à droite),
 * textes avec leur rôle (le plus grand = titre). Formes et stickers sont laissés de côté :
 * la nouvelle mise en page apporte sa propre décoration.
 */
export function sceneToContent(scene: Scene): ContentItem[] {
  const headings = headingLayerIds(scene);
  // Ordre de lecture : par lignes (centres à moins d'une demi-hauteur = même ligne), puis de gauche à droite.
  const byPosition = [...scene.layers].sort((a, b) => {
    const ta = a.transform;
    const tb = b.transform;
    const dy = ta.y + ta.height / 2 - (tb.y + tb.height / 2);
    if (Math.abs(dy) > Math.min(ta.height, tb.height) / 2) return dy;
    return ta.x + ta.width / 2 - (tb.x + tb.width / 2);
  });
  const media: MediaItem[] = [];
  const texts: TextItem[] = [];
  let titleTaken = false;

  for (const layer of byPosition) {
    if (layer.type === "image" && layer.src && !isSticker(layer.src)) {
      media.push({
        kind: "image",
        id: layer.id,
        src: layer.src,
        aspect: layer.imageAspect ?? layer.transform.width / layer.transform.height,
        name: layer.name,
        filter: layer.filter,
      });
    } else if (layer.type === "video") {
      media.push({
        kind: "video",
        id: layer.id,
        src: layer.src,
        aspect: layer.transform.width / layer.transform.height,
        name: layer.name,
        durationSeconds: layer.sourceDurationSeconds,
        keep: {
          trimStartFrames: layer.trimStartFrames,
          volume: layer.volume,
          muted: layer.muted,
          playbackRate: layer.playbackRate,
        },
      });
    } else if (layer.type === "text" && layer.text.trim()) {
      let role: TextRole = "body";
      if (headings.has(layer.id) && !titleTaken) {
        role = "title";
        titleTaken = true;
      } else if (isShort(layer.text, 40)) {
        role = "subtitle";
      }
      texts.push({ kind: "text", id: layer.id, text: layer.text, role });
    }
  }
  // Photo de fond : c'est aussi du contenu, s'il n'y a pas d'autre photo.
  if (media.length === 0 && scene.background.type === "image") {
    media.push({ kind: "image", id: `${scene.id}-bg`, src: scene.background.src, aspect: 16 / 9, name: "Fond" });
  }
  // Un seul sous-titre : les suivants deviennent du texte courant.
  let subtitleSeen = false;
  for (const t of texts) {
    if (t.role !== "subtitle") continue;
    if (subtitleSeen) t.role = "body";
    subtitleSeen = true;
  }
  // Une photo nettement plus grande que les autres (mise en avant) reste la n° 1,
  // les autres suivent l'ordre de lecture.
  const area = (m: MediaItem) => {
    const l = scene.layers.find((x) => x.id === m.id);
    return l ? l.transform.width * l.transform.height : 0;
  };
  const sizes = media.map(area);
  const sorted = [...sizes].sort((x, y) => y - x);
  const ranked = [...media];
  // (seuil élevé : dans une mosaïque ajustée, une photo paysage est naturellement plus grande)
  if (media.length > 1 && (sorted[0] as number) >= 2.2 * (sorted[1] as number)) {
    const [hero] = ranked.splice(sizes.indexOf(sorted[0] as number), 1);
    if (hero) ranked.unshift(hero);
  }
  return [...ranked.slice(0, MAX_MEDIA), ...texts.slice(0, MAX_TEXTS)];
}
