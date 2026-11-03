import { loadFont as loadDancingScript } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

/**
 * Polices disponibles dans l'éditeur. Chaque police n'est téléchargée que
 * lorsqu'un calque texte l'utilise. Pour en ajouter : importer son loadFont
 * depuis @remotion/google-fonts/<Nom> et l'ajouter ici.
 * (Plus tard, pour tout héberger soi-même : @remotion/fonts + fichiers locaux.)
 */
const FONT_LOADERS: Record<string, () => void> = {
  Inter: () => loadInter("normal", { weights: ["400", "700", "900"], subsets: ["latin"] }),
  Montserrat: () => loadMontserrat("normal", { weights: ["400", "700", "900"], subsets: ["latin"] }),
  "Playfair Display": () => loadPlayfair("normal", { weights: ["400", "700"], subsets: ["latin"] }),
  "Dancing Script": () => loadDancingScript("normal", { weights: ["400", "700"], subsets: ["latin"] }),
  Pacifico: () => loadPacifico("normal", { weights: ["400"], subsets: ["latin"] }),
};

export const FONT_FAMILIES = Object.keys(FONT_LOADERS);

const loaded = new Set<string>();

export function ensureFont(family: string) {
  if (loaded.has(family)) return;
  const load = FONT_LOADERS[family];
  if (!load) return;
  loaded.add(family);
  load();
}
