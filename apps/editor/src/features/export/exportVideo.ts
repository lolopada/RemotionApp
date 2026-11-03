import { ProjectVideo } from "@app/composition";
import { getProjectDurationInFrames, type Project } from "@app/schema";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";

export interface ExportOptions {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  /** 1 = taille du projet (ex. 1080p). 2 = double (ex. 4K depuis un projet 1080p). */
  scale?: number;
}

/**
 * Export MP4 entièrement dans le navigateur (WebCodecs), avec exactement
 * la même composition que l'aperçu. Le serveur ne fait aucun calcul.
 */
export async function exportVideo(project: Project, { onProgress, signal, scale = 1 }: ExportOptions = {}) {
  const check = await canRenderMediaOnWeb({
    container: "mp4",
    width: project.width,
    height: project.height,
    scale,
    muted: project.audio.length === 0,
  });
  if (!check.canRender) {
    const reasons = check.issues.filter((i) => i.severity === "error").map((i) => i.message);
    throw new Error(
      `Ce navigateur ne peut pas exporter la vidéo : ${reasons.join(" ; ") || "WebCodecs indisponible"}. ` +
        "Essaie Chrome ou Firefox récent, en HTTPS ou sur localhost.",
    );
  }

  const inputProps = { project, showPlaceholders: false };
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      id: "project",
      component: ProjectVideo,
      durationInFrames: getProjectDurationInFrames(project),
      fps: project.fps,
      width: project.width,
      height: project.height,
      defaultProps: inputProps,
    },
    inputProps,
    container: "mp4",
    scale,
    muted: project.audio.length === 0,
    videoBitrate: "high",
    signal,
    onProgress: ({ progress }) => onProgress?.(progress),
    // Déclare l'usage sous licence gratuite Remotion (≤ 3 personnes).
    licenseKey: "free-license",
  });

  return getBlob();
}
