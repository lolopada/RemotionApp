import {
  createImageLayer,
  createProject,
  createScene,
  createShapeLayer,
  createTextLayer,
  FORMATS,
  type Project,
  type ProjectFormat,
  type Scene,
} from "@app/schema";

/**
 * Modèles de scènes. Positions exprimées en fraction de l'image
 * pour s'adapter à tous les formats (paysage, portrait, carré).
 * Ajouter un modèle = ajouter une entrée à SCENE_TEMPLATES.
 */
export interface SceneTemplate {
  id: string;
  name: string;
  build: (format: ProjectFormat) => Scene;
}

const box = (f: ProjectFormat, x: number, y: number, w: number, h: number) => ({
  x: Math.round(f.width * x),
  y: Math.round(f.height * y),
  width: Math.round(f.width * w),
  height: Math.round(f.height * h),
});

/** Boîte carrée centrée sur (cx, cy), de côté `size` × le plus petit côté. */
const square = (f: ProjectFormat, cx: number, cy: number, size: number) => {
  const s = Math.round(Math.min(f.width, f.height) * size);
  return { x: Math.round(f.width * cx - s / 2), y: Math.round(f.height * cy - s / 2), width: s, height: s };
};

const fontScale = (f: ProjectFormat) => Math.min(f.width, f.height) / 1080;

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: "title",
    name: "Titre",
    build: (f) =>
      createScene({
        name: "Titre",
        durationInFrames: 3 * f.fps,
        background: { type: "gradient", from: "#1e1b4b", to: "#be185d", angle: 135 },
        layers: [
          createTextLayer({
            name: "Titre",
            text: "Nos plus beaux souvenirs",
            fontFamily: "Playfair Display",
            fontSize: Math.round(110 * fontScale(f)),
            transform: box(f, 0.08, 0.34, 0.84, 0.2),
            animation: { enter: "pop", enterDurationInFrames: 24 },
          }),
          createTextLayer({
            name: "Sous-titre",
            text: "Été 2026",
            fontFamily: "Montserrat",
            fontWeight: 400,
            fontSize: Math.round(48 * fontScale(f)),
            letterSpacing: 6,
            transform: box(f, 0.2, 0.56, 0.6, 0.1),
            animation: { enter: "slide-up", enterDelayInFrames: 12, enterDurationInFrames: 20 },
          }),
        ],
      }),
  },
  {
    id: "photo-heart",
    name: "Photo cœur",
    build: (f) =>
      createScene({
        name: "Photo cœur",
        durationInFrames: 4 * f.fps,
        background: { type: "gradient", from: "#fdf2f8", to: "#fbcfe8", angle: 160 },
        transitionIn: { kind: "fade", durationInFrames: 20 },
        layers: [
          createImageLayer({
            name: "Cadre cœur",
            transform: square(f, 0.5, 0.44, 0.62),
            mask: { shape: "heart", feather: 24 },
            animation: { enter: "zoom", enterDurationInFrames: 20, kenBurns: 0.08 },
          }),
          createTextLayer({
            name: "Légende",
            text: "Un moment à deux",
            fontFamily: "Dancing Script",
            color: "#9d174d",
            shadow: false,
            fontSize: Math.round(80 * fontScale(f)),
            transform: box(f, 0.1, 0.8, 0.8, 0.12),
            animation: { enter: "fade", enterDelayInFrames: 15 },
          }),
        ],
      }),
  },
  {
    id: "duo",
    name: "Duo photos",
    build: (f) =>
      createScene({
        name: "Duo photos",
        durationInFrames: 4 * f.fps,
        background: { type: "color", color: "#0f172a" },
        transitionIn: { kind: "wipe-left", durationInFrames: 20 },
        layers: [
          createImageLayer({
            name: "Photo gauche",
            transform: { ...square(f, 0.3, 0.5, 0.55), rotation: -4 },
            mask: { shape: "rounded", radius: 36 },
            border: { width: 12, color: "#ffffff" },
            animation: { enter: "slide-left", enterDurationInFrames: 18 },
          }),
          createImageLayer({
            name: "Photo droite",
            transform: { ...square(f, 0.7, 0.5, 0.55), rotation: 4 },
            mask: { shape: "rounded", radius: 36 },
            border: { width: 12, color: "#ffffff" },
            animation: { enter: "slide-left", enterDelayInFrames: 8, enterDurationInFrames: 18 },
          }),
        ],
      }),
  },
  {
    id: "photo-soft",
    name: "Photo bord flou",
    build: (f) =>
      createScene({
        name: "Photo bord flou",
        durationInFrames: 4 * f.fps,
        background: { type: "color", color: "#111827" },
        transitionIn: { kind: "slide-left", durationInFrames: 18 },
        layers: [
          createImageLayer({
            name: "Photo",
            transform: box(f, 0.05, 0.08, 0.9, 0.84),
            mask: { shape: "circle", feather: 120 },
            animation: { enter: "fade", enterDurationInFrames: 24, kenBurns: 0.12 },
          }),
        ],
      }),
  },
  {
    id: "outro",
    name: "Fin",
    build: (f) =>
      createScene({
        name: "Fin",
        durationInFrames: 3 * f.fps,
        background: { type: "gradient", from: "#0f172a", to: "#312e81", angle: 180 },
        transitionIn: { kind: "fade", durationInFrames: 24 },
        layers: [
          createShapeLayer({
            name: "Cœur",
            shape: "heart",
            fill: "#f43f5e",
            transform: square(f, 0.5, 0.38, 0.16),
            animation: { enter: "pop", enterDurationInFrames: 24 },
          }),
          createTextLayer({
            name: "Merci",
            text: "Merci d'avoir regardé",
            fontFamily: "Montserrat",
            fontSize: Math.round(72 * fontScale(f)),
            transform: box(f, 0.1, 0.56, 0.8, 0.14),
            animation: { enter: "slide-up", enterDelayInFrames: 10, exit: "fade" },
          }),
        ],
      }),
  },
];

const template = (id: string) => SCENE_TEMPLATES.find((t) => t.id === id) as SceneTemplate;

/** Projet de démonstration chargé au premier lancement. */
export function createDemoProject(format: ProjectFormat = FORMATS.landscape): Project {
  return createProject({
    name: "Mon premier montage",
    format,
    scenes: ["title", "photo-heart", "duo", "outro"].map((id) => template(id).build(format)),
  });
}
