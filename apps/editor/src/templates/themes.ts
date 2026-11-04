import type { Theme } from "@app/schema";

/**
 * Thèmes prêts à l'emploi : 5 couleurs à rôles fixes (fond, fond 2, accent,
 * titres, textes) et deux polices du catalogue (`packages/composition/src/fonts.ts`).
 */
export const THEME_PRESETS: Theme[] = [
  {
    name: "Nuit violette",
    colors: { background: "#1e1b4b", background2: "#7c3aed", accent: "#f472b6", title: "#ffffff", text: "#e9d5ff" },
    headingFont: "Montserrat",
    bodyFont: "Inter",
  },
  {
    name: "Mariage",
    colors: { background: "#fdf2f8", background2: "#fbcfe8", accent: "#be185d", title: "#831843", text: "#9d174d" },
    headingFont: "Great Vibes",
    bodyFont: "Cormorant Garamond",
  },
  {
    name: "Voyage",
    colors: { background: "#0c4a6e", background2: "#0891b2", accent: "#fbbf24", title: "#ffffff", text: "#e0f2fe" },
    headingFont: "Bebas Neue",
    bodyFont: "DM Sans",
  },
  {
    name: "Anniversaire",
    colors: { background: "#fef3c7", background2: "#fde68a", accent: "#f43f5e", title: "#7c2d12", text: "#9a3412" },
    headingFont: "Fredoka",
    bodyFont: "Nunito",
  },
  {
    name: "Élégant",
    colors: { background: "#111111", background2: "#3f3f46", accent: "#d4af37", title: "#f5f5f4", text: "#d6d3d1" },
    headingFont: "Playfair Display",
    bodyFont: "Lora",
  },
  {
    name: "Nature",
    colors: { background: "#14532d", background2: "#4d7c0f", accent: "#facc15", title: "#f7fee7", text: "#d9f99d" },
    headingFont: "DM Serif Display",
    bodyFont: "Quicksand",
  },
  {
    name: "Pop",
    colors: { background: "#2563eb", background2: "#22d3ee", accent: "#facc15", title: "#ffffff", text: "#ffffff" },
    headingFont: "Bangers",
    bodyFont: "Poppins",
  },
  {
    name: "Minimal clair",
    colors: { background: "#ffffff", background2: "#e5e7eb", accent: "#111827", title: "#111827", text: "#4b5563" },
    headingFont: "League Spartan",
    bodyFont: "Inter",
  },
  {
    name: "Coucher de soleil",
    colors: { background: "#7c2d12", background2: "#f97316", accent: "#fde047", title: "#fff7ed", text: "#ffedd5" },
    headingFont: "Anton",
    bodyFont: "Raleway",
  },
  {
    name: "Rétro",
    colors: { background: "#fef9c3", background2: "#fca5a5", accent: "#0f766e", title: "#1f2937", text: "#374151" },
    headingFont: "Righteous",
    bodyFont: "Courier Prime",
  },
  {
    name: "Carnet",
    colors: { background: "#f5f5f4", background2: "#d6d3d1", accent: "#2563eb", title: "#1c1917", text: "#44403c" },
    headingFont: "Caveat",
    bodyFont: "Shadows Into Light",
  },
  {
    name: "Néon",
    colors: { background: "#020617", background2: "#312e81", accent: "#22d3ee", title: "#f0abfc", text: "#a5f3fc" },
    headingFont: "Monoton",
    bodyFont: "Varela Round",
  },
];

export const THEME_ROLE_LABELS: Record<keyof Theme["colors"], string> = {
  background: "Fond",
  background2: "Fond 2",
  accent: "Accent",
  title: "Titres",
  text: "Textes",
};
