import type { AnimationEasing, EnterAnimation, ExitAnimation, LayerAnimation } from "@app/schema";
import { Easing, spring, useCurrentFrame, useVideoConfig } from "remotion";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface AnimationStyle {
  /** Le calque n'est pas encore apparu ou a déjà disparu : ne rien dessiner. */
  hidden: boolean;
  opacity: number;
  /** Transformations CSS à ajouter après la rotation du calque. */
  transform: string;
  /** Flou « vers net » (CSS filter). */
  filter?: string;
  /** Révélation par volet (clip-path: inset). */
  clipPath?: string;
}

/**
 * Courbe de vitesse. À l'entrée on décélère (« out »), à la sortie on accélère (« in »).
 * L'élastique dépasse légèrement 0/1 : les valeurs qui en dépendent sont bornées.
 */
export function applyEasing(kind: AnimationEasing, x: number, dir: "in" | "out"): number {
  switch (kind) {
    case "linear":
      return x;
    case "inout":
      return Easing.inOut(Easing.cubic)(x);
    case "elastic":
      // Easing.elastic dépasse déjà 1 avant de se poser : c'est la forme « sortie » ; l'inverse prend de l'élan.
      return (dir === "out" ? Easing.elastic(2) : Easing.in(Easing.elastic(2)))(x);
    default:
      return (dir === "out" ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic))(x);
  }
}

/** Direction du mouvement des glissements (la sortie suit le sens, l'entrée vient du sens opposé). */
const SLIDES: Record<string, { dx: number; dy: number; dist: number }> = {
  "slide-up": { dx: 0, dy: -1, dist: 80 },
  "slide-down": { dx: 0, dy: 1, dist: 80 },
  "slide-left": { dx: -1, dy: 0, dist: 120 },
  "slide-right": { dx: 1, dy: 0, dist: 120 },
};

/** Cumul des effets : opacité, échelle, translation, rotation, flou, volet. */
interface Acc {
  opacity: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  rot: number;
  blur: number;
  clip: string | null;
}

/**
 * Applique un effet dont `h` est la part « cachée » : 1 = invisible, 0 = affiché.
 * Entrée : h va de 1 à 0. Sortie : h va de 0 à 1.
 */
function applyEffect(acc: Acc, kind: EnterAnimation | ExitAnimation, h: number, mode: "enter" | "exit") {
  const shown = 1 - h;
  switch (kind) {
    case "fade":
      acc.opacity *= clamp01(shown);
      break;
    case "zoom":
      acc.opacity *= clamp01(shown);
      acc.sx *= 1 - 0.2 * h;
      acc.sy *= 1 - 0.2 * h;
      break;
    case "slide-up":
    case "slide-down":
    case "slide-left":
    case "slide-right": {
      const s = SLIDES[kind];
      if (!s) break;
      const sign = mode === "enter" ? -1 : 1;
      acc.opacity *= clamp01(shown);
      acc.tx += sign * s.dx * s.dist * h;
      acc.ty += sign * s.dy * s.dist * h;
      break;
    }
    case "spin":
      acc.opacity *= clamp01(shown);
      acc.rot += (mode === "enter" ? -180 : 180) * h;
      acc.sx *= 1 - 0.5 * h;
      acc.sy *= 1 - 0.5 * h;
      break;
    case "flip":
      acc.opacity *= clamp01(shown * 4);
      acc.sx *= Math.max(0.001, shown);
      break;
    case "flip-v":
      acc.opacity *= clamp01(shown * 4);
      acc.sy *= Math.max(0.001, shown);
      break;
    case "blur":
      acc.opacity *= clamp01(shown * 1.5);
      acc.blur = Math.max(0, 30 * h);
      break;
    case "wipe-right":
    case "wipe-left":
    case "wipe-down":
    case "wipe-up": {
      const c = clamp01(h) * 100;
      if (c <= 0.01) break;
      // Entrée : le volet découvre le calque dans le sens indiqué ; sortie : il l'efface dans ce même sens.
      const enter = mode === "enter";
      if (kind === "wipe-right") acc.clip = enter ? `inset(0 ${c}% 0 0)` : `inset(0 0 0 ${c}%)`;
      if (kind === "wipe-left") acc.clip = enter ? `inset(0 0 0 ${c}%)` : `inset(0 ${c}% 0 0)`;
      if (kind === "wipe-down") acc.clip = enter ? `inset(0 0 ${c}% 0)` : `inset(${c}% 0 0 0)`;
      if (kind === "wipe-up") acc.clip = enter ? `inset(${c}% 0 0 0)` : `inset(0 0 ${c}% 0)`;
      break;
    }
  }
}

/**
 * Calcule l'état d'animation d'un calque à la frame courante
 * (frame relative au début de la scène).
 */
export function useLayerAnimation(animation: LayerAnimation, sceneDurationInFrames: number): AnimationStyle {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return computeAnimation(animation, frame, fps, sceneDurationInFrames);
}

