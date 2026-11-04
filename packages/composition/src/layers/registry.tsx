import type { Layer, LayerType } from "@app/schema";
import type { ComponentType } from "react";
import { ImageLayerView } from "./ImageLayerView";
import { LayerFrame } from "./LayerFrame";
import { ShapeLayerView } from "./ShapeLayerView";
import { TextLayerView } from "./TextLayerView";
import type { LayerViewProps } from "./types";
import { VideoLayerView } from "./VideoLayerView";

type Registry = { [K in LayerType]: ComponentType<LayerViewProps<Extract<Layer, { type: K }>>> };

/**
 * Un type de calque = un composant de rendu.
 * TypeScript refuse de compiler si un type du schéma n'a pas de rendu ici.
 */
export const layerRenderers: Registry = {
  image: ImageLayerView,
  text: TextLayerView,
  shape: ShapeLayerView,
  video: VideoLayerView,
};

export function LayerView({ layer, sceneDurationInFrames }: LayerViewProps) {
  if (layer.hidden) return null;
  const Renderer = layerRenderers[layer.type] as ComponentType<LayerViewProps>;
  return (
    <LayerFrame layer={layer} sceneDurationInFrames={sceneDurationInFrames}>
      <Renderer layer={layer} sceneDurationInFrames={sceneDurationInFrames} />
    </LayerFrame>
  );
}
