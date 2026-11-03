import type { Layer } from "@app/schema";
import type { ReactNode } from "react";
import { useLayerAnimation } from "../effects/animations";

/**
 * Enveloppe commune à tous les calques : position, taille, rotation,
 * opacité et animation d'entrée/sortie. Le contenu est rendu par le
 * composant spécifique au type de calque (voir registry.tsx).
 */
export function LayerFrame({
  layer,
  sceneDurationInFrames,
  children,
}: {
  layer: Layer;
  sceneDurationInFrames: number;
  children: ReactNode;
}) {
  const { x, y, width, height, rotation, opacity } = layer.transform;
  const anim = useLayerAnimation(layer.animation, sceneDurationInFrames);

  return (
    <div
      data-layer-id={layer.id}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        opacity: opacity * anim.opacity,
        transform: `rotate(${rotation}deg) ${anim.transform}`,
        transformOrigin: "50% 50%",
      }}
    >
      {children}
    </div>
  );
}
