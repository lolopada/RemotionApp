import { continueRender, delayRender } from "remotion";

/**
 * Catalogue des polices proposées dans l'éditeur (Google Fonts via
 * @remotion/google-fonts). Chaque police est un module chargé à la demande :
 * rien n'est téléchargé tant qu'aucun texte ne l'utilise.
 * Pour en ajouter une : une ligne ici (nom d'import = nom sans espaces,
 * ex. « BebasNeue »), avec ses graisses disponibles.
 * (Plus tard, pour tout héberger soi-même : @remotion/fonts + fichiers locaux.)
 */

export const FONT_CATEGORIES = ["Modernes", "Impact", "Arrondies", "Élégantes", "Manuscrites", "Rétro & fun"] as const;
export type FontCategory = (typeof FONT_CATEGORIES)[number];

interface FontModule {
  loadFont: (
    style?: string,
    options?: { weights?: string[]; subsets?: string[]; ignoreTooManyRequestsWarning?: boolean },
  ) => { waitUntilDone: () => Promise<unknown> };
}

export interface FontInfo {
  /** Nom CSS (celui enregistré dans le projet). */
  family: string;
  /** Nom affiché. */
  label: string;
  category: FontCategory;
  weights: number[];
  /** Graisses disponibles en italique (vide = italique simulé par le navigateur). */
  italic: number[];
  load: () => Promise<unknown>;
}

export const FONT_CATALOG: FontInfo[] = [
  {
    family: "Inter",
    label: "Inter",
    category: "Modernes",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    italic: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    load: () => import("@remotion/google-fonts/Inter"),
  },
  {
    family: "Montserrat",
    label: "Montserrat",
    category: "Modernes",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    italic: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    load: () => import("@remotion/google-fonts/Montserrat"),
  },
  {
    family: "Poppins",
    label: "Poppins",
    category: "Modernes",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    italic: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    load: () => import("@remotion/google-fonts/Poppins"),
  },
  {
    family: "Raleway",
    label: "Raleway",
    category: "Modernes",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    italic: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    load: () => import("@remotion/google-fonts/Raleway"),
  },
  {
    family: "League Spartan",
    label: "League Spartan",
    category: "Modernes",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    italic: [],
    load: () => import("@remotion/google-fonts/LeagueSpartan"),
  },
  {
    family: "DM Sans",
    label: "DM Sans",
    category: "Modernes",
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    italic: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    load: () => import("@remotion/google-fonts/DMSans"),
  },
  {
    family: "Bebas Neue",
    label: "Bebas Neue",
    category: "Impact",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/BebasNeue"),
  },
  {
    family: "Anton",
    label: "Anton",
    category: "Impact",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Anton"),
  },
  {
    family: "Oswald",
    label: "Oswald",
    category: "Impact",
    weights: [200, 300, 400, 500, 600, 700],
    italic: [],
    load: () => import("@remotion/google-fonts/Oswald"),
  },
  {
    family: "Archivo Black",
    label: "Archivo Black",
    category: "Impact",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/ArchivoBlack"),
  },
  {
    family: "Bangers",
    label: "Bangers",
    category: "Impact",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Bangers"),
  },
  {
    family: "Nunito",
    label: "Nunito",
    category: "Arrondies",
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    italic: [200, 300, 400, 500, 600, 700, 800, 900],
    load: () => import("@remotion/google-fonts/Nunito"),
  },
  {
    family: "Quicksand",
    label: "Quicksand",
    category: "Arrondies",
    weights: [300, 400, 500, 600, 700],
    italic: [],
    load: () => import("@remotion/google-fonts/Quicksand"),
  },
  {
    family: "Fredoka",
    label: "Fredoka",
    category: "Arrondies",
    weights: [300, 400, 500, 600, 700],
    italic: [],
    load: () => import("@remotion/google-fonts/Fredoka"),
  },
  {
    family: "Baloo Two",
    label: "Baloo 2",
    category: "Arrondies",
    weights: [400, 500, 600, 700, 800],
    italic: [],
    load: () => import("@remotion/google-fonts/Baloo2"),
  },
  {
    family: "Comfortaa",
    label: "Comfortaa",
    category: "Arrondies",
    weights: [300, 400, 500, 600, 700],
    italic: [],
    load: () => import("@remotion/google-fonts/Comfortaa"),
  },
  {
    family: "Varela Round",
    label: "Varela Round",
    category: "Arrondies",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/VarelaRound"),
  },
  {
    family: "Playfair Display",
    label: "Playfair Display",
    category: "Élégantes",
    weights: [400, 500, 600, 700, 800, 900],
    italic: [400, 500, 600, 700, 800, 900],
    load: () => import("@remotion/google-fonts/PlayfairDisplay"),
  },
  {
    family: "Cormorant Garamond",
    label: "Cormorant Garamond",
    category: "Élégantes",
    weights: [300, 400, 500, 600, 700],
    italic: [300, 400, 500, 600, 700],
    load: () => import("@remotion/google-fonts/CormorantGaramond"),
  },
  {
    family: "Lora",
    label: "Lora",
    category: "Élégantes",
    weights: [400, 500, 600, 700],
    italic: [400, 500, 600, 700],
    load: () => import("@remotion/google-fonts/Lora"),
  },
  {
    family: "Cinzel",
    label: "Cinzel",
    category: "Élégantes",
    weights: [400, 500, 600, 700, 800, 900],
    italic: [],
    load: () => import("@remotion/google-fonts/Cinzel"),
  },
  {
    family: "DM Serif Display",
    label: "DM Serif Display",
    category: "Élégantes",
    weights: [400],
    italic: [400],
    load: () => import("@remotion/google-fonts/DMSerifDisplay"),
  },
  {
    family: "Libre Baskerville",
    label: "Libre Baskerville",
    category: "Élégantes",
    weights: [400, 500, 600, 700],
    italic: [400, 500, 600, 700],
    load: () => import("@remotion/google-fonts/LibreBaskerville"),
  },
  {
    family: "Abril Fatface",
    label: "Abril Fatface",
    category: "Élégantes",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/AbrilFatface"),
  },
  {
    family: "Dancing Script",
    label: "Dancing Script",
    category: "Manuscrites",
    weights: [400, 500, 600, 700],
    italic: [],
    load: () => import("@remotion/google-fonts/DancingScript"),
  },
  {
    family: "Great Vibes",
    label: "Great Vibes",
    category: "Manuscrites",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/GreatVibes"),
  },
  {
    family: "Pacifico",
    label: "Pacifico",
    category: "Manuscrites",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Pacifico"),
  },
  {
    family: "Satisfy",
    label: "Satisfy",
    category: "Manuscrites",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Satisfy"),
  },
  {
    family: "Caveat",
    label: "Caveat",
    category: "Manuscrites",
    weights: [400, 500, 600, 700],
    italic: [],
    load: () => import("@remotion/google-fonts/Caveat"),
  },
  {
    family: "Sacramento",
    label: "Sacramento",
    category: "Manuscrites",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Sacramento"),
  },
  {
    family: "Parisienne",
    label: "Parisienne",
    category: "Manuscrites",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Parisienne"),
  },
  {
    family: "Kaushan Script",
    label: "Kaushan Script",
    category: "Manuscrites",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/KaushanScript"),
  },
  {
    family: "Amatic SC",
    label: "Amatic SC",
    category: "Manuscrites",
    weights: [400, 700],
    italic: [],
    load: () => import("@remotion/google-fonts/AmaticSC"),
  },
  {
    family: "Shadows Into Light",
    label: "Shadows Into Light",
    category: "Manuscrites",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/ShadowsIntoLight"),
  },
  {
    family: "Permanent Marker",
    label: "Permanent Marker",
    category: "Manuscrites",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/PermanentMarker"),
  },
  {
    family: "Lobster",
    label: "Lobster",
    category: "Rétro & fun",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Lobster"),
  },
  {
    family: "Righteous",
    label: "Righteous",
    category: "Rétro & fun",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Righteous"),
  },
  {
    family: "Monoton",
    label: "Monoton",
    category: "Rétro & fun",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Monoton"),
  },
  {
    family: "Bungee",
    label: "Bungee",
    category: "Rétro & fun",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/Bungee"),
  },
  {
    family: "Press Start TwoP",
    label: "Press Start 2P",
    category: "Rétro & fun",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/PressStart2P"),
  },
  {
    family: "Special Elite",
    label: "Special Elite",
    category: "Rétro & fun",
    weights: [400],
    italic: [],
    load: () => import("@remotion/google-fonts/SpecialElite"),
  },
  {
    family: "Courier Prime",
    label: "Courier Prime",
    category: "Rétro & fun",
    weights: [400, 700],
    italic: [400, 700],
    load: () => import("@remotion/google-fonts/CourierPrime"),
  },
];

