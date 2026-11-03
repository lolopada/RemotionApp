import type { TransitionKind } from "@app/schema";
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

/**
 * Traduit une transition du schéma en présentation Remotion.
 * On s'en tient à des transitions faites d'opacité, de transform et de
 * clip-path polygon, compatibles avec le rendu dans le navigateur.
 */
// biome-ignore lint/suspicious/noExplicitAny: chaque présentation a ses propres props
export function getPresentation(kind: Exclude<TransitionKind, "none">): TransitionPresentation<any> {
  switch (kind) {
    case "fade":
      return fade();
    case "slide-left":
      return slide({ direction: "from-right" });
    case "slide-right":
      return slide({ direction: "from-left" });
    case "slide-up":
      return slide({ direction: "from-bottom" });
    case "wipe-left":
      return wipe({ direction: "from-right" });
    case "wipe-right":
      return wipe({ direction: "from-left" });
  }
}

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  none: "Aucune (coupe)",
  fade: "Fondu enchaîné",
  "slide-left": "Glissement ←",
  "slide-right": "Glissement →",
  "slide-up": "Glissement ↑",
  "wipe-left": "Volet ←",
  "wipe-right": "Volet →",
};
