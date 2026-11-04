import { nanoid } from "nanoid";
import type { z } from "zod";
import {
  type ImageLayer,
  ImageLayerSchema,
  type ShapeLayer,
  ShapeLayerSchema,
  type TextLayer,
  TextLayerSchema,
  type VideoLayer,
  VideoLayerSchema,
} from "./layers";
import {
  type AudioClip,
  AudioClipSchema,
  type Background,
  type BackgroundInput,
  BackgroundSchema,
  type Project,
  ProjectSchema,
  type Scene,
  SceneSchema,
} from "./project";

export const newId = () => nanoid(12);

/** Champs optionnels, tels qu'acceptés en entrée du schéma (les défauts sont appliqués). */
type Init<S extends z.ZodType> = Partial<z.input<S>>;

export interface ProjectFormat {
  width: number;
  height: number;
  fps: number;
}

export const FORMATS = {
  landscape: { width: 1920, height: 1080, fps: 30 },
  portrait: { width: 1080, height: 1920, fps: 30 },
  square: { width: 1080, height: 1080, fps: 30 },
  /** 4:5, le format portrait des publications Instagram. */
  instagram: { width: 1080, height: 1350, fps: 30 },
  /** 21:9, format « cinéma ». */
  cinema: { width: 2520, height: 1080, fps: 30 },
} satisfies Record<string, ProjectFormat>;

/** Fond complet (valeurs par défaut appliquées) à partir d'une description partielle. */
export function createBackground(input: BackgroundInput): Background {
  return BackgroundSchema.parse(input);
}

export function createScene(init: Init<typeof SceneSchema> = {}): Scene {
  return SceneSchema.parse({
    id: newId(),
    durationInFrames: 120,
    background: { type: "gradient", colors: ["#1e1b4b", "#7c3aed"], angle: 135 },
    ...init,
  });
}

export function createImageLayer(init: Omit<Init<typeof ImageLayerSchema>, "type"> = {}): ImageLayer {
  return ImageLayerSchema.parse({
    id: newId(),
    name: "Photo",
    src: null,
    transform: { x: 660, y: 240, width: 600, height: 600 },
    ...init,
    type: "image",
  });
}

export function createVideoLayer(init: Omit<Init<typeof VideoLayerSchema>, "type"> & { src: string }): VideoLayer {
  return VideoLayerSchema.parse({
    id: newId(),
    name: "Vidéo",
    transform: { x: 360, y: 180, width: 1200, height: 720 },
    ...init,
    type: "video",
  });
}

export function createTextLayer(init: Omit<Init<typeof TextLayerSchema>, "type"> = {}): TextLayer {
  return TextLayerSchema.parse({
    id: newId(),
    name: "Texte",
    text: "Votre texte",
    transform: { x: 360, y: 860, width: 1200, height: 140 },
    ...init,
    type: "text",
  });
}

export function createShapeLayer(init: Omit<Init<typeof ShapeLayerSchema>, "type"> = {}): ShapeLayer {
  return ShapeLayerSchema.parse({
    id: newId(),
    name: "Forme",
    transform: { x: 760, y: 340, width: 400, height: 400 },
    ...init,
    type: "shape",
  });
}

export function createAudioClip(
  init: Init<typeof AudioClipSchema> & { src: string; durationInFrames: number },
): AudioClip {
  return AudioClipSchema.parse({ id: newId(), ...init });
}

export function createProject(init: { name?: string; format?: ProjectFormat; scenes?: Scene[] } = {}): Project {
  const now = new Date().toISOString();
  const format = init.format ?? FORMATS.landscape;
  return ProjectSchema.parse({
    version: 1,
    id: newId(),
    name: init.name ?? "Nouveau montage",
    ...format,
    scenes: init.scenes ?? [createScene()],
    audio: [],
    createdAt: now,
    updatedAt: now,
  });
}

/** Copie profonde d'une scène avec de nouveaux identifiants. */
export function duplicateScene(scene: Scene): Scene {
  const copy = structuredClone(scene);
  copy.id = newId();
  copy.layers = copy.layers.map((layer) => ({ ...layer, id: newId() }));
  return copy;
}
