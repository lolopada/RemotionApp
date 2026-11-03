import type { Project, Scene } from "./project";

/**
 * Durée réelle d'une transition entre deux scènes.
 * Une transition fait chevaucher les deux scènes : elle ne peut pas être
 * plus longue que l'une ou l'autre (on garde 1 frame de marge).
 */
export function getEffectiveTransitionFrames(prev: Scene | undefined, scene: Scene): number {
  if (!prev || scene.transitionIn.kind === "none") return 0;
  const max = Math.min(prev.durationInFrames, scene.durationInFrames) - 1;
  return Math.max(0, Math.min(scene.transitionIn.durationInFrames, max));
}

export interface SceneTiming {
  sceneId: string;
  /** Frame (dans la vidéo complète) où la scène commence à être visible. */
  startFrame: number;
  durationInFrames: number;
  /** Frames de chevauchement avec la scène précédente. */
  transitionFrames: number;
}

/** Calcule le placement de chaque scène sur la timeline globale. */
export function getSceneTimings(scenes: Scene[]): SceneTiming[] {
  const timings: SceneTiming[] = [];
  let cursor = 0;
  scenes.forEach((scene, i) => {
    const transitionFrames = getEffectiveTransitionFrames(scenes[i - 1], scene);
    const startFrame = cursor - transitionFrames;
    timings.push({
      sceneId: scene.id,
      startFrame,
      durationInFrames: scene.durationInFrames,
      transitionFrames,
    });
    cursor = startFrame + scene.durationInFrames;
  });
  return timings;
}

/** Durée totale de la vidéo (scènes moins les chevauchements des transitions). */
export function getProjectDurationInFrames(project: Pick<Project, "scenes">): number {
  const timings = getSceneTimings(project.scenes);
  const last = timings.at(-1);
  return last ? Math.max(1, last.startFrame + last.durationInFrames) : 1;
}

/** Scène visible à une frame donnée (la plus récente en cas de chevauchement). */
export function getSceneAtFrame(scenes: Scene[], frame: number): Scene | undefined {
  const timings = getSceneTimings(scenes);
  for (let i = timings.length - 1; i >= 0; i--) {
    const t = timings[i];
    if (t && frame >= t.startFrame) return scenes[i];
  }
  return scenes[0];
}

export const secondsToFrames = (seconds: number, fps: number) => Math.max(1, Math.round(seconds * fps));
export const framesToSeconds = (frames: number, fps: number) => frames / fps;
