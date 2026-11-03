import type { Layer } from "@app/schema";

/**
 * Calque visible le plus en avant sous le point (px, py), en pixels de la
 * composition. Tient compte de la rotation. Les calques verrouillés sont
 * transparents au clic (pratique pour un décor de fond).
 */
export function hitTestLayers(layers: Layer[], px: number, py: number): Layer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer || layer.hidden || layer.locked) continue;
    if (isPointInLayer(layer, px, py)) return layer;
  }
  return null;
}

export function isPointInLayer(layer: Layer, px: number, py: number): boolean {
  const { x, y, width, height, rotation } = layer.transform;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const a = (-rotation * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= width / 2 && Math.abs(ly) <= height / 2;
}
