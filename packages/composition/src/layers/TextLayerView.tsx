import type { TextLayer } from "@app/schema";
import { ensureFont } from "../fonts";
import type { LayerViewProps } from "./types";

const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;

export function TextLayerView({ layer }: LayerViewProps<TextLayer>) {
  ensureFont(layer.fontFamily);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: JUSTIFY[layer.align],
        textAlign: layer.align,
        fontFamily: `"${layer.fontFamily}", sans-serif`,
        fontSize: layer.fontSize,
        fontWeight: layer.fontWeight,
        lineHeight: layer.lineHeight,
        letterSpacing: layer.letterSpacing,
        color: layer.color,
        textShadow: layer.shadow ? "0 4px 24px rgba(0,0,0,0.45)" : undefined,
        WebkitTextStroke: layer.strokeWidth > 0 ? `${layer.strokeWidth}px ${layer.strokeColor}` : undefined,
        paintOrder: "stroke fill",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
      }}
    >
      {layer.text}
    </div>
  );
}
