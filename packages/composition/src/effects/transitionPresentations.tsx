import type { TransitionKind } from "@app/schema";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { CSSProperties } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

type CustomKind =
  | "fade"
  | "wipe-diagonal"
  | "fade-black"
  | "fade-white"
  | "zoom-in"
  | "zoom-out"
  | "flip"
  | "iris"
  | "clock";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Accélère puis ralentit : plus naturel qu'une progression linéaire pour ces effets. */
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (2 - 2 * x) ** 3 / 2);

export interface TransitionFrame {
  /** Style de la scène (entrante ou sortante). */
  style: CSSProperties;
  /** Voile de couleur dessiné par-dessus les deux scènes (fondu au noir / au blanc). */
  overlay?: { color: string; opacity: number };
}

const r = (n: number) => Math.round(n * 100) / 100;

/** Secteur d'horloge : du haut, dans le sens horaire, jusqu'à `angle` degrés. */
function clockPolygon(angle: number, w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  // Rayon assez grand pour que les côtés du polygone dépassent toujours du cadre.
  const radius = Math.hypot(w, h);
  const pts: string[] = [`${r(cx)}px ${r(cy)}px`];
  const steps = Math.max(1, Math.ceil(angle / 15));
  for (let i = 0; i <= steps; i++) {
    const a = ((angle * i) / steps - 90) * (Math.PI / 180);
    pts.push(`${r(cx + radius * Math.cos(a))}px ${r(cy + radius * Math.sin(a))}px`);
  }
  return `polygon(${pts.join(", ")})`;
}

/**
 * Style d'une scène à un instant de la transition (`progress` : 0 → 1).
 * Fonction pure, utilisée par la composition (aperçu et export) et testée seule.
 * Le DOM de la scène entrante est dessiné par-dessus celui de la sortante.
 */
export function customTransitionFrame(
  kind: CustomKind,
  direction: "entering" | "exiting",
  progress: number,
  width: number,
  height: number,
): TransitionFrame {
  const entering = direction === "entering";
  const p = clamp01(progress);
  const e = ease(p);
  switch (kind) {
    case "fade":
      return entering ? { style: { opacity: p } } : { style: {} };
    case "zoom-in":
      // La caméra avance : l'ancienne scène grossit, la nouvelle se pose depuis un léger recul.
      return entering
        ? { style: { opacity: e, transform: `scale(${r(0.7 + 0.3 * e)})` } }
        : { style: { transform: `scale(${r(1 + 0.5 * e)})` } };
    case "zoom-out":
      // La caméra recule : l'ancienne scène rétrécit, la nouvelle arrive en grand.
      return entering
        ? { style: { opacity: e, transform: `scale(${r(1.4 - 0.4 * e)})` } }
        : { style: { transform: `scale(${r(1 - 0.3 * e)})` } };
    case "flip": {
      // Retournement autour de l'axe vertical : la scène sortante se referme, l'entrante s'ouvre.
      const s = entering ? clamp01(2 * e - 1) : clamp01(1 - 2 * e);
      return { style: { opacity: s <= 0.002 ? 0 : 1, transform: `scaleX(${r(Math.max(0.002, s))})` } };
    }
    case "iris": {
      if (!entering) return { style: {} };
      if (p >= 1) return { style: {} };
      const radius = e * (Math.hypot(width, height) / 2);
      return { style: { clipPath: `circle(${r(radius)}px at 50% 50%)` } };
    }
    case "clock": {
      if (!entering || p >= 1) return { style: {} };
      if (e <= 0.001) return { style: { clipPath: "inset(50%)" } };
      return { style: { clipPath: clockPolygon(e * 360, width, height) } };
    }
    case "wipe-diagonal": {
      if (!entering || p >= 1) return { style: {} };
      // Le bord progresse du coin haut-gauche au coin bas-droit : x/w + y/h = 2e.
      const t = 2 * e;
      if (t <= 0.001) return { style: { clipPath: "inset(50%)" } };
      return {
        style: {
          clipPath: `polygon(0px 0px, ${r(t * width)}px 0px, 0px ${r(t * height)}px)`,
        },
      };
    }
    case "fade-black":
    case "fade-white": {
      // Première moitié : la scène sortante disparaît sous le voile ; seconde : l'entrante en sort.
      const visible = entering ? p >= 0.5 : p < 0.5;
      return {
        style: { opacity: visible ? 1 : 0 },
        overlay: {
          color: kind === "fade-black" ? "#000" : "#fff",
          opacity: p < 0.5 ? 2 * p : 2 * (1 - p),
        },
      };
    }
  }
}

/**
 * L'export navigateur applique `opacity` élément par élément : sur une scène faite d'un fond
 * et de plusieurs calques, le fond laisse alors transparaître la scène du dessous et le fondu
 * ne ressemble plus à l'aperçu. Il ne traite une opacité « en groupe » (comme le CSS) que si un
 * descendant a un `mix-blend-mode` : ce point transparent de 1 px, sans effet visuel, suffit à
 * isoler la scène et à la dessiner d'un bloc avant de la fondre.
 */
function OpacityGroupMarker() {
  return (
    <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, mixBlendMode: "multiply" }} />
  );
}

function CustomPresentation({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}: TransitionPresentationComponentProps<{ kind: CustomKind }>) {
  const { width, height } = useVideoConfig();
  const frame = customTransitionFrame(passedProps.kind, presentationDirection, presentationProgress, width, height);
  const opacity = frame.style.opacity;
  // Voir `OpacityGroupMarker` : nécessaire dès qu'une scène est semi-transparente.
  const needsGroup = typeof opacity === "number" && opacity > 0 && opacity < 1;
  return (
    <>
      <AbsoluteFill showInTimeline={false} style={frame.style}>
        {needsGroup ? <OpacityGroupMarker /> : null}
        {children}
      </AbsoluteFill>
      {/* Le voile n'est dessiné que par la scène entrante, qui est au-dessus de l'autre. */}
      {frame.overlay && presentationDirection === "entering" ? (
        <AbsoluteFill
          showInTimeline={false}
          style={{ backgroundColor: frame.overlay.color, opacity: frame.overlay.opacity }}
        />
      ) : null}
    </>
  );
}

const custom = (kind: CustomKind): TransitionPresentation<{ kind: CustomKind }> => ({
  component: CustomPresentation,
  props: { kind },
});

/**
 * Traduit une transition du schéma en présentation Remotion.
 * On s'en tient à des transitions faites d'opacité, de transform et de
 * clip-path (polygon, circle, inset), compatibles avec le rendu dans le navigateur :
 * les présentations WebGL de Remotion (dissolve, cross-zoom…) ne sont pas utilisées.
 */
// biome-ignore lint/suspicious/noExplicitAny: chaque présentation a ses propres props
export function getPresentation(kind: Exclude<TransitionKind, "none">): TransitionPresentation<any> {
  switch (kind) {
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
    default:
      return custom(kind);
  }
}

/** Ordre d'affichage dans la liste déroulante. */
export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  none: "Aucune (coupe)",
  fade: "Fondu enchaîné",
  "fade-black": "Fondu au noir",
  "fade-white": "Fondu au blanc",
  "slide-left": "Glissement ←",
  "slide-right": "Glissement →",
  "slide-up": "Glissement ↑",
  "wipe-left": "Volet ←",
  "wipe-right": "Volet →",
  "wipe-diagonal": "Volet en diagonale",
  "zoom-in": "Zoom avant",
  "zoom-out": "Zoom arrière",
  flip: "Retournement",
  iris: "Iris (cercle)",
  clock: "Balayage d'horloge",
};
