import {
  type BackgroundInput,
  createImageLayer,
  createShapeLayer,
  createTextLayer,
  createVideoLayer,
  type DecorShape,
  type EnterAnimation,
  type ImageLayer,
  type Layer,
  type MaskShape,
  type ProjectFormat,
  type Theme,
} from "@app/schema";
import { STICKERS, stickerUrl } from "../../templates/stickers";
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
  background: "gradient" | "solid" | "pattern" | "radial" | "photo" | "motion" | "stripes" | "checks" | "grid" | "spot";
  frame: "plain" | "rounded" | "border" | "polaroid" | "shadow";
  motion: "soft" | "slide" | "pop" | "wipe" | "blur" | "bounce" | "flip" | "rise";
  /** Filtre de couleur posé sur les photos (sauf si la photo a déjà le sien). */
  filter?: ImageLayer["filter"]["preset"];
  /** Grain de pellicule sur le fond (0–1). */
  grain?: number;
}

/** Tous les styles reprennent les couleurs du thème : seuls le traitement et le mouvement changent. */
export const LAYOUT_STYLES: LayoutStyle[] = [
  { id: "doux", name: "Doux", background: "gradient", frame: "rounded", motion: "soft" },
  { id: "net", name: "Net", background: "solid", frame: "plain", motion: "slide" },
  { id: "cadre", name: "Cadre blanc", background: "pattern", frame: "border", motion: "pop" },
  { id: "album", name: "Album", background: "radial", frame: "polaroid", motion: "slide" },
  { id: "flou", name: "Fond flou", background: "photo", frame: "shadow", motion: "soft" },
  { id: "vivant", name: "Vivant", background: "motion", frame: "rounded", motion: "wipe" },
  {
    id: "pellicule",
    name: "Pellicule",
    background: "solid",
    frame: "plain",
    motion: "blur",
    filter: "vintage",
    grain: 0.35,
  },
  { id: "noir-blanc", name: "Noir et blanc", background: "radial", frame: "border", motion: "soft", filter: "bw" },
  { id: "rayures", name: "Rayures", background: "stripes", frame: "shadow", motion: "bounce" },
  { id: "carnet", name: "Carnet", background: "grid", frame: "polaroid", motion: "flip", filter: "warm" },
  { id: "damier", name: "Damier", background: "checks", frame: "rounded", motion: "pop", filter: "fade" },
  { id: "lumineux", name: "Lumineux", background: "spot", frame: "shadow", motion: "rise", filter: "vivid" },
];

/** Palette utilisée quand le projet n'a pas encore de thème. */
export const DEFAULT_THEME: Theme = {
  name: "Par défaut",
  colors: { background: "#0f172a", background2: "#1e3a8a", accent: "#f472b6", title: "#ffffff", text: "#e2e8f0" },
  headingFont: "Montserrat",
  bodyFont: "Inter",
};

export type ResolvedText = TextItem & { role: TextRole };

/** Habillage d'une photo : celui du style, ou une forme imposée par la disposition (masque). */
export type Treatment = LayoutStyle["frame"] | "none" | Exclude<MaskShape, "none" | "rect" | "rounded">;

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
  /** Couleur du liseré (habillage « border »), blanc par défaut. */
  borderColor?: string;
  /** Style du liseré : tirets, pointillés ou double trait (habillage « border »). */
  borderStyle?: "solid" | "dashed" | "dotted" | "double";
  /** Épaisseur du liseré, en part du petit côté de la photo (défaut 0,025). */
  borderWidth?: number;
  /** Bord flou (px) : la photo se fond dans le fond (« Rond flou », « Bord flou »…). */
  feather?: number;
  /** Filtre de couleur imposé à cette photo (ex. noir et blanc sauf la photo mise en avant). */
  filter?: ImageLayer["filter"]["preset"];
  /** Ombre portée forcée (true) ou supprimée (false). */
  shadow?: boolean;
  /** Mouvement continu discret pendant toute la page. */
  loop?: "float" | "sway";
}

