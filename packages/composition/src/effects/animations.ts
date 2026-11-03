import type { LayerAnimation } from "@app/schema";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

export interface AnimationStyle {
  opacity: number;
  /** Transformations CSS à ajouter après la rotation du calque. */
  transform: string;
}

/**
 * Calcule l'opacité et la transformation d'un calque à la frame courante
 * (frame relative au début de la scène).
 */
export function useLayerAnimation(animation: LayerAnimation, sceneDurationInFrames: number): AnimationStyle {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let opacity = 1;
  let scale = 1;
  let tx = 0;
  let ty = 0;

  // Entrée
  const t = frame - animation.enterDelayInFrames;
  const d = animation.enterDurationInFrames;
  const p =
    animation.enter === "pop"
      ? spring({ frame: t, fps, durationInFrames: d, config: { damping: 11, mass: 0.6 } })
      : interpolate(t, [0, d], [0, 1], { ...clamp, easing: easeOut });

  switch (animation.enter) {
    case "none":
      break;
    case "fade":
      opacity *= p;
      break;
    case "zoom":
      opacity *= p;
      scale *= 0.8 + 0.2 * p;
      break;
    case "slide-up":
      opacity *= p;
      ty += (1 - p) * 80;
      break;
    case "slide-left":
      opacity *= p;
      tx += (1 - p) * 120;
      break;
    case "pop":
      opacity *= Math.min(1, Math.max(0, t) / 4);
      scale *= p;
      break;
  }

  // Sortie
  if (animation.exit !== "none") {
    const ed = Math.min(animation.exitDurationInFrames, sceneDurationInFrames);
    const q = interpolate(frame, [sceneDurationInFrames - ed, sceneDurationInFrames], [0, 1], {
      ...clamp,
      easing: Easing.in(Easing.cubic),
    });
    switch (animation.exit) {
      case "fade":
        opacity *= 1 - q;
        break;
      case "zoom":
        opacity *= 1 - q;
        scale *= 1 - 0.2 * q;
        break;
      case "slide-down":
        opacity *= 1 - q;
        ty += q * 80;
        break;
    }
  }

  return { opacity, transform: `translate(${tx}px, ${ty}px) scale(${scale})` };
}

/** Facteur de zoom lent (Ken Burns) pour l'image à l'intérieur de son cadre. */
export function useKenBurnsScale(amount: number, sceneDurationInFrames: number): number {
  const frame = useCurrentFrame();
  if (amount <= 0) return 1;
  return 1 + amount * interpolate(frame, [0, sceneDurationInFrames], [0, 1], clamp);
}
