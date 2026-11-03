import type { Layer } from "@app/schema";

export interface LayerViewProps<T extends Layer = Layer> {
  layer: T;
  sceneDurationInFrames: number;
}