export interface TextOptions {
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
  /** Texte posé sur une photo : blanc avec ombre. */
  onPhoto?: boolean;
  /** Taille du titre avant réduction (px pour un petit côté de 1080). */
  maxSize?: number;
  /** Seulement le titre, ou seulement les autres textes (sous-titre, texte). */
  pick?: "title" | "rest";
  /** Textes légèrement penchés (degrés). */
  rotation?: number;
  /**
   * Allure des textes :
   *  script     = sous-titre et texte manuscrits (Caveat)
   *  caps       = titre en capitales espacées
   *  gradient   = titre en dégradé (couleur d'accent → couleur du titre)
   *  outline    = titre cerclé de la couleur d'accent
   *  highlight  = titre surligné par un trait d'accent qui se dessine
   *  typewriter = texte tapé à la machine
   */
  look?: "script" | "caps" | "gradient" | "outline" | "highlight" | "typewriter";
  /** Couleurs imposées (texte sur une carte claire, par ex.). */
  colors?: { title: string; text: string };
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
    const framed = ["plain", "rounded", "border", "polaroid", "shadow", "none"].includes(treatment);
    const feather = treatment === "polaroid" ? 0 : Math.round((opts.feather ?? 0) * this.u);
    const mask = !framed
      ? { shape: treatment as MaskShape, feather }
      : treatment === "rounded" || treatment === "shadow"
        ? { shape: "rounded" as const, radius: Math.round(small * 0.06), feather }
        : { shape: feather > 0 ? ("rect" as const) : ("none" as const), feather };
    const transform = { ...box, rotation: opts.rotation ?? 0 };
    const dropShadow = {
      // Un bord flou et une ombre portée ne vont pas ensemble.
      enabled:
        opts.shadow ??
        (feather === 0 && (treatment === "shadow" || treatment === "polaroid" || treatment === "border" || !framed)),
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
            border:
              treatment === "border"
                ? {
                    width: Math.max(4, Math.round(small * (opts.borderWidth ?? 0.025))),
                    color: opts.borderColor ?? "#ffffff",
                    style: opts.borderStyle ?? "solid",
                  }
                : {},
            dropShadow,
            filter: opts.filter
              ? { ...(item.filter ?? {}), preset: opts.filter }
              : (item.filter ?? (this.style.filter ? { preset: this.style.filter } : {})),
          })
        : createVideoLayer({
            name: item.name || "Vidéo",
            src: item.src,
            sourceDurationSeconds: item.durationSeconds,
            transform,
            mask,
            dropShadow,
            filter: { preset: opts.filter ?? this.style.filter ?? "none" },
            ...(item.keep ?? {}),
          });
    if (opts.loop) layer.animation.loop = { kind: opts.loop, speed: 0.5, amount: 0.6 };
    this.push(layer, bleed ? "bleed" : "media");
    return box;
  }

  /** Empile les textes (titre, sous-titre, texte) dans la zone. Renvoie le cadre occupé. */
  addTexts(zone: Rect, opts: TextOptions = {}): Rect | null {
    const texts = this.pickTexts(opts.pick);
    if (texts.length === 0) return null;
    const { align = "center", valign = "center", onPhoto = false, look } = opts;
    const u = this.u;
    const maxSize = (opts.maxSize ?? 110) * u;
    // Manuscrit : sous-titre et texte en Caveat, plus grands (la police est étroite et petite).
    const script = (t: ResolvedText) => look === "script" && t.role !== "title";
    const caps = (t: ResolvedText) => look === "caps" && t.role === "title";
    const spec = texts.map((t) => ({
      text: t.text,
      weight: t.role === "title" ? 1 : script(t) ? 0.6 : t.role === "subtitle" ? 0.42 : 0.4,
      lineHeight: t.role === "title" ? 1.1 : script(t) ? 1.15 : 1.3,
      charWidth: caps(t) ? 0.78 : script(t) ? 0.46 : t.role === "title" ? 0.66 : t.role === "subtitle" ? 0.68 : 0.56,
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
    const c = opts.colors ?? this.theme.colors;
    const accent = this.theme.colors.accent;
    texts.forEach((t, i) => {
      const fs = fit.fontSizes[i] as number;
      const h = fit.heights[i] as number;
      const heading = t.role === "title";
      const hand = script(t);
      const titleColor = onPhoto ? "#ffffff" : c.title;
      // Petites capitales espacées pour un sous-titre court ; un sous-titre long reste en minuscules.
      const smallCaps = t.role === "subtitle" && t.text.length <= 32 && !hand;
      const layer = createTextLayer({
        name: heading ? "Titre" : t.role === "subtitle" ? "Sous-titre" : "Texte",
        text: t.text,
        fontFamily: hand ? "Caveat" : heading ? this.theme.headingFont : this.theme.bodyFont,
        fontWeight: hand ? 700 : heading ? (caps(t) ? 800 : 700) : t.role === "subtitle" ? 600 : 400,
        fontSize: fs,
        lineHeight: spec[i]?.lineHeight,
        letterSpacing: caps(t) ? Math.round(fs * 0.05) : smallCaps ? Math.round(fs * 0.06) : 0,
        textTransform: caps(t) || smallCaps ? "uppercase" : "none",
        align,
        color: heading ? titleColor : hand && !onPhoto ? accent : onPhoto ? "#ffffff" : c.text,
        shadow: onPhoto,
        shadowOpacity: 0.55,
        gradient:
          heading && look === "gradient" ? { enabled: true, from: accent, to: titleColor, angle: 120 } : undefined,
        strokeWidth: heading && look === "outline" ? Math.max(2, Math.round(fs * 0.035)) : 0,
        strokeColor: accent,
        textAnimation:
          heading && look === "highlight"
            ? { kind: "highlight", highlightColor: accent, durationInFrames: Math.round(this.f.fps * 0.9) }
            : !heading && look === "typewriter"
              ? {
                  kind: "typewriter",
                  durationInFrames: Math.round(this.f.fps * Math.min(2.5, 0.4 + t.text.length / 40)),
                }
              : undefined,
        // Un peu de marge en hauteur : l'estimation de la largeur des lettres reste approximative.
        transform: {
          ...round(rect(zone.x, y - fs * 0.1, zone.width, h + fs * 0.2)),
          rotation: opts.rotation ?? 0,
        },
      });
      this.push(layer, "text");
      y += h + (fit.gaps[i] as number);
    });
    return round(rect(zone.x, top, zone.width, fit.total));
  }

  /** Textes concernés : tous, le titre seul, ou les autres. */
  pickTexts(pick?: "title" | "rest"): ResolvedText[] {
    if (!pick) return this.texts;
    return this.texts.filter((t) => (pick === "title") === (t.role === "title"));
  }

  /** Aplat de couleur (panneau derrière un texte, bandeau, pastille décorative). */
  addPanel(
    box: Rect,
    color: string,
    opts: {
      opacity?: number;
      radius?: number;
      shape?: DecorShape;
      name?: string;
      rotation?: number;
      /** Contour seul (cadre fin) : épaisseur en px, sans remplissage. */
      outline?: number;
      dotted?: boolean;
      dashed?: boolean;
      /** Remplissage en dégradé (de `color` à cette couleur). */
      gradientTo?: string;
      gradientAngle?: number;
      shadow?: boolean;
    } = {},
  ) {
    const layer = createShapeLayer({
      name: opts.name ?? "Fond du texte",
      shape: opts.shape ?? "rect",
      fill: color,
      fillMode: opts.outline ? "none" : opts.gradientTo ? "gradient" : "solid",
      gradient: opts.gradientTo ? { colors: [color, opts.gradientTo], angle: opts.gradientAngle ?? 135 } : {},
      stroke: opts.outline
        ? {
            enabled: true,
            color,
            width: Math.max(1, Math.round(opts.outline)),
            style: opts.dotted ? "dotted" : opts.dashed ? "dashed" : "solid",
          }
        : {},
      dropShadow: opts.shadow
        ? { enabled: true, blur: Math.round(24 * this.u), y: Math.round(10 * this.u), opacity: 0.35 }
        : {},
      radius: opts.radius ?? Math.round(18 * this.u),
      transform: { ...round(box), opacity: opts.opacity ?? 1, rotation: opts.rotation ?? 0 },
    });
    this.push(layer, "decor");
    return layer;
  }

  /** Dégradé sombre en bas d'une photo pleine page, pour lire le texte posé dessus. */
  addScrim(box: Rect, from: "bottom" | "top" | "left" | "all" = "bottom") {
    const dark = "rgba(0,0,0,0.7)";
    const clear = "rgba(0,0,0,0)";
    const layer = createShapeLayer({
      name: "Ombre de lecture",
      shape: "rect",
      radius: 0,
      fillMode: from === "all" ? "solid" : "gradient",
      fill: "rgba(0,0,0,0.4)",
      gradient: {
        colors: from === "bottom" ? [clear, dark] : [dark, clear],
        angle: from === "left" ? 90 : 180,
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

  /**
   * Ruban adhésif posé en travers d'un coin de photo : bande claire semi-transparente, un peu
   * penchée. `at` = centre du ruban.
   */
  addTape(cx: number, cy: number, length: number, rotation: number) {
    const h = Math.round(length * 0.32);
    this.addPanel(rect(cx - length / 2, cy - h / 2, length, h), "#fffaf0", {
      name: "Ruban adhésif",
      radius: Math.round(2 * this.u),
      opacity: 0.62,
      rotation,
    });
  }

  /** Sticker de la bibliothèque (SVG intégré), posé comme une petite image. */
  addSticker(id: string, box: Rect, rotation = 0, loop?: "float" | "sway") {
    const sticker = STICKERS.find((s) => s.id === id);
    if (!sticker) return;
    const layer = createImageLayer({
      name: `Sticker ${sticker.label}`,
      src: stickerUrl(sticker),
      fit: "contain",
      transform: { ...round(box), rotation },
    });
    if (loop) layer.animation.loop = { kind: loop, speed: 0.6, amount: 0.8 };
    this.push(layer, "decor");
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
    const media = {
      soft: "fade",
      slide: "slide-up",
      pop: "zoom",
      wipe: "wipe-right",
      blur: "blur",
      bounce: "bounce",
      flip: "flip",
      rise: "slide-up",
    } as const;
    const text = {
      soft: "slide-up",
      slide: "slide-left",
      pop: "pop",
      wipe: "wipe-right",
      blur: "blur",
      bounce: "pop",
      flip: "slide-up",
      rise: "fade",
    } as const;
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
        // Décor posé après des photos (ruban, sticker) : il arrive avec elles, pas avant.
        const sticker = layer.type === "image";
        a.enter = sticker ? "pop" : "fade";
        a.enterDurationInFrames = f(15);
        if (mediaIndex > 0) a.enterDelayInFrames = f(Math.min(mediaIndex, 4) * 6 + (sticker ? 10 : 4));
        continue;
      }
      if (role === "media") {
        let enter: EnterAnimation = media[this.style.motion];
        if (this.style.motion === "slide" && mediaCount > 1) enter = mediaIndex % 2 ? "slide-right" : "slide-left";
        a.enter = enter;
        a.enterDurationInFrames = f(this.style.motion === "pop" ? 16 : 20);
        // Beaucoup de photos : elles arrivent plus vite les unes après les autres.
        a.enterDelayInFrames = f(mediaIndex * (mediaCount > 6 ? 3 : 6));
        if (this.style.motion === "rise") a.easing = "elastic";
        if (layer.type === "image" && (this.style.motion === "soft" || this.style.motion === "blur")) a.kenBurns = 0.05;
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