const byFamily = new Map(FONT_CATALOG.map((f) => [f.family, f]));
export const getFontInfo = (family: string) => byFamily.get(family);

/** Liste simple des noms (compatibilité). */
export const FONT_FAMILIES = FONT_CATALOG.map((f) => f.family);

/** Graisse disponible la plus proche de celle demandée. */
export function nearestWeight(family: string, weight: number, italic = false): number {
  const info = byFamily.get(family);
  const list = info ? (italic && info.italic.length ? info.italic : info.weights) : [400];
  return list.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), list[0] ?? 400);
}

const loaded = new Set<string>();

/**
 * Charge une police (une seule graisse/un seul style, sous-ensemble latin).
 * Bloque le rendu (delayRender) tant qu'elle n'est pas prête : l'export
 * n'encode jamais une image avec la mauvaise police.
 */
export function ensureFont(family: string, weight = 400, italic = false) {
  const info = byFamily.get(family);
  if (!info) return;
  const style = italic && info.italic.length ? "italic" : "normal";
  const w = nearestWeight(family, weight, style === "italic");
  const key = `${family}|${w}|${style}`;
  if (loaded.has(key)) return;
  loaded.add(key);
  const handle = delayRender(`Police ${family} ${w} ${style}`, { timeoutInMilliseconds: 30_000 });
  info
    .load()
    .then((m) =>
      (m as FontModule)
        .loadFont(style, { weights: [String(w)], subsets: ["latin"], ignoreTooManyRequestsWarning: true })
        .waitUntilDone(),
    )
    .catch((err) => console.warn(`Police ${family} indisponible`, err))
    .finally(() => continueRender(handle));
}
