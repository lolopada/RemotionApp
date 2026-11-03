import { z } from "zod";
import { ColorSchema, IdSchema, TransitionSchema } from "./common";
import { LayerSchema } from "./layers";

export const BackgroundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("color"), color: ColorSchema }),
  z.object({
    type: z.literal("gradient"),
    from: ColorSchema,
    to: ColorSchema,
    angle: z.number().default(135),
  }),
  z.object({
    type: z.literal("image"),
    src: z.string(),
    /** Flou du fond en px (0 = net). */
    blur: z.number().min(0).max(60).default(0),
  }),
]);
export type Background = z.infer<typeof BackgroundSchema>;

/** Une planche du storyboard. Les calques sont dessinés dans l'ordre du tableau (fond → avant). */
export const SceneSchema = z.object({
  id: IdSchema,
  name: z.string().max(120).default(""),
  durationInFrames: z.number().int().min(1),
  background: BackgroundSchema,
  layers: z.array(LayerSchema).default([]),
  /** Transition depuis la scène précédente (ignorée pour la première scène). */
  transitionIn: TransitionSchema.prefault({}),
});
export type Scene = z.infer<typeof SceneSchema>;

/** Un morceau de musique posé sur la piste audio globale. */
export const AudioClipSchema = z.object({
  id: IdSchema,
  name: z.string().max(200).default(""),
  src: z.string(),
  /** Début du clip dans la vidéo, en frames. */
  startFrame: z.number().int().min(0).default(0),
  /** Durée du clip dans la vidéo, en frames. */
  durationInFrames: z.number().int().min(1),
  /** Frames à sauter au début du fichier audio (couper l'intro). */
  trimStartFrames: z.number().int().min(0).default(0),
  volume: z.number().min(0).max(2).default(1),
  fadeInFrames: z.number().int().min(0).default(30),
  fadeOutFrames: z.number().int().min(0).default(45),
});
export type AudioClip = z.infer<typeof AudioClipSchema>;

export const ProjectSchema = z.object({
  /** Version du format, pour migrer les anciens projets plus tard. */
  version: z.literal(1),
  id: IdSchema,
  name: z.string().max(200),
  width: z.number().int().min(16).max(3840),
  height: z.number().int().min(16).max(3840),
  fps: z.number().int().min(1).max(60),
  scenes: z.array(SceneSchema).min(1),
  audio: z.array(AudioClipSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;
/** Ce qu'on accepte en entrée (champs avec valeur par défaut optionnels). */
export type ProjectInput = z.input<typeof ProjectSchema>;
