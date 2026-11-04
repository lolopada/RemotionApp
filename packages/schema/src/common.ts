import { z } from "zod";

/** Identifiant court (nanoid). Restreint pour être sûr dans un nom de fichier. */
export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{4,64}$/);

/** Couleur CSS (#hex, rgb(), hsl()…). Volontairement permissif. */
export const ColorSchema = z.string().min(1).max(64);

/**
 * Position et taille d'un calque, en pixels de la composition
 * (ex. 1920×1080). Le point (x, y) est le coin haut-gauche.
 */
export const TransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
});
export type Transform = z.infer<typeof TransformSchema>;

/**
 * Masque d'un calque : la forme découpe le contenu, `feather` adoucit le bord
 * (en pixels). feather = 0 → bord net (clip-path), > 0 → masque flouté.
 */
export const SHAPES = [
  "rect",
  "rounded",
  "circle",
  "heart",
  "star",
  "hexagon",
  "diamond",
  "arch",
  "bubble",
  "cloud",
  "stamp",
] as const;
export const ShapeKindSchema = z.enum(SHAPES);

/** Formes des calques décoratifs : celles des masques, plus des formes qui n'ont de sens qu'en dessin. */
export const DECOR_SHAPES = [...SHAPES, "triangle", "arrow", "burst", "line"] as const;
export const DecorShapeSchema = z.enum(DECOR_SHAPES);
export type DecorShape = z.infer<typeof DecorShapeSchema>;
export type ShapeKind = z.infer<typeof ShapeKindSchema>;
export const MaskShapeSchema = z.enum(["none", ...SHAPES]);
export type MaskShape = z.infer<typeof MaskShapeSchema>;

export const MaskSchema = z.object({
  shape: MaskShapeSchema.default("none"),
  feather: z.number().min(0).max(200).default(0),
  /** Rayon des coins pour la forme "rounded", en pixels. */
  radius: z.number().min(0).default(32),
});
export type Mask = z.infer<typeof MaskSchema>;

/**
 * Animations d'un calque : entrée, sortie, boucle, zoom lent, et le moment précis
 * où il apparaît / disparaît dans la scène (en frames ; l'éditeur les affiche en secondes).
 */
export const ENTER_ANIMATIONS = [
  "none",
  "fade",
  "zoom",
  "slide-up",
  "slide-left",
  "slide-right",
  "slide-down",
  "pop",
  "bounce",
  "spin",
  "flip",
  "flip-v",
  "blur",
  "wipe-right",
  "wipe-left",
  "wipe-down",
  "wipe-up",
] as const;
export const EXIT_ANIMATIONS = [
  "none",
  "fade",
  "zoom",
  "slide-down",
  "slide-up",
  "slide-left",
  "slide-right",
  "spin",
  "flip",
  "flip-v",
  "blur",
  "wipe-right",
  "wipe-left",
  "wipe-down",
  "wipe-up",
] as const;
export const EnterAnimationSchema = z.enum(ENTER_ANIMATIONS);
export const ExitAnimationSchema = z.enum(EXIT_ANIMATIONS);
export type EnterAnimation = z.infer<typeof EnterAnimationSchema>;
export type ExitAnimation = z.infer<typeof ExitAnimationSchema>;

/** Courbe de vitesse des entrées et sorties. */
export const AnimationEasingSchema = z.enum(["smooth", "linear", "inout", "elastic"]);
export type AnimationEasing = z.infer<typeof AnimationEasingSchema>;

export const LOOP_ANIMATIONS = ["none", "float", "pulse", "sway", "spin"] as const;
export const KEN_BURNS_MODES = ["in", "out", "pan-left", "pan-right", "pan-up", "pan-down"] as const;

export const LayerAnimationSchema = z.object({
  enter: EnterAnimationSchema.default("fade"),
  enterDurationInFrames: z.number().int().min(1).default(15),
  /** Moment d'apparition : frames depuis le début de la scène (le calque est caché avant). */
  enterDelayInFrames: z.number().int().min(0).default(0),
  exit: ExitAnimationSchema.default("none"),
  exitDurationInFrames: z.number().int().min(1).default(15),
  /**
   * Moment où le calque a disparu (fin de la sortie), en frames depuis le début de la scène.
   * null = reste jusqu'à la fin de la scène.
   */
  endAtFrame: z.number().int().min(1).nullable().default(null),
  /** Courbe de vitesse de l'entrée et de la sortie. */
  easing: AnimationEasingSchema.default("smooth"),
  /** Mouvement continu pendant toute la présence du calque. */
  loop: z
    .object({
      kind: z.enum(LOOP_ANIMATIONS).default("none"),
      /** Multiplicateur de vitesse (1 = un cycle toutes les 4 s). */
      speed: z.number().min(0.1).max(4).default(1),
      /** Amplitude du mouvement (1 = discret). */
      amount: z.number().min(0.1).max(3).default(1),
    })
    .prefault({}),
  /** Léger zoom continu sur toute la durée (effet Ken Burns, photos). 0 = désactivé. */
  kenBurns: z.number().min(0).max(0.5).default(0),
  /** Sens du zoom lent : avant, arrière, ou glissement dans une direction. */
  kenBurnsMode: z.enum(KEN_BURNS_MODES).default("in"),
});
export type LayerAnimation = z.infer<typeof LayerAnimationSchema>;

/** Transition d'entrée d'une scène (depuis la scène précédente). */
export const TransitionKindSchema = z.enum([
  "none",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "wipe-left",
  "wipe-right",
  "wipe-diagonal",
  "fade-black",
  "fade-white",
  "zoom-in",
  "zoom-out",
  "flip",
  "iris",
  "clock",
]);
export type TransitionKind = z.infer<typeof TransitionKindSchema>;

export const TransitionSchema = z.object({
  kind: TransitionKindSchema.default("fade"),
  durationInFrames: z.number().int().min(1).default(20),
});
export type Transition = z.infer<typeof TransitionSchema>;

/** Mode de fusion d'un calque avec ce qui est dessous. */
export const BlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "soft-light",
  "hard-light",
  "color-dodge",
  "difference",
  "luminosity",
]);
export type BlendMode = z.infer<typeof BlendModeSchema>;

/**
 * Thème du projet : une palette de 5 couleurs à rôles fixes et deux polices
 * (titres / textes), réappliqués d'un coup à toutes les scènes (`applyTheme`).
 */
export const ThemeSchema = z.object({
  name: z.string().max(60).default("Mon thème"),
  colors: z.object({
    /** Fond principal des scènes. */
    background: ColorSchema,
    /** Seconde couleur de fond (dégradés, motifs). */
    background2: ColorSchema,
    /** Couleur vive : formes, bandeaux, surlignage. */
    accent: ColorSchema,
    /** Couleur des titres. */
    title: ColorSchema,
    /** Couleur des autres textes. */
    text: ColorSchema,
  }),
  headingFont: z.string().default("Inter"),
  bodyFont: z.string().default("Inter"),
});
export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeColorRole = keyof Theme["colors"];
