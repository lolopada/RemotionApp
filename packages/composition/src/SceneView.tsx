import type { Background, Scene } from "@app/schema";
import { AbsoluteFill, Img } from "remotion";
import { type RenderMode, RenderModeContext } from "./context";
import { LayerView } from "./layers/registry";

function BackgroundView({ background }: { background: Background }) {
  switch (background.type) {
    case "color":
      return <AbsoluteFill style={{ backgroundColor: background.color }} />;
    case "gradient":
      return (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`,
          }}
        />
      );
    case "image":
      return (
        <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
          <Img
            src={background.src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: background.blur > 0 ? `blur(${background.blur}px)` : undefined,
              // Agrandi un peu quand flouté pour masquer les bords transparents.
              transform: background.blur > 0 ? "scale(1.08)" : undefined,
            }}
          />
        </AbsoluteFill>
      );
  }
}

/**
 * Une scène : le fond puis les calques, dans l'ordre du tableau.
 * (z-index n'est pas supporté à l'export navigateur : l'ordre DOM fait foi.)
 */
export function SceneView({ scene }: { scene: Scene }) {
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackgroundView background={scene.background} />
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
