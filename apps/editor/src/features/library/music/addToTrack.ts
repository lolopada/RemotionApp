import type { StoredFile } from "@app/schema";
import { createAudioClip, getProjectDurationInFrames, secondsToFrames } from "@app/schema";
import { getAudioDurationInSeconds } from "../../../lib/media";
import { useEditor } from "../../../store/editorStore";

/**
 * Pose une musique de la bibliothèque sur la piste audio : à la suite des précédentes,
 * coupée à la fin de la vidéo (fondus automatiques), avec son crédit s'il y en a un.
 */
export async function addAssetToTrack(asset: StoredFile) {
  const seconds = asset.durationSeconds ?? (await getAudioDurationInSeconds(asset.url).catch(() => 30));
  const { project, addAudio } = useEditor.getState();
  const total = getProjectDurationInFrames(project);
  const start = Math.min(
    total - 1,
    project.audio.reduce((end, c) => Math.max(end, c.startFrame + c.durationInFrames), 0),
  );
  addAudio(
    createAudioClip({
      name: asset.name,
      src: asset.url,
      startFrame: start,
      durationInFrames: Math.max(1, Math.min(secondsToFrames(seconds, project.fps), total - start)),
      credit: asset.credit ?? "",
    }),
  );
}