/** Version pure (testable) de `useLayerAnimation`. */
export function computeAnimation(
  animation: LayerAnimation,
  frame: number,
  fps: number,
  sceneDurationInFrames: number,
): AnimationStyle {
  const start = animation.enterDelayInFrames;
  const end = animation.endAtFrame === null ? null : Math.min(animation.endAtFrame, sceneDurationInFrames);
  const hiddenStyle: AnimationStyle = { hidden: true, opacity: 0, transform: "" };
  if (frame < start) return hiddenStyle;
  if (end !== null && frame >= end) return hiddenStyle;

  const acc: Acc = { opacity: 1, sx: 1, sy: 1, tx: 0, ty: 0, rot: 0, blur: 0, clip: null };

  // Entrée
  const d = animation.enterDurationInFrames;
  const t = frame - start;
  const raw = clamp01(t / d);
  if (animation.enter === "pop") {
    const p = spring({ frame: t, fps, durationInFrames: d, config: { damping: 11, mass: 0.6 } });
    acc.opacity *= Math.min(1, Math.max(0, t) / 4);
    acc.sx *= p;
    acc.sy *= p;
  } else if (animation.enter === "bounce") {
    // Tombe du haut et rebondit ; la courbe de vitesse est celle d'une balle.
    acc.ty += -(1 - Easing.bounce(raw)) * 260;
    acc.opacity *= clamp01(raw * 10);
  } else if (animation.enter !== "none") {
    applyEffect(acc, animation.enter, 1 - applyEasing(animation.easing, raw, "out"), "enter");
  }

  // Sortie : se termine à `endAtFrame` (ou à la fin de la scène).
  if (animation.exit !== "none") {
    const exitEnd = end ?? sceneDurationInFrames;
    const ed = Math.max(1, Math.min(animation.exitDurationInFrames, exitEnd - start));
    // La dernière image visible (exitEnd - 1) est la sortie complète.
    const q = clamp01((frame - (exitEnd - ed)) / Math.max(1, ed - 1));
    if (q > 0) applyEffect(acc, animation.exit, applyEasing(animation.easing, q, "in"), "exit");
  }

  // Mouvement en boucle, à partir de l'apparition (phase 0 au début).
  const loop = animation.loop;
  if (loop.kind !== "none") {
    const secs = t / fps;
    const phase = 2 * Math.PI * (loop.speed / 4) * secs;
    switch (loop.kind) {
      case "float":
        acc.ty += -Math.sin(phase) * 16 * loop.amount;
        acc.tx += Math.sin(phase * 0.5) * 4 * loop.amount;
        break;
      case "pulse":
        acc.sx *= 1 + 0.06 * loop.amount * Math.sin(phase);
        acc.sy *= 1 + 0.06 * loop.amount * Math.sin(phase);
        break;
      case "sway":
        acc.rot += Math.sin(phase) * 6 * loop.amount;
        break;
      case "spin":
        acc.rot += secs * 30 * loop.speed;
        break;
    }
  }

  const r = (n: number) => Math.round(n * 1000) / 1000;
  return {
    hidden: false,
    opacity: clamp01(acc.opacity),
    transform: `translate(${r(acc.tx)}px, ${r(acc.ty)}px) rotate(${r(acc.rot)}deg) scale(${r(acc.sx)}, ${r(acc.sy)})`,
    filter: acc.blur > 0.05 ? `blur(${r(acc.blur)}px)` : undefined,
    clipPath: acc.clip ?? undefined,
  };
}

export interface KenBurnsState {
  /** Facteur d'échelle de l'image dans son cadre. */
  scale: number;
  /** Décalage en fraction de la taille du cadre. */
  x: number;
  y: number;
}

/**
 * Zoom lent sur toute la scène : avant, arrière, ou glissement dans une direction
 * (avec un zoom fixe de `amount`, pour avoir de la marge de chaque côté).
 */
export function useKenBurns(
  amount: number,
  mode: LayerAnimation["kenBurnsMode"],
  sceneDurationInFrames: number,
): KenBurnsState {
  const frame = useCurrentFrame();
  if (amount <= 0) return { scale: 1, x: 0, y: 0 };
  const p = clamp01(frame / Math.max(1, sceneDurationInFrames));
  switch (mode) {
    case "out":
      return { scale: 1 + amount * (1 - p), x: 0, y: 0 };
    case "pan-left":
    case "pan-right":
    case "pan-up":
    case "pan-down": {
      const scale = 1 + amount;
      // On garde 10 % de marge pour ne jamais laisser apparaître le bord de la photo.
      const lim = ((scale - 1) / 2) * 0.9;
      const k = lim * (2 * p - 1);
      return {
        scale,
        x: mode === "pan-right" ? k : mode === "pan-left" ? -k : 0,
        y: mode === "pan-down" ? k : mode === "pan-up" ? -k : 0,
      };
    }
    default:
      return { scale: 1 + amount * p, x: 0, y: 0 };
  }
}
