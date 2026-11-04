import { z } from "zod";
import {
  BlendModeSchema,
  ColorSchema,
  DecorShapeSchema,
  IdSchema,
  LayerAnimationSchema,
  MaskSchema,
  TransformSchema,
} from "./common";

/**
 * Champs communs à tous les calques.
 * Pour ajouter un type de calque :
 *   1. créer son schéma ici et l'ajouter à `LayerSchema`,
 *   2. ajouter son rendu dans packages/composition/src/layers/registry.tsx,
 *   3. ajouter sa fabrique dans factories.ts.
 */
const LayerBase = {
  id: IdSchema,
  name: z.string().max(120).default(""),
  transform: TransformSchema,
  animation: LayerAnimationSchema.prefault({}),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  blendMode: BlendModeSchema.default("normal"),
};

/** Ombre portée qui suit la forme du calque. */
export const DropShadowSchema = z
  .object({
    enabled: z.boolean().default(false),
    color: ColorSchema.default("#000000"),
    opacity: z.number().min(0).max(1).default(0.45),
    blur: z.number().min(0).max(150).default(30),
    x: z.number().default(0),
    y: z.number().default(16),
  })
  .prefault({});

/** Cadrage de la photo à l'intérieur de son cadre (double-clic → recadrer). */
export const CropSchema = z.object({
  /** 1 = la photo couvre exactement le cadre. */
  zoom: z.number().min(1).max(10).default(1),
  /** Décalage en fraction de la taille du cadre (-0.5 … 0.5). */
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
});
export type Crop = z.infer<typeof CropSchema>;

/** Filtres de couleur d'une photo ou d'une vidéo. */
export const PhotoFilterSchema = z
  .object({
    preset: z.enum(["none", "bw", "sepia", "vintage", "warm", "cool", "vivid", "fade"]).default("none"),
    brightness: z.number().min(0).max(3).default(1),
    contrast: z.number().min(0).max(3).default(1),
    saturation: z.number().min(0).max(3).default(1),
    blur: z.number().min(0).max(40).default(0),
  })
  .prefault({});

/** Photo, sticker détouré ou cadre vide en attente d'une photo. */
export const ImageLayerSchema = z.object({
  ...LayerBase,
  type: z.literal("image"),
  /** URL de l'image (/files/…, blob:, data:). null = cadre vide. */
  src: z.string().nullable(),
  /** cover = remplit le cadre (photo), contain = image entière (sticker). */
  fit: z.enum(["cover", "contain"]).default("cover"),
  mask: MaskSchema.prefault({}),
  crop: CropSchema.prefault({}),
  border: z
    .object({
      width: z.number().min(0).default(0),
      color: ColorSchema.default("#ffffff"),
      style: z.enum(["solid", "dashed", "dotted", "double"]).default("solid"),
    })
    .prefault({}),
  /** polaroid = photo posée sur une carte blanche, plus large en bas (avec légende). */
  frame: z.enum(["none", "polaroid"]).default("none"),
  caption: z.string().max(200).default(""),
  /** Ratio largeur/hauteur de l'image (permet de la déplacer dans son cadre). */
  imageAspect: z.number().positive().nullable().default(null),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  filter: PhotoFilterSchema,
  dropShadow: DropShadowSchema,
});
export type ImageLayer = z.infer<typeof ImageLayerSchema>;

/** Vidéo importée, jouée dans son cadre (son compris) à partir de l'apparition du calque. */
export const VideoLayerSchema = z.object({
  ...LayerBase,
  type: z.literal("video"),
  /** URL de la vidéo (/files/…, blob:). */
  src: z.string(),
  /** cover = remplit le cadre (rogne), contain = vidéo entière. */
  fit: z.enum(["cover", "contain"]).default("cover"),
  mask: MaskSchema.prefault({}),
  /** Durée du fichier d'origine, en secondes (renseignée à l'import). */
  sourceDurationSeconds: z.number().positive().nullable().default(null),
  /** Début de la lecture dans le fichier (frames de la cadence du projet). */
  trimStartFrames: z.number().int().min(0).default(0),
  playbackRate: z.number().min(0.25).max(4).default(1),
  volume: z.number().min(0).max(1).default(1),
  muted: z.boolean().default(false),
  /** Reboucle si la vidéo est plus courte que le temps d'affichage du calque. */
  loop: z.boolean().default(true),
  zoom: z.number().min(1).max(5).default(1),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  filter: PhotoFilterSchema,
  dropShadow: DropShadowSchema,
});
export type VideoLayer = z.infer<typeof VideoLayerSchema>;

