import { getSceneTimings, type Project } from "@app/schema";
import type { PlayerRef } from "@remotion/player";
import { createRef } from "react";

/** Référence unique vers le <Player>, pour le piloter depuis n'importe où. */
export const playerRef = createRef<PlayerRef>();

/**
 * Frame « d'édition » d'une scène : un peu après son début, une fois la
 * transition et les animations d'entrée passées, pour voir les calques.
 */
export function getSceneEditFrame(project: Project, sceneId: string): number | null {
  const timing = getSceneTimings(project.scenes).find((t) => t.sceneId === sceneId);
  if (!timing) return null;
  const offset = Math.min(timing.durationInFrames - 1, timing.transitionFrames + Math.round(project.fps * 0.8));
  return timing.startFrame + offset;
}

export function isFrameInScene(project: Project, sceneId: string, frame: number): boolean {
  const timings = getSceneTimings(project.scenes);
  const i = timings.findIndex((t) => t.sceneId === sceneId);
  const t = timings[i];
  if (!t) return false;
  const next = timings[i + 1];
  // Pendant une transition, c'est la scène suivante qui « possède » la frame.
  const end = next ? next.startFrame : t.startFrame + t.durationInFrames;
  return frame >= t.startFrame && frame < end;
}
