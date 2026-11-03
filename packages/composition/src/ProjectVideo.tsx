import { getSceneTimings, type Project } from "@app/schema";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { Fragment } from "react";
import { AbsoluteFill } from "remotion";
import { AudioTrack } from "./AudioTrack";
import { type RenderMode, RenderModeContext } from "./context";
import { getPresentation } from "./effects/transitions";
import { SceneView } from "./SceneView";

export type ProjectVideoProps = RenderMode & {
  project: Project;
};

/**
 * LA composition : utilisée telle quelle par le <Player> de l'éditeur
 * et par renderMediaOnWeb() à l'export. Une seule source de vérité.
 */
export function ProjectVideo({ project, showPlaceholders }: ProjectVideoProps) {
  const timings = getSceneTimings(project.scenes);

  return (
    <RenderModeContext.Provider value={{ showPlaceholders }}>
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <TransitionSeries>
          {project.scenes.map((scene, i) => {
            const transitionFrames = timings[i]?.transitionFrames ?? 0;
            return (
              <Fragment key={scene.id}>
                {transitionFrames > 0 && scene.transitionIn.kind !== "none" ? (
                  <TransitionSeries.Transition
                    presentation={getPresentation(scene.transitionIn.kind)}
                    timing={linearTiming({ durationInFrames: transitionFrames })}
                  />
                ) : null}
                <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
                  <SceneView scene={scene} />
                </TransitionSeries.Sequence>
              </Fragment>
            );
          })}
        </TransitionSeries>
        <AudioTrack clips={project.audio} />
      </AbsoluteFill>
    </RenderModeContext.Provider>
  );
}
