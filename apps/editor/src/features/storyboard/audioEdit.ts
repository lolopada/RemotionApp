/**
 * Découpe et déplacement d'un morceau sur la piste audio. Fonctions pures, en frames.
 * Le morceau a un début dans la vidéo (`startFrame`), une durée et un point de départ dans
 * le fichier (`trimStartFrames`) : couper un bord change les trois de façon cohérente.
 */

export interface ClipGeom {
  startFrame: number;
  durationInFrames: number;
  trimStartFrames: number;
}

export const MIN_CLIP_FRAMES = 3;

/** Aimante `value` sur la cible la plus proche (à `threshold` frames près). */
export function snapTo(value: number, targets: number[], threshold: number): number {
  let best = value;
  let bestDist = threshold + 1;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d <= threshold && d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best;
}

/** Déplace le morceau : son début ou sa fin s'aimante sur un repère (changement de scène, début, fin). */
export function moveClip(clip: ClipGeom, delta: number, targets: number[], threshold: number): ClipGeom {
  const raw = Math.max(0, Math.round(clip.startFrame + delta));
  const end = raw + clip.durationInFrames;
  const a = snapTo(raw, targets, threshold);
  const b = snapTo(end, targets, threshold) - clip.durationInFrames;
  // Parmi les aimantations possibles (début ou fin), on garde celle qui déplace le moins.
  const snapped = [a, b].filter((v) => v !== raw).sort((x, y) => Math.abs(x - raw) - Math.abs(y - raw))[0];
  const startFrame = Math.max(0, snapped ?? raw);
  return { ...clip, startFrame };
}

/** Coupe le début : le bord gauche suit la souris, le fichier avance d'autant. */
export function trimClipStart(clip: ClipGeom, delta: number, targets: number[], threshold: number): ClipGeom {
  const end = clip.startFrame + clip.durationInFrames;
  // On ne peut pas reculer au-delà du début du fichier (trim 0) ni du début de la vidéo.
  const min = clip.startFrame - Math.min(clip.startFrame, clip.trimStartFrames);
  const max = end - MIN_CLIP_FRAMES;
  const wanted = snapTo(Math.round(clip.startFrame + delta), targets, threshold);
  const start = Math.min(max, Math.max(min, wanted));
  const moved = start - clip.startFrame;
  return {
    startFrame: start,
    durationInFrames: clip.durationInFrames - moved,
    trimStartFrames: clip.trimStartFrames + moved,
  };
}

/** Coupe la fin : plafonnée par la longueur du fichier quand elle est connue (`fileFrames`). */
export function trimClipEnd(
  clip: ClipGeom,
  delta: number,
  fileFrames: number | null,
  targets: number[],
  threshold: number,
): ClipGeom {
  const wanted = snapTo(Math.round(clip.startFrame + clip.durationInFrames + delta), targets, threshold);
  let duration = Math.max(MIN_CLIP_FRAMES, wanted - clip.startFrame);
  if (fileFrames !== null) duration = Math.min(duration, Math.max(MIN_CLIP_FRAMES, fileFrames - clip.trimStartFrames));
  return { ...clip, durationInFrames: duration };
}
