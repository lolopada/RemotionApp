import type { ShapeLayer } from "@app/schema";
import type { CSSProperties } from "react";
import { heartPath } from "../effects/shapes";
import type { LayerViewProps } from "./types";

export function ShapeLayerView({ layer }: LayerViewProps<ShapeLayer>) {
  const { width, height } = layer.transform;
  const shapeStyle: CSSProperties =
    layer.shape === "rounded"
      ? { borderRadius: layer.radius }
      : layer.shape === "circle"
        ? { borderRadius: "50%" }
        : layer.shape === "heart"
          ? { clipPath: `path('${heartPath(width, height)}')` }
          : {};

  return <div style={{ width: "100%", height: "100%", backgroundColor: layer.fill, ...shapeStyle }} />;
}
