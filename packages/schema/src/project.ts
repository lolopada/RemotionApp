import { z } from "zod";
import { ColorSchema, IdSchema, ThemeSchema, TransitionSchema } from "./common";
import { LayerSchema } from "./layers";

/** Animation douce du fond (dégradé qui ondule, motif qui défile, zoom lent sur une photo). */
export const BackgroundMotionSchema = z.object({
  enabled: z.boolean().default(false),
  /** Multiplicateur de vitesse (1 = tranquille). */
  speed: z.number().min(0.1).max(4).default(1),
});

/** Voile coloré posé sur une photo de fond. */
export const BackgroundVeilSchema = z.object({
  enabled: z.boolean().default(false),
  color: ColorSchema.default("#000000"),
  opacity: z.number().min(0).max(1).default(0.45),
  /** Plein, ou dégradé depuis le bas / le haut, ou vignette (bords). */
  mode: z.enum(["solid", "bottom", "top", "vignette"]).default("solid"),
});

export const BACKGROUND_PATTERNS = ["dots", "stripes", "checks", "grid"] as const;
export const BackgroundPatternSchema = z.enum(BACKGROUND_PATTERNS);
export type BackgroundPattern = z.infer<typeof BackgroundPatternSchema>;

/** Grain de pellicule par-dessus n'importe quel fond (0 = aucun). */
const grain = z.number().min(0).max(1).default(0);

const BackgroundVariants = z.discriminatedUnion("type", [
  z.object({ type: z.literal("color"), color: ColorSchema, grain }),
  z.object({
    type: z.literal("gradient"),
    /** Linéaire (selon l'angle) ou circulaire (depuis un centre). */
    kind: z.enum(["linear", "radial"]).default("linear"),
    /** 2 à 6 couleurs, réparties régulièrement. */
    colors: z.array(ColorSchema).min(2).max(6),
    angle: z.number().default(135),
    /** Centre du dégradé circulaire (0–1 de la largeur / hauteur). */
    centerX: z.number().min(0).max(1).default(0.5),
    centerY: z.number().min(0).max(1).default(0.5),
    /** Taille du dégradé circulaire (1 = jusqu'au coin le plus éloigné). */
    radius: z.number().min(0.2).max(3).default(1),
    grain,
    motion: BackgroundMotionSchema.prefault({}),
  }),
  z.object({
    type: z.literal("pattern"),
    pattern: BackgroundPatternSchema.default("dots"),
    /** Couleur du fond et couleur du motif. */
    base: ColorSchema,
    ink: ColorSchema,
    /** Taille d'un élément du motif, en px de la composition. */
    size: z.number().min(8).max(400).default(60),
    /** Épaisseur relative (rayon des pois, largeur des rayures / traits). */
    thickness: z.number().min(0.1).max(0.9).default(0.5),
    angle: z.number().min(-180).max(180).default(0),
    grain,
    motion: BackgroundMotionSchema.prefault({}),
  }),
  z.object({
    type: z.literal("image"),
    src: z.string(),
    /** Flou du fond en px (0 = net). */
    blur: z.number().min(0).max(60).default(0),
    veil: BackgroundVeilSchema.prefault({}),
    grain,
    motion: BackgroundMotionSchema.prefault({}),
  }),
]);

/**
 * Ancien format du dégradé (deux couleurs `from`/`to`) : converti à la lecture pour
 * que les projets existants s'ouvrent sans changement.
 */
const LegacyGradient = z
  .object({
    type: z.literal("gradient"),
    from: ColorSchema,
    to: ColorSchema,
    angle: z.number().default(135),
  })
  .transform(({ from, to, angle }) => {
    const bg = BackgroundVariants.parse({ type: "gradient", colors: [from, to], angle });
    return bg as Extract<typeof bg, { type: "gradient" }>;
  });

export const BackgroundSchema = z.union([BackgroundVariants, LegacyGradient]);
export type Background = z.output<typeof BackgroundVariants>;
export type BackgroundInput = z.input<typeof BackgroundSchema>;

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
  /** Thème (palette + polices) ; null = aucun thème choisi. */
  theme: ThemeSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;
/** Ce qu'on accepte en entrée (champs avec valeur par défaut optionnels). */
export type ProjectInput = z.input<typeof ProjectSchema>;
