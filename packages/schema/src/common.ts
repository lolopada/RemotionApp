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
export const MaskShapeSchema = z.enum(["none", "rect", "rounded", "circle", "heart"]);
export type MaskShape = z.infer<typeof MaskShapeSchema>;

export const MaskSchema = z.object({
  shape: MaskShapeSchema.default("none"),
  feather: z.number().min(0).max(200).default(0),
  /** Rayon des coins pour la forme "rounded", en pixels. */
  radius: z.number().min(0).default(32),
});
export type Mask = z.infer<typeof MaskSchema>;

/** Animations d'entrée / sortie d'un calque. */
export const EnterAnimationSchema = z.enum(["none", "fade", "zoom", "slide-up", "slide-left", "pop"]);
export const ExitAnimationSchema = z.enum(["none", "fade", "zoom", "slide-down"]);
export type EnterAnimation = z.infer<typeof EnterAnimationSchema>;
export type ExitAnimation = z.infer<typeof ExitAnimationSchema>;

export const LayerAnimationSchema = z.object({
  enter: EnterAnimationSchema.default("fade"),
  enterDurationInFrames: z.number().int().min(1).default(15),
  /** Délai avant l'entrée, en frames depuis le début de la scène. */
  enterDelayInFrames: z.number().int().min(0).default(0),
  exit: ExitAnimationSchema.default("none"),
  exitDurationInFrames: z.number().int().min(1).default(15),
  /** Léger zoom continu sur toute la durée (effet Ken Burns). 0 = désactivé. */
  kenBurns: z.number().min(0).max(0.5).default(0),
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
]);
export type TransitionKind = z.infer<typeof TransitionKindSchema>;

export const TransitionSchema = z.object({
  kind: TransitionKindSchema.default("fade"),
  durationInFrames: z.number().int().min(1).default(20),
});
export type Transition = z.infer<typeof TransitionSchema>;
