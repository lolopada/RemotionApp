import type { VideoLayer } from "@app/schema";
import { Video } from "@remotion/media";
import { Sequence } from "remotion";
import { getMaskStyle } from "../effects/masks";
import { photoFilterCss } from "../effects/photo";
import { withOpacity } from "./TextLayerView";
import type { LayerViewProps } from "./types";

/**
 * Vidéo dans son cadre : [ombre portée] → [zone masquée : vidéo].
 * La lecture démarre à l'apparition du calque (la <Sequence> remet l'horloge à zéro),
 * `trimStartFrames` choisit le point de départ dans le fichier.
 * Le son suit le calque : démonté (disparition, fin de scène), il se tait.
 */
export function VideoLayerView({ layer, sceneDurationInFrames }: LayerViewProps<VideoLayer>) {
  const { width, height } = layer.transform;
  const ds = layer.dropShadow;
  const maskStyle = getMaskStyle(layer.mask, width, height);
  const clipped = "clipPath" in maskStyle || "maskImage" in maskStyle;
  const start = layer.animation.enterDelayInFrames;
  const end = layer.animation.endAtFrame ?? sceneDurationInFrames;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        filter: ds.enabled
          ? `drop-shadow(${ds.x}px ${ds.y}px ${ds.blur / 2}px ${withOpacity(ds.color, ds.opacity)})`
          : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          overflow: !clipped && layer.zoom > 1 ? "hidden" : undefined,
          ...maskStyle,
        }}
      >
        <Sequence from={start} durationInFrames={Math.max(1, end - start)} layout="none">
          <Video
            src={layer.src}
            trimBefore={layer.trimStartFrames}
            playbackRate={layer.playbackRate}
            volume={layer.volume}
            muted={layer.muted}
            loop={layer.loop}
            objectFit={layer.fit}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height,
              transform: [
                layer.zoom !== 1 ? `scale(${layer.zoom})` : "",
                layer.flipX || layer.flipY ? `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` : "",
              ]
                .filter(Boolean)
                .join(" "),
              filter: photoFilterCss(layer.filter),
            }}
          />
        </Sequence>
      </div>
    </div>
  );
}
