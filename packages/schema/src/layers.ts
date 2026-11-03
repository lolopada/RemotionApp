import { z } from "zod";
import { ColorSchema, IdSchema, LayerAnimationSchema, MaskSchema, TransformSchema } from "./common";

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
};

/** Cadrage de la photo à l'intérieur de son cadre (double-clic → recadrer). */
export const CropSchema = z.object({
  /** 1 = la photo couvre exactement le cadre. */
  zoom: z.number().min(1).max(10).default(1),
  /** Décalage en fraction de la taille du cadre (-0.5 … 0.5). */
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
});
export type Crop = z.infer<typeof CropSchema>;

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
    })
    .prefault({}),
});
export type ImageLayer = z.infer<typeof ImageLayerSchema>;

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
  shadow: z.boolean().default(true),
  strokeWidth: z.number().min(0).default(0),
  strokeColor: ColorSchema.default("#000000"),
});
export type TextLayer = z.infer<typeof TextLayerSchema>;

/** Forme décorative pleine (bandeau, pastille, cœur…). */
export const ShapeLayerSchema = z.object({
  ...LayerBase,
  type: z.literal("shape"),
  shape: z.enum(["rect", "rounded", "circle", "heart"]).default("rect"),
  fill: ColorSchema.default("#ffffff"),
  radius: z.number().min(0).default(32),
});
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;

export const LayerSchema = z.discriminatedUnion("type", [ImageLayerSchema, TextLayerSchema, ShapeLayerSchema]);
export type Layer = z.infer<typeof LayerSchema>;
export type LayerType = Layer["type"];
