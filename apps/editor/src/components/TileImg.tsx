import type { CSSProperties } from "react";
import { useTileSrc } from "../lib/previewImages";

/** Petite image d'interface : affiche une copie réduite de la photo (voir previewImages.ts). */
export function TileImg({
  src,
  alt,
  className = "size-full object-cover",
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  return <img src={useTileSrc(src)} alt={alt} loading="lazy" draggable={false} className={className} style={style} />;
}