export const TextAnimationKindSchema = z.enum(["none", "typewriter", "letters", "words", "highlight"]);
export type TextAnimationKind = z.infer<typeof TextAnimationKindSchema>;

export const TextLayerSchema = z.object({
  ...LayerBase,
  type: z.literal("text"),
  text: z.string().max(2000),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().positive().default(72),
  fontWeight: z.number().int().min(100).max(900).default(700),
  color: ColorSchema.default("#ffffff"),
  align: z.enum(["left", "center", "right"]).default("center"),
  lineHeight: z.number().positive().default(1.15),
  letterSpacing: z.number().default(0),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).default("none"),
  /** Remplissage en dégradé (remplace `color` quand activé). */
  gradient: z
    .object({
      enabled: z.boolean().default(false),
      from: ColorSchema.default("#f472b6"),
      to: ColorSchema.default("#8b5cf6"),
      /** 180 = de haut en bas (rendu identique avec les animations lettre par lettre). */
      angle: z.number().default(180),
    })
    .prefault({}),
  /** Ombre (ou halo lumineux quand les décalages sont à 0). */
  shadow: z.boolean().default(true),
  shadowColor: ColorSchema.default("#000000"),
  shadowOpacity: z.number().min(0).max(1).default(0.45),
  shadowBlur: z.number().min(0).max(200).default(24),
  shadowX: z.number().default(0),
  shadowY: z.number().default(4),
  strokeWidth: z.number().min(0).default(0),
  strokeColor: ColorSchema.default("#000000"),
  /** Fond derrière le texte : bandeau (coins droits) ou pastille (coins arrondis). */
  box: z
    .object({
      enabled: z.boolean().default(false),
      color: ColorSchema.default("#000000"),
      opacity: z.number().min(0).max(1).default(0.6),
      radius: z.number().min(0).default(12),
      paddingX: z.number().min(0).default(28),
      paddingY: z.number().min(0).default(12),
      /** true = toute la largeur du calque, false = ajusté au texte. */
      fullWidth: z.boolean().default(false),
    })
    .prefault({}),
  /** Animation propre au texte, en plus de l'animation d'entrée du calque. */
  textAnimation: z
    .object({
      kind: TextAnimationKindSchema.default("none"),
      durationInFrames: z.number().int().min(1).default(30),
      highlightColor: ColorSchema.default("#facc15"),
    })
    .prefault({}),
});
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type TextLayerInput = z.input<typeof TextLayerSchema>;

/** Forme décorative : pleine, en dégradé ou vide, avec contour et ombre facultatifs. */
export const ShapeLayerSchema = z.object({
  ...LayerBase,
  type: z.literal("shape"),
  shape: DecorShapeSchema.default("rect"),
  /** Couleur de remplissage unie (utilisée si fillMode = "solid"). */
  fill: ColorSchema.default("#ffffff"),
  radius: z.number().min(0).default(32),
  fillMode: z.enum(["solid", "gradient", "none"]).default("solid"),
  gradient: z
    .object({
      colors: z.array(ColorSchema).min(2).max(4).default(["#f472b6", "#7c3aed"]),
      angle: z.number().default(135),
    })
    .prefault({}),
  /** Contour (toujours actif pour la « ligne »). */
  stroke: z
    .object({
      enabled: z.boolean().default(false),
      color: ColorSchema.default("#ffffff"),
      width: z.number().min(1).max(80).default(8),
      style: z.enum(["solid", "dashed", "dotted"]).default("solid"),
    })
    .prefault({}),
  dropShadow: DropShadowSchema,
});
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;

export const LayerSchema = z.discriminatedUnion("type", [
  ImageLayerSchema,
  TextLayerSchema,
  ShapeLayerSchema,
  VideoLayerSchema,
]);
export type Layer = z.infer<typeof LayerSchema>;
export type LayerType = Layer["type"];
