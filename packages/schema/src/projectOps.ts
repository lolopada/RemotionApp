import type { Layer } from "./layers";
import type { Project, Scene } from "./project";

/** Taille et cadence d'une composition. */
export interface FrameSize {
  width: number;
  height: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Un calque qui couvre (presque) toute l'image reste plein cadre après changement de format. */
const isFullBleed = (layer: Layer, from: FrameSize) => {
  const t = layer.transform;
  return (
    t.x <= from.width * 0.02 &&
    t.y <= from.height * 0.02 &&
    t.width >= from.width * 0.96 &&
    t.height >= from.height * 0.96
  );
};

/**
 * Adapte un calque à un nouveau format, comme le « redimensionnement » de Canva :
 * son centre garde la même position relative, sa taille (et tout ce qui est en px :
 * contours, ombres, marges) est multipliée par un facteur unique qui garantit qu'il
 * tient dans l'image. Un calque plein cadre reste plein cadre.
 * Un texte peut passer à la ligne : il garde une taille plus lisible (moyenne des deux
 * facteurs), sa largeur est bornée à l'image et sa hauteur grandit d'autant.
 */
export function resizeLayer(layer: Layer, from: FrameSize, to: FrameSize): void {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const fit = Math.min(sx, sy);
  let s = fit;
  const t = layer.transform;
  if (isFullBleed(layer, from)) {
    t.x = round2(t.x * sx);
    t.y = round2(t.y * sy);
    t.width = round2(t.width * sx);
    t.height = round2(t.height * sy);
  } else {
    const cx = (t.x + t.width / 2) * sx;
    const cy = (t.y + t.height / 2) * sy;
    if (layer.type === "text") {
      s = Math.sqrt(sx * sy);
      const wanted = t.width * s;
      const width = Math.min(wanted, Math.max(to.width * 0.92, t.width * fit));
      t.height = Math.max(1, round2(Math.min(to.height, t.height * s * (wanted / width))));
      t.width = Math.max(1, round2(width));
    } else {
      t.width = Math.max(1, round2(t.width * s));
      t.height = Math.max(1, round2(t.height * s));
    }
    t.x = round2(cx - t.width / 2);
    t.y = round2(cy - t.height / 2);
  }

  switch (layer.type) {
    case "text":
      layer.fontSize = Math.max(1, round2(layer.fontSize * s));
      layer.letterSpacing = round2(layer.letterSpacing * s);
      layer.strokeWidth = round2(layer.strokeWidth * s);
      layer.shadowBlur = Math.min(200, round2(layer.shadowBlur * s));
      layer.shadowX = round2(layer.shadowX * s);
      layer.shadowY = round2(layer.shadowY * s);
      layer.box.radius = round2(layer.box.radius * s);
      layer.box.paddingX = round2(layer.box.paddingX * s);
      layer.box.paddingY = round2(layer.box.paddingY * s);
      break;
    case "video":
      layer.mask.radius = round2(layer.mask.radius * s);
      layer.mask.feather = Math.min(200, round2(layer.mask.feather * s));
      layer.dropShadow.blur = Math.min(150, round2(layer.dropShadow.blur * s));
      layer.dropShadow.x = round2(layer.dropShadow.x * s);
      layer.dropShadow.y = round2(layer.dropShadow.y * s);
      break;
    case "image":
      layer.border.width = round2(layer.border.width * s);
      layer.mask.radius = round2(layer.mask.radius * s);
      layer.mask.feather = Math.min(200, round2(layer.mask.feather * s));
      layer.dropShadow.blur = Math.min(150, round2(layer.dropShadow.blur * s));
      layer.dropShadow.x = round2(layer.dropShadow.x * s);
      layer.dropShadow.y = round2(layer.dropShadow.y * s);
      break;
    case "shape":
      layer.radius = round2(layer.radius * s);
      layer.stroke.width = Math.min(80, Math.max(1, round2(layer.stroke.width * s)));
      layer.dropShadow.blur = Math.min(150, round2(layer.dropShadow.blur * s));
      layer.dropShadow.x = round2(layer.dropShadow.x * s);
      layer.dropShadow.y = round2(layer.dropShadow.y * s);
      break;
  }
}

/** Adapte une scène (calques + fond) à un nouveau format. Mute la scène. */
export function resizeScene(scene: Scene, from: FrameSize, to: FrameSize): void {
  if (from.width === to.width && from.height === to.height) return;
  const s = Math.min(to.width / from.width, to.height / from.height);
  for (const layer of scene.layers) resizeLayer(layer, from, to);
  const bg = scene.background;
  if (bg.type === "pattern") bg.size = Math.min(400, Math.max(8, round2(bg.size * s)));
  if (bg.type === "image") bg.blur = Math.min(60, round2(bg.blur * s));
}

/** Change le format d'un projet (taille de l'image) en adaptant toutes les scènes. Mute le projet. */
export function resizeProject(project: Project, to: FrameSize): void {
  const from = { width: project.width, height: project.height };
  for (const scene of project.scenes) resizeScene(scene, from, to);
  project.width = to.width;
  project.height = to.height;
}

/** Convertit une durée en frames d'une cadence à une autre (même durée en secondes). */
const retime = (frames: number, ratio: number, min: number) => Math.max(min, Math.round(frames * ratio));

/** Garde les mêmes durées en secondes quand la cadence change (ratio = nouvelle / ancienne). */
export function retimeScene(scene: Scene, ratio: number): void {
  if (ratio === 1) return;
  scene.durationInFrames = retime(scene.durationInFrames, ratio, 1);
  scene.transitionIn.durationInFrames = retime(scene.transitionIn.durationInFrames, ratio, 1);
  for (const layer of scene.layers) {
    const a = layer.animation;
    a.enterDurationInFrames = retime(a.enterDurationInFrames, ratio, 1);
    a.enterDelayInFrames = retime(a.enterDelayInFrames, ratio, 0);
    a.exitDurationInFrames = retime(a.exitDurationInFrames, ratio, 1);
    if (a.endAtFrame !== null) a.endAtFrame = retime(a.endAtFrame, ratio, 1);
    if (layer.type === "text") {
      layer.textAnimation.durationInFrames = retime(layer.textAnimation.durationInFrames, ratio, 1);
    }
    if (layer.type === "video") layer.trimStartFrames = retime(layer.trimStartFrames, ratio, 0);
  }
}

/** Change la cadence (images par seconde) sans changer les durées réelles. Mute le projet. */
/** Quelles pages reçoivent la durée : toutes, toutes sauf la première et la dernière, ou une liste. */
export type DurationScope = "all" | "inner" | "selected";

/**
 * Frames minimum pour qu'une vidéo posée sur la page soit vue en entier
 * (début d'apparition + durée du fichier, hors boucle). 1 si la page n'a pas de vidéo.
 */
export function minFramesForVideos(scene: Scene, fps: number): number {
  let need = 1;
  for (const layer of scene.layers) {
    if (layer.type !== "video" || layer.sourceDurationSeconds === null) continue;
    const played = layer.sourceDurationSeconds * fps - layer.trimStartFrames;
    need = Math.max(need, Math.ceil(layer.animation.enterDelayInFrames + played / layer.playbackRate));
  }
  return need;
}

/**
 * Donne la même durée (en secondes) à plusieurs pages d'un coup. Une page avec une vidéo
 * n'est jamais raccourcie sous la durée de sa vidéo : elle est comptée dans `keptLonger`.
 */
export function setScenesDuration(
  project: Project,
  seconds: number,
  scope: DurationScope,
  selectedIds: readonly string[] = [],
): { changed: number; keptLonger: number } {
  const frames = Math.max(1, Math.round(seconds * project.fps));
  const last = project.scenes.length - 1;
  let changed = 0;
  let keptLonger = 0;
  project.scenes.forEach((scene, i) => {
    const hit = scope === "all" || (scope === "inner" ? i > 0 && i < last : selectedIds.includes(scene.id));
    if (!hit) return;
    const target = Math.max(frames, minFramesForVideos(scene, project.fps));
    if (target > frames) keptLonger++;
    if (scene.durationInFrames !== target) changed++;
    scene.durationInFrames = target;
  });
  return { changed, keptLonger };
}

export function retimeProject(project: Project, fps: number): void {
  const ratio = fps / project.fps;
  if (ratio === 1) return;
  for (const scene of project.scenes) retimeScene(scene, ratio);
  for (const clip of project.audio) {
    clip.startFrame = retime(clip.startFrame, ratio, 0);
    clip.durationInFrames = retime(clip.durationInFrames, ratio, 1);
    clip.trimStartFrames = retime(clip.trimStartFrames, ratio, 0);
    clip.fadeInFrames = retime(clip.fadeInFrames, ratio, 0);
    clip.fadeOutFrames = retime(clip.fadeOutFrames, ratio, 0);
  }
  project.fps = fps;
}

/** Adapte une scène venue d'un autre projet (modèle enregistré) au format et à la cadence du projet. */
export function adaptScene(scene: Scene, from: FrameSize & { fps: number }, to: FrameSize & { fps: number }): void {
  resizeScene(scene, from, to);
  retimeScene(scene, to.fps / from.fps);
}

/** Largeur/hauteur paires (exigées par l'encodeur H.264), entre 16 et 3840. */
export const evenSize = (n: number) => Math.min(3840, Math.max(16, 2 * Math.round(n / 2)));

/**
 * Le projet a-t-il du son à exporter ? Musique, ou vidéo non coupée dans une scène.
 * L'export en muet n'enregistre aucune piste audio : il ne faut le demander que si c'est vrai.
 */
export function projectHasSound(project: Project): boolean {
  if (project.audio.some((c) => c.volume > 0)) return true;
  return project.scenes.some((scene) =>
    scene.layers.some((l) => l.type === "video" && !l.hidden && !l.muted && l.volume > 0),
  );
}
