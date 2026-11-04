import {
  type BackgroundInput,
  createImageLayer,
  createShapeLayer,
  createTextLayer,
  createVideoLayer,
  type EnterAnimation,
  type Layer,
  type ProjectFormat,
  type Theme,
} from "@app/schema";
import type { MediaItem, TextItem, TextRole } from "./content";
import {
  aspectMismatch,
  aspectOf,
  type Frame,
  fitInside,
  fitTextStack,
  full,
  inset,
  margin,
  polaroidInside,
  type Rect,
  rect,
  round,
  splitX,
  splitY,
  unit,
} from "./fit";

/**
 * Style d'une proposition : fond, habillage des photos et façon d'entrer en scène.
 * La même disposition × plusieurs styles = la variété des propositions.
 */
export interface LayoutStyle {
  id: string;
  name: string;
  background: "gradient" | "solid" | "pattern" | "radial" | "photo" | "motion";
  frame: "plain" | "rounded" | "border" | "polaroid" | "shadow";
  motion: "soft" | "slide" | "pop" | "wipe";
}

export const LAYOUT_STYLES: LayoutStyle[] = [
  { id: "doux", name: "Doux", background: "gradient", frame: "rounded", motion: "soft" },
  { id: "net", name: "Net", background: "solid", frame: "plain", motion: "slide" },
  { id: "cadre", name: "Cadre blanc", background: "pattern", frame: "border", motion: "pop" },
  { id: "album", name: "Album", background: "radial", frame: "polaroid", motion: "slide" },
  { id: "flou", name: "Fond flou", background: "photo", frame: "shadow", motion: "soft" },
  { id: "vivant", name: "Vivant", background: "motion", frame: "rounded", motion: "wipe" },
];

/** Palette utilisée quand le projet n'a pas encore de thème. */
export const DEFAULT_THEME: Theme = {
  name: "Par défaut",
  colors: { background: "#0f172a", background2: "#1e3a8a", accent: "#f472b6", title: "#ffffff", text: "#e2e8f0" },
  headingFont: "Montserrat",
  bodyFont: "Inter",
};

export type ResolvedText = TextItem & { role: TextRole };

type Treatment = LayoutStyle["frame"] | "none" | "circle" | "arch";

export interface MediaOptions {
  /** fill = remplit exactement la case (la photo est rognée) ; fit = cadre ajusté à la photo. */
  mode?: "fill" | "fit";
  /** Habillage imposé par la disposition (sinon celui du style). */
  treatment?: Treatment;
  rotation?: number;
  /** Photo pleine page : pas d'habillage, entrée en fondu avec zoom lent. */
  bleed?: boolean;
  /** Taille dans la case en mode fit (1 = la case entière). */
  scale?: number;
}

export interface TextOptions {
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  /** Texte posé sur une photo : blanc avec ombre. */
  onPhoto?: boolean;
  /** Taille du titre avant réduction (px pour un petit côté de 1080). */
  maxSize?: number;
}

/** Ce qu'une disposition a besoin de connaître pour se construire. */
export class PageBuilder {
  readonly layers: Layer[] = [];
  /** Plus c'est haut, moins la proposition convient (photos très rognées, texte à l'étroit…). */
  penalty = 0;
  private mismatches: number[] = [];
  /** Ordre d'apparition (décalage des entrées). */
  private order: { layer: Layer; role: "media" | "bleed" | "text" | "decor" }[] = [];
  background: BackgroundInput | null = null;
  readonly m: number;
  readonly gap: number;
  readonly u: number;

  constructor(
    readonly f: ProjectFormat,
    readonly theme: Theme,
    readonly style: LayoutStyle,
    readonly media: MediaItem[],
    readonly texts: ResolvedText[],
  ) {
    this.m = margin(f);
    this.gap = Math.round(this.m * 0.5);
    this.u = unit(f);
  }

  get frame(): Frame {
    return this.f;
  }
  get hasText() {
    return this.texts.length > 0;
  }
  get page(): Rect {
    return full(this.f);
  }
  /** Zone utile (page moins les marges). */
  get safe(): Rect {
    return inset(full(this.f), this.m);
  }

  /**
   * Partage la zone utile entre les photos et les textes : bandeau en bas (ou en haut),
   * ou colonne sur le côté en paysage. Sans texte, tout va aux photos.
   */
  areas(mediaShare = 0.74, where: "bottom" | "top" | "side" = "bottom"): { media: Rect; text: Rect | null } {
    const safe = this.safe;
    if (!this.hasText) return { media: safe, text: null };
    // Beaucoup de texte : on lui laisse plus de place.
    const load = this.texts.reduce((n, t) => n + t.text.length, 0);
    if (this.texts.length >= 3 || load > 70) mediaShare = Math.min(mediaShare, 0.6);
    if (where === "side") {
      if (this.f.width >= this.f.height) {
        const [text, media] = splitX(safe, 1 - mediaShare, this.m);
        return { media, text };
      }
      where = "top";
    }
    if (where === "top") {
      const [text, media] = splitY(safe, 1 - mediaShare, this.gap * 2);
      return { media, text };
    }
    const [media, text] = splitY(safe, mediaShare, this.gap * 2);
    return { media, text };
  }

