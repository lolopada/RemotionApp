import { type TextLayer, type TextLayerInput, TextLayerSchema } from "@app/schema";

/**
 * Styles de texte prêts à l'emploi. Un style ne touche ni au texte, ni à la
 * position, ni à la taille d'un calque existant : seulement à son apparence.
 * Ajouter un style = ajouter une entrée ci-dessous.
 */
type StyleInput = Partial<Omit<TextLayerInput, "id" | "type" | "text" | "transform" | "name">>;

export interface TextPreset {
  id: string;
  name: string;
  /** Texte d'exemple (aperçu + nouveau calque). */
  sample: string;
  /** Taille de police pour un projet 1080p (adaptée aux autres formats). */
  size: number;
  /** Fond de la vignette d'aperçu. */
  previewBg: string;
  style: StyleInput;
}

const noShadow = { shadow: false } as const;

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: "neon",
    name: "Néon",
    sample: "Néon",
    size: 120,
    previewBg: "#0b0820",
    style: {
      fontFamily: "Righteous",
      fontWeight: 400,
      color: "#fff0fb",
      shadow: true,
      shadowColor: "#ff2fd6",
      shadowOpacity: 1,
      shadowBlur: 18,
      shadowX: 0,
      shadowY: 0,
    },
  },
  {
    id: "cine",
    name: "Sous-titre ciné",
    sample: "Il était une fois…",
    size: 46,
    previewBg: "#374151",
    style: {
      fontFamily: "Inter",
      fontWeight: 500,
      color: "#ffffff",
      ...noShadow,
      box: { enabled: true, color: "#000000", opacity: 0.7, radius: 6, paddingX: 24, paddingY: 10 },
    },
  },
  {
    id: "etiquette",
    name: "Étiquette",
    sample: "Nouveau",
    size: 42,
    previewBg: "#fdf2f8",
    style: {
      fontFamily: "Montserrat",
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: 4,
      color: "#ffffff",
      ...noShadow,
      box: { enabled: true, color: "#f43f5e", opacity: 1, radius: 999, paddingX: 38, paddingY: 14 },
    },
  },
  {
    id: "impact",
    name: "Impact",
    sample: "Énorme",
    size: 150,
    previewBg: "#1c1917",
    style: {
      fontFamily: "Anton",
      fontWeight: 400,
      textTransform: "uppercase",
      lineHeight: 1,
      gradient: { enabled: true, from: "#fde047", to: "#f97316", angle: 180 },
      shadow: true,
      shadowColor: "#7c2d12",
      shadowOpacity: 0.9,
      shadowBlur: 0,
      shadowX: 7,
      shadowY: 7,
    },
  },
  {
    id: "dore",
    name: "Élégant doré",
    sample: "Prestige",
    size: 84,
    previewBg: "#111827",
    style: {
      fontFamily: "Cinzel",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 10,
      gradient: { enabled: true, from: "#fef3c7", to: "#b45309", angle: 180 },
      ...noShadow,
    },
  },
  {
    id: "manuscrit",
    name: "Manuscrit",
    sample: "Avec amour",
    size: 130,
    previewBg: "#4c1d95",
    style: {
      fontFamily: "Great Vibes",
      fontWeight: 400,
      color: "#fde68a",
      shadow: true,
      shadowColor: "#000000",
      shadowOpacity: 0.45,
      shadowBlur: 20,
      shadowX: 0,
      shadowY: 4,
    },
  },
  {
    id: "autocollant",
    name: "Autocollant",
    sample: "Wow !",
    size: 110,
    previewBg: "#38bdf8",
    style: {
      fontFamily: "Bungee",
      fontWeight: 400,
      color: "#fde047",
      strokeWidth: 10,
      strokeColor: "#1e1b4b",
      shadow: true,
      shadowColor: "#1e1b4b",
      shadowOpacity: 1,
      shadowBlur: 0,
      shadowX: 0,
      shadowY: 9,
    },
  },
  {
    id: "machine",
    name: "Machine à écrire",
    sample: "Cher journal…",
    size: 58,
    previewBg: "#78716c",
    style: {
      fontFamily: "Special Elite",
      fontWeight: 400,
      color: "#1f2937",
      ...noShadow,
      box: { enabled: true, color: "#fefce8", opacity: 1, radius: 4, paddingX: 30, paddingY: 16 },
      textAnimation: { kind: "typewriter", durationInFrames: 45 },
      animation: { enter: "none" },
    },
  },
  {
    id: "surligne",
    name: "Surligné",
    sample: "À retenir",
    size: 96,
    previewBg: "#ffffff",
    style: {
      fontFamily: "Caveat",
      fontWeight: 700,
      color: "#111827",
      ...noShadow,
      textAnimation: { kind: "highlight", durationInFrames: 24, highlightColor: "#fde047" },
      animation: { enter: "fade" },
    },
  },
  {
    id: "pastel",
    name: "Pop pastel",
    sample: "Coucou !",
    size: 90,
    previewBg: "#fef3c7",
    style: {
      fontFamily: "Fredoka",
      fontWeight: 700,
      color: "#ffffff",
      ...noShadow,
      box: { enabled: true, color: "#a78bfa", opacity: 1, radius: 40, paddingX: 42, paddingY: 16 },
      animation: { enter: "pop", enterDurationInFrames: 22 },
    },
  },
  {
    id: "degrade",
    name: "Dégradé moderne",
    sample: "Nouvelle saison",
    size: 110,
    previewBg: "#0f172a",
    style: {
      fontFamily: "Poppins",
      fontWeight: 900,
      gradient: { enabled: true, from: "#f472b6", to: "#8b5cf6", angle: 180 },
      ...noShadow,
      textAnimation: { kind: "words", durationInFrames: 24 },
      animation: { enter: "none" },
    },
  },
  {
    id: "pixel",
    name: "Pixel rétro",
    sample: "Game over",
    size: 52,
    previewBg: "#0f172a",
    style: {
      fontFamily: "Press Start TwoP",
      fontWeight: 400,
      textTransform: "uppercase",
      lineHeight: 1.5,
      color: "#22d3ee",
      shadow: true,
      shadowColor: "#a21caf",
      shadowOpacity: 1,
      shadowBlur: 0,
      shadowX: 5,
      shadowY: 5,
    },
  },
  {
    id: "lettres",
    name: "Lettre par lettre",
    sample: "Il était une fois",
    size: 96,
    previewBg: "#1e1b4b",
    style: {
      fontFamily: "Playfair Display",
      fontWeight: 700,
      fontStyle: "italic",
      color: "#ffffff",
      textAnimation: { kind: "letters", durationInFrames: 40 },
      animation: { enter: "none" },
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    sample: "Simplement",
    size: 76,
    previewBg: "#e5e7eb",
    style: {
      fontFamily: "DM Sans",
      fontWeight: 300,
      letterSpacing: 2,
      color: "#111827",
      ...noShadow,
    },
  },
];

