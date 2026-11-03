import type { ImageLayer } from "@app/schema";
import { Img } from "remotion";
import { useRenderMode } from "../context";
import { useKenBurnsScale } from "../effects/animations";
import { getMaskStyle } from "../effects/masks";
import type { LayerViewProps } from "./types";

export function ImageLayerView({ layer, sceneDurationInFrames }: LayerViewProps<ImageLayer>) {
  const { showPlaceholders } = useRenderMode();
  const { width, height } = layer.transform;
  const kenBurns = useKenBurnsScale(layer.animation.kenBurns, sceneDurationInFrames);
  const { zoom, offsetX, offsetY } = layer.crop;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        ...getMaskStyle(layer.mask, width, height),
      }}
    >
      {layer.src ? (
        <Img
          src={layer.src}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            objectFit: layer.fit,
            // object-position n'est pas supporté à l'export navigateur :
            // le recadrage passe par un transform.
            transform: `translate(${offsetX * 100}%, ${offsetY * 100}%) scale(${zoom * kenBurns})`,
          }}
        />
      ) : showPlaceholders ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            border: "4px dashed rgba(255,255,255,0.6)",
            backgroundColor: "rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "sans-serif",
            fontSize: Math.max(18, Math.min(width, height) / 10),
            textAlign: "center",
          }}
        >
          Dépose une photo
        </div>
      ) : null}
      {layer.border.width > 0 ? (
        // Bordure dessinée PAR-DESSUS la photo, dans un calque à part : à l'export
        // navigateur, une photo zoomée/recadrée recouvrirait sinon la bordure.
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            border: `${layer.border.width}px solid ${layer.border.color}`,
            borderRadius:
              layer.mask.shape === "rounded" ? layer.mask.radius : layer.mask.shape === "circle" ? "50%" : undefined,
          }}
        />
      ) : null}
    </div>
  );
}