  /** Pose une photo ou une vidéo dans une case. Renvoie le cadre réellement occupé. */
  addMedia(item: MediaItem, slot: Rect, opts: MediaOptions = {}): Rect {
    const bleed = opts.bleed ?? false;
    let treatment: Treatment = bleed ? "none" : (opts.treatment ?? this.style.frame);
    if (item.kind === "video" && treatment === "polaroid") treatment = "shadow";
    const mode = treatment === "polaroid" ? "fit" : (opts.mode ?? "fill");
    const scale = opts.scale ?? 1;

    let box: Rect;
    if (treatment === "polaroid") box = polaroidInside(slot, item.aspect, scale);
    else if (mode === "fit") box = fitInside(slot, item.aspect, scale);
    else box = slot;
    if (mode === "fill") this.mismatches.push(aspectMismatch(aspectOf(box), item.aspect));
    box = round(box);

    const small = Math.min(box.width, box.height);
    const mask =
      treatment === "circle"
        ? { shape: "circle" as const }
        : treatment === "arch"
          ? { shape: "arch" as const }
          : treatment === "rounded" || treatment === "shadow"
            ? { shape: "rounded" as const, radius: Math.round(small * 0.06) }
            : { shape: "none" as const };
    const transform = { ...box, rotation: opts.rotation ?? 0 };
    const dropShadow = {
      enabled: treatment === "shadow" || treatment === "polaroid" || treatment === "border",
      blur: Math.round(30 * this.u),
      y: Math.round(14 * this.u),
      opacity: 0.4,
    };

    const layer: Layer =
      item.kind === "image"
        ? createImageLayer({
            name: item.name || "Photo",
            src: item.src,
            imageAspect: item.aspect,
            transform,
            mask,
            frame: treatment === "polaroid" ? "polaroid" : "none",
            border: treatment === "border" ? { width: Math.max(4, Math.round(small * 0.025)), color: "#ffffff" } : {},
            dropShadow,
            filter: item.filter ?? {},
          })
        : createVideoLayer({
            name: item.name || "Vidéo",
            src: item.src,
            sourceDurationSeconds: item.durationSeconds,
            transform,
            mask,
            dropShadow,
            ...(item.keep ?? {}),
          });
    this.push(layer, bleed ? "bleed" : "media");
    return box;
  }

  /** Empile les textes (titre, sous-titre, texte) dans la zone. Renvoie le cadre occupé. */
  addTexts(zone: Rect, opts: TextOptions = {}): Rect | null {
    if (!this.hasText) return null;
    const { align = "center", valign = "center", onPhoto = false } = opts;
    const u = this.u;
    const maxSize = (opts.maxSize ?? 110) * u;
    const spec = this.texts.map((t) => ({
      text: t.text,
      weight: t.role === "title" ? 1 : t.role === "subtitle" ? 0.42 : 0.4,
      lineHeight: t.role === "title" ? 1.1 : 1.3,
      charWidth: t.role === "title" ? 0.58 : t.role === "subtitle" ? 0.62 : 0.52,
      // En dessous, un texte devient illisible sur un téléphone.
      min: Math.round((t.role === "title" ? 40 : t.role === "subtitle" ? 26 : 30) * u),
    }));
    const fit = fitTextStack(spec, zone, maxSize, Math.round(26 * u));
    if (!fit.fits) this.penalty += 3;
    else if (fit.scale < 0.4) this.penalty += 0.6;

    let y = zone.y;
    if (valign === "center") y += (zone.height - fit.total) / 2;
    if (valign === "bottom") y += zone.height - fit.total;
    const top = y;
    const c = this.theme.colors;
    this.texts.forEach((t, i) => {
      const fs = fit.fontSizes[i] as number;
      const h = fit.heights[i] as number;
      const heading = t.role === "title";
      const layer = createTextLayer({
        name: heading ? "Titre" : t.role === "subtitle" ? "Sous-titre" : "Texte",
        text: t.text,
        fontFamily: heading ? this.theme.headingFont : this.theme.bodyFont,
        fontWeight: heading ? 700 : t.role === "subtitle" ? 600 : 400,
        fontSize: fs,
        lineHeight: spec[i]?.lineHeight,
        // Petites capitales espacées pour un sous-titre court ; un sous-titre long reste en minuscules.
        letterSpacing: t.role === "subtitle" && t.text.length <= 32 ? Math.round(fs * 0.06) : 0,
        textTransform: t.role === "subtitle" && t.text.length <= 32 ? "uppercase" : "none",
        align,
        color: onPhoto ? "#ffffff" : heading ? c.title : c.text,
        shadow: onPhoto,
        shadowOpacity: 0.55,
        // Un peu de marge en hauteur : l'estimation de la largeur des lettres reste approximative.
        transform: round(rect(zone.x, y - fs * 0.1, zone.width, h + fs * 0.2)),
      });
      this.push(layer, "text");
      y += h + (fit.gaps[i] as number);
    });
    return round(rect(zone.x, top, zone.width, fit.total));
  }

