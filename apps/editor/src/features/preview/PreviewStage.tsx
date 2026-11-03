import { ProjectVideo } from "@app/composition";
import { getProjectDurationInFrames, getSceneAtFrame } from "@app/schema";
import { Player } from "@remotion/player";
import { useEffect, useMemo } from "react";
import { useEditor, useProject, useSelectedScene } from "../../store/editorStore";
import { getSceneEditFrame, isFrameInScene, playerRef } from "./playerController";
import { SelectionOverlay } from "./SelectionOverlay";
import { Transport } from "./Transport";
import { useFitSize } from "./useFitSize";

/**
 * Aperçu central : le <Player> Remotion joue la MÊME composition que celle
 * exportée, avec un calque d'édition par-dessus.
 */
export function PreviewStage() {
  const project = useProject();
  const scene = useSelectedScene();
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const durationInFrames = getProjectDurationInFrames(project);
  const { ref, width, height } = useFitSize(project.width / project.height);
  const scale = width / project.width;

  const inputProps = useMemo(() => ({ project, showPlaceholders: true }), [project]);

  // Quand on choisit une scène (storyboard, ajout…), on y déplace la tête de lecture.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || player.isPlaying()) return;
    const { project: p } = useEditor.getState();
    if (isFrameInScene(p, selectedSceneId, player.getCurrentFrame())) return;
    const frame = getSceneEditFrame(p, selectedSceneId);
    if (frame !== null) player.seekTo(frame);
  }, [selectedSceneId]);

  // Pendant la lecture, la scène sélectionnée suit la tête de lecture.
  // (relancé quand le Player apparaît, c.-à-d. quand la taille est connue)
  const playerMounted = width > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: on se réabonne quand le Player est monté
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    // Au démarrage, on se place là où les calques de la 1re scène sont visibles.
    const { project: initial, selectedSceneId: initialScene } = useEditor.getState();
    const start = getSceneEditFrame(initial, initialScene);
    if (start !== null) player.seekTo(start);
    const onFrame = ({ detail }: { detail: { frame: number } }) => {
      if (!player.isPlaying()) return;
      const { project: p, selectedSceneId: current, selectScene } = useEditor.getState();
      const at = getSceneAtFrame(p.scenes, detail.frame);
      if (at && at.id !== current) selectScene(at.id);
    };
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [playerMounted]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={ref} className="relative flex min-h-0 flex-1 items-center justify-center">
        {width > 0 && scene ? (
          <div className="relative shadow-2xl shadow-black/60" style={{ width, height }}>
            <Player
              ref={playerRef}
              component={ProjectVideo}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              compositionWidth={project.width}
              compositionHeight={project.height}
              fps={project.fps}
              style={{ width, height }}
              loop
              controls={false}
              clickToPlay={false}
              doubleClickToFullscreen={false}
              spaceKeyToPlayOrPause={false}
              acknowledgeRemotionLicense
            />
            <SelectionOverlay scene={scene} scale={scale} />
          </div>
        ) : null}
      </div>
      <Transport durationInFrames={durationInFrames} fps={project.fps} />
    </div>
  );
}
