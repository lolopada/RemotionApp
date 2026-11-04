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

const polygon = (pts: [number, number][], w: number, h: number, x: number, y: number) =>
  `${pts.map(([fx, fy], i) => `${i ? "L" : "M"} ${r(x + fx * w)} ${r(y + fy * h)}`).join(" ")} Z`;

function starPath(w: number, h: number, x: number, y: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 === 0 ? 0.5 : 0.21;
    pts.push([0.5 + k * Math.cos(a), 0.53 + k * Math.sin(a) * 1.05]);
  }
  return polygon(pts, w, h, x, y);
}

/** Arche : rectangle surmonté d'un demi-cercle (fenêtre d'église). */
function archPath(w: number, h: number, x: number, y: number): string {
  const ry = Math.min(w / 2, h);
  return [
    `M ${r(x)} ${r(y + h)}`,
    `V ${r(y + ry)}`,
    `A ${r(w / 2)} ${r(ry)} 0 0 1 ${r(x + w)} ${r(y + ry)}`,
    `V ${r(y + h)}`,
    "Z",
  ].join(" ");
}

/** Bulle de BD : rectangle arrondi + pointe en bas à gauche. */
function bubblePath(w: number, h: number, x: number, y: number): string {
  const bh = h * 0.8;
  const rad = Math.min(w, bh) * 0.22;
  return [
    `M ${r(x + rad)} ${r(y)}`,
    `H ${r(x + w - rad)}`,
    `A ${r(rad)} ${r(rad)} 0 0 1 ${r(x + w)} ${r(y + rad)}`,
    `V ${r(y + bh - rad)}`,
    `A ${r(rad)} ${r(rad)} 0 0 1 ${r(x + w - rad)} ${r(y + bh)}`,
    `H ${r(x + w * 0.38)}`,
    `L ${r(x + w * 0.16)} ${r(y + h)}`,
    `L ${r(x + w * 0.22)} ${r(y + bh)}`,
    `H ${r(x + rad)}`,
    `A ${r(rad)} ${r(rad)} 0 0 1 ${r(x)} ${r(y + bh - rad)}`,
    `V ${r(y + rad)}`,
    `A ${r(rad)} ${r(rad)} 0 0 1 ${r(x + rad)} ${r(y)}`,
    "Z",
  ].join(" ");
}

/**
 * Contour « festonné » : des arcs entre points successifs d'un tracé.
 * outward = bosses vers l'extérieur (nuage), sinon morsures (timbre).
 */
function scallop(points: [number, number][], outward: boolean, bulge = 0.62): string {
  const [first] = points;
  if (!first) return "";
  const parts = [`M ${r(first[0])} ${r(first[1])}`];
  for (let i = 1; i <= points.length; i++) {
    const [ax, ay] = points[i - 1] as [number, number];
    const [bx, by] = points[i % points.length] as [number, number];
    const rad = (Math.hypot(bx - ax, by - ay) / 2) * (1 / bulge);
    parts.push(`A ${r(rad)} ${r(rad)} 0 0 ${outward ? 1 : 0} ${r(bx)} ${r(by)}`);
  }
  return `${parts.join(" ")} Z`;
}

function cloudPath(w: number, h: number, x: number, y: number): string {
  // Base plate, quatre bosses de tailles différentes au-dessus.
  // Dessiné dans une marge de 8 % pour que les bosses restent dans le cadre.
  const k = 0.84;
  const P = (fx: number, fy: number) => `${r(x + (0.08 + fx * k) * w)} ${r(y + (0.02 + fy * k) * h)}`;
  const A = (rad: number, large: 0 | 1, fx: number, fy: number) =>
    `A ${r(rad * k * w)} ${r(rad * k * h * 1.15)} 0 ${large} 1 ${P(fx, fy)}`;
  return [
    `M ${P(0.2, 0.86)}`,
    A(0.17, 1, 0.17, 0.53),
    A(0.21, 0, 0.45, 0.3),
    A(0.24, 0, 0.8, 0.42),
    A(0.17, 1, 0.82, 0.86),
    "Z",
  ].join(" ");
}

function stampPath(w: number, h: number, x: number, y: number): string {
  // Bords dentelés : petites morsures régulières sur les 4 côtés.
  const step = Math.max(6, Math.min(w, h) / 14);
  const nx = Math.max(3, Math.round(w / step));
  const ny = Math.max(3, Math.round(h / step));
  const pts: [number, number][] = [];
  for (let i = 0; i < nx; i++) pts.push([x + (i * w) / nx, y]);
  for (let i = 0; i < ny; i++) pts.push([x + w, y + (i * h) / ny]);
  for (let i = 0; i < nx; i++) pts.push([x + w - (i * w) / nx, y + h]);
  for (let i = 0; i < ny; i++) pts.push([x, y + h - (i * h) / ny]);
  return scallop(pts, false, 0.98);
}

/** Explosion de BD : étoile à pointes irrégulières, plus large que haute si le cadre l'est. */
function burstPath(w: number, h: number, x: number, y: number): string {
  const n = 16;
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const outer = i % 2 === 0;
    const k = outer ? (i % 4 === 0 ? 0.5 : 0.45) : 0.32;
    pts.push([0.5 + k * Math.cos(a), 0.5 + k * Math.sin(a)]);
  }
  return polygon(pts, w, h, x, y);
}

/** Tracé SVG (en pixels) de n'importe quelle forme, inscrite dans (x, y, w, h). */
export function shapePath(shape: string, w: number, h: number, opts: { radius?: number; x?: number; y?: number } = {}) {
  const { radius = 0, x = 0, y = 0 } = opts;
  switch (shape) {
    case "rounded":
      return roundedRectPath(w, h, radius, x, y);
    case "circle":
      return ellipsePath(w, h, x, y);
    case "heart":
      return heartPath(w, h, x, y);
    case "star":
      return starPath(w, h, x, y);
    case "hexagon":
      return polygon(
        [
          [0.25, 0.02],
          [0.75, 0.02],
          [1, 0.5],
          [0.75, 0.98],
          [0.25, 0.98],
          [0, 0.5],
        ],
        w,
        h,
        x,
        y,
      );
    case "diamond":
      return polygon(
        [
          [0.5, 0],
          [1, 0.5],
          [0.5, 1],
          [0, 0.5],
        ],
        w,
        h,
        x,
        y,
      );
    case "arch":
      return archPath(w, h, x, y);
    case "bubble":
      return bubblePath(w, h, x, y);
    case "cloud":
      return cloudPath(w, h, x, y);
    case "stamp":
      return stampPath(w, h, x, y);
    case "triangle":
      return polygon(
        [
          [0.5, 0.03],
          [0.98, 0.97],
          [0.02, 0.97],
        ],
        w,
        h,
        x,
        y,
      );
    case "arrow":
      return polygon(
        [
          [0, 0.34],
          [0.58, 0.34],
          [0.58, 0.02],
          [1, 0.5],
          [0.58, 0.98],
          [0.58, 0.66],
          [0, 0.66],
        ],
        w,
        h,
        x,
        y,
      );
    case "burst":
      return burstPath(w, h, x, y);
    case "line":
      // Tracé ouvert : n'a de sens qu'avec un contour.
      return `M ${r(x)} ${r(y + h / 2)} H ${r(x + w)}`;
    default:
      return roundedRectPath(w, h, 0, x, y);
  }
}

/** Formes que le CSS sait faire seul (coins arrondis) : bordures CSS natives. */
export const isBoxShape = (shape: string) =>
  shape === "rect" || shape === "rounded" || shape === "circle" || shape === "none";
