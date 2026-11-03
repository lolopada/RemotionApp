/**
 * Formes partagées par les masques et les calques "forme".
 * Tout est exprimé en pixels pour pouvoir servir à la fois
 * de `clip-path: path(...)` (CSS) et de `Path2D` (canvas).
 */

const r = (n: number) => Math.round(n * 100) / 100;

/** Cœur inscrit dans un rectangle (x, y, w, h). */
export function heartPath(w: number, h: number, x = 0, y = 0): string {
  const px = (fx: number) => r(x + fx * w);
  const py = (fy: number) => r(y + fy * h);
  return [
    `M ${px(0.5)} ${py(0.28)}`,
    `C ${px(0.5)} ${py(0.12)}, ${px(0.36)} ${py(0)}, ${px(0.24)} ${py(0)}`,
    `C ${px(0.1)} ${py(0)}, ${px(0)} ${py(0.13)}, ${px(0)} ${py(0.3)}`,
    `C ${px(0)} ${py(0.55)}, ${px(0.25)} ${py(0.75)}, ${px(0.5)} ${py(1)}`,
    `C ${px(0.75)} ${py(0.75)}, ${px(1)} ${py(0.55)}, ${px(1)} ${py(0.3)}`,
    `C ${px(1)} ${py(0.13)}, ${px(0.9)} ${py(0)}, ${px(0.76)} ${py(0)}`,
    `C ${px(0.64)} ${py(0)}, ${px(0.5)} ${py(0.12)}, ${px(0.5)} ${py(0.28)}`,
    "Z",
  ].join(" ");
}

/** Rectangle aux coins arrondis. */
export function roundedRectPath(w: number, h: number, radius: number, x = 0, y = 0): string {
  const rad = Math.max(0, Math.min(radius, w / 2, h / 2));
  return [
    `M ${r(x + rad)} ${r(y)}`,
    `H ${r(x + w - rad)}`,
    `A ${r(rad)} ${r(rad)} 0 0 1 ${r(x + w)} ${r(y + rad)}`,
    `V ${r(y + h - rad)}`,
    `A ${r(rad)} ${r(rad)} 0 0 1 ${r(x + w - rad)} ${r(y + h)}`,
    `H ${r(x + rad)}`,
    `A ${r(rad)} ${r(rad)} 0 0 1 ${r(x)} ${r(y + h - rad)}`,
    `V ${r(y + rad)}`,
    `A ${r(rad)} ${r(rad)} 0 0 1 ${r(x + rad)} ${r(y)}`,
    "Z",
  ].join(" ");
}

/** Ellipse inscrite dans le rectangle. */
export function ellipsePath(w: number, h: number, x = 0, y = 0): string {
  const rx = w / 2;
  const ry = h / 2;
  return [
    `M ${r(x)} ${r(y + ry)}`,
    `A ${r(rx)} ${r(ry)} 0 1 1 ${r(x + w)} ${r(y + ry)}`,
    `A ${r(rx)} ${r(ry)} 0 1 1 ${r(x)} ${r(y + ry)}`,
    "Z",
  ].join(" ");
}