/** Champs d'apparence remis à zéro puis remplis par le style (le reste du calque est conservé). */
const STYLE_KEYS = [
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "textTransform",
  "color",
  "lineHeight",
  "letterSpacing",
  "gradient",
  "shadow",
  "shadowColor",
  "shadowOpacity",
  "shadowBlur",
  "shadowX",
  "shadowY",
  "strokeWidth",
  "strokeColor",
  "box",
  "textAnimation",
] as const;

/** Apparence complète d'un style (valeurs par défaut + celles du style). */
export function resolvePresetStyle(preset: TextPreset): Pick<TextLayer, (typeof STYLE_KEYS)[number]> & {
  animation?: TextLayer["animation"];
} {
  const full = TextLayerSchema.parse({
    id: "preset",
    type: "text",
    text: "",
    transform: { x: 0, y: 0, width: 1, height: 1 },
    ...preset.style,
  });
  const out = Object.fromEntries(STYLE_KEYS.map((k) => [k, full[k]])) as Pick<TextLayer, (typeof STYLE_KEYS)[number]>;
  return preset.style.animation ? { ...out, animation: full.animation } : out;
}

/** Applique un style à un calque texte (brouillon immer). */
export function applyPreset(layer: TextLayer, preset: TextPreset) {
  const { animation, ...style } = resolvePresetStyle(preset);
  Object.assign(layer, structuredClone(style));
  if (animation) layer.animation = { ...layer.animation, enter: animation.enter };
}
