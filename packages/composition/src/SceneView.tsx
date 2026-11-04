import type { Scene } from "@app/schema";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { type RenderMode, RenderModeContext } from "./context";
import { BackgroundGraphic } from "./effects/backgrounds";
import { LayerView } from "./layers/registry";

/**
 * Une scène : le fond puis les calques, dans l'ordre du tableau.
 * (z-index n'est pas supporté à l'export navigateur : l'ordre DOM fait foi.)
 */
export function SceneView({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackgroundGraphic
        background={scene.background}
        width={width}
        height={height}
        frame={frame}
        fps={fps}
        durationInFrames={scene.durationInFrames}
      />
      {scene.layers.map((layer) => (
        <LayerView key={layer.id} layer={layer} sceneDurationInFrames={scene.durationInFrames} />
      ))}
    </AbsoluteFill>
  );
}

export type ScenePreviewProps = RenderMode & {
  scene: Scene;
};

/** Une scène seule, pour les vignettes du storyboard (<Thumbnail>). */
export function ScenePreview({ scene, showPlaceholders }: ScenePreviewProps) {
  return (
    <RenderModeContext.Provider value={{ showPlaceholders }}>
      <SceneView scene={scene} />
    </RenderModeContext.Provider>
  );
}