  /** Aplat de couleur (panneau derrière un texte, bandeau, pastille décorative). */
  addPanel(
    box: Rect,
    color: string,
    opts: { opacity?: number; radius?: number; shape?: "rect" | "circle"; name?: string } = {},
  ) {
    const layer = createShapeLayer({
      name: opts.name ?? "Fond du texte",
      shape: opts.shape ?? "rect",
      fill: color,
      radius: opts.radius ?? Math.round(18 * this.u),
      transform: { ...round(box), opacity: opts.opacity ?? 1 },
    });
    this.push(layer, "decor");
    return layer;
  }

  /** Dégradé sombre en bas d'une photo pleine page, pour lire le texte posé dessus. */
  addScrim(box: Rect, from: "bottom" | "top" = "bottom") {
    const layer = createShapeLayer({
      name: "Ombre de lecture",
      shape: "rect",
      radius: 0,
      fillMode: "gradient",
      gradient: {
        colors: from === "bottom" ? ["rgba(0,0,0,0)", "rgba(0,0,0,0.7)"] : ["rgba(0,0,0,0.7)", "rgba(0,0,0,0)"],
        angle: 180,
      },
      transform: round(box),
    });
    this.push(layer, "decor");
  }

  /** Petit trait de couleur d'accent (sous un titre, à côté d'une colonne de texte). */
  addAccentBar(box: Rect) {
    this.addPanel(box, this.theme.colors.accent, {
      name: "Trait",
      radius: Math.round(Math.min(box.width, box.height) / 2),
    });
  }

  private push(layer: Layer, role: "media" | "bleed" | "text" | "decor") {
    this.layers.push(layer);
    this.order.push({ layer, role });
  }

  /** Note globale : écart moyen des ratios des photos rognées + pénalités du texte. */
  get score() {
    const mean = this.mismatches.length ? this.mismatches.reduce((a, b) => a + b, 0) / this.mismatches.length : 0;
    const worst = Math.max(0, ...this.mismatches);
    return -(mean * 1.6 + worst * 0.6 + this.penalty);
  }

  /** Entrées en scène décalées, selon le style : photos d'abord, textes ensuite. */
  animate() {
    const k = this.f.fps / 30;
    const f = (n: number) => Math.max(1, Math.round(n * k));
    const media = { soft: "fade", slide: "slide-up", pop: "zoom", wipe: "wipe-right" } as const;
    const text = { soft: "slide-up", slide: "slide-left", pop: "pop", wipe: "wipe-right" } as const;
    let mediaIndex = 0;
    let textIndex = 0;
    const mediaCount = this.order.filter((o) => o.role === "media").length;
    for (const { layer, role } of this.order) {
      const a = layer.animation;
      if (role === "bleed") {
        a.enter = "fade";
        a.enterDurationInFrames = f(20);
        if (layer.type === "image") a.kenBurns = 0.08;
        continue;
      }
      if (role === "decor") {
        a.enter = "fade";
        a.enterDurationInFrames = f(15);
        continue;
      }
      if (role === "media") {
        let enter: EnterAnimation = media[this.style.motion];
        if (this.style.motion === "slide" && mediaCount > 1) enter = mediaIndex % 2 ? "slide-right" : "slide-left";
        a.enter = enter;
        a.enterDurationInFrames = f(this.style.motion === "pop" ? 16 : 20);
        a.enterDelayInFrames = f(mediaIndex * 6);
        if (layer.type === "image" && this.style.motion === "soft") a.kenBurns = 0.05;
        mediaIndex += 1;
      } else {
        a.enter = text[this.style.motion];
        a.enterDurationInFrames = f(18);
        a.enterDelayInFrames = f(Math.min(mediaIndex, 3) * 6 + 8 + textIndex * 7);
        textIndex += 1;
      }
    }
  }
}
