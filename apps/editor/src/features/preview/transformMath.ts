/**
 * Géométrie des poignées de transformation (redimensionner, tourner, aimanter).
 * Fonctions pures, en pixels de la composition, testées dans transformMath.test.ts.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrés, sens horaire, autour du centre. */
  rotation: number;
}

/** Position d'une poignée : -1 = bord gauche/haut, 0 = milieu, 1 = bord droit/bas. */
export interface HandleDir {
  hx: -1 | 0 | 1;
  hy: -1 | 0 | 1;
}

export const HANDLES: HandleDir[] = [
  { hx: -1, hy: -1 },
  { hx: 0, hy: -1 },
  { hx: 1, hy: -1 },
  { hx: 1, hy: 0 },
  { hx: 1, hy: 1 },
  { hx: 0, hy: 1 },
  { hx: -1, hy: 1 },
  { hx: -1, hy: 0 },
];

export const MIN_SIZE = 8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Fait tourner le vecteur (x, y) de `deg` degrés (sens horaire à l'écran, y vers le bas). */
export function rotateVec(x: number, y: number, deg: number) {
  const a = rad(deg);
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
}

export const boxCenter = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

export interface ResizeOptions {
  /** Garde le rapport largeur/hauteur (poignées d'angle). */
  keepRatio: boolean;
  /** Redimensionne autour du centre au lieu du coin opposé. */
  fromCenter: boolean;
}

export interface ResizeResult extends Box {
  /** Facteur appliqué à la taille (sert à mettre à l'échelle la police d'un texte). */
  scale: number;
}

/**
 * Redimensionne `start` en tirant la poignée `dir` jusqu'au point (px, py).
 * Le coin ou le bord opposé reste fixe à l'écran, même si la boîte est tournée.
 */
export function resizeBox(start: Box, dir: HandleDir, px: number, py: number, opts: ResizeOptions): ResizeResult {
  const { hx, hy } = dir;
  const c = boxCenter(start);
  // Point fixe : le côté opposé (ou le centre), exprimé dans le repère du calque.
  const ax = opts.fromCenter ? 0 : (-hx * start.width) / 2;
  const ay = opts.fromCenter ? 0 : (-hy * start.height) / 2;
  const anchorOff = rotateVec(ax, ay, start.rotation);
  const anchor = { x: c.x + anchorOff.x, y: c.y + anchorOff.y };
  // Pointeur dans le repère du calque, relatif au point fixe.
  const d = rotateVec(px - anchor.x, py - anchor.y, -start.rotation);
  const grow = opts.fromCenter ? 2 : 1;

  let w = hx === 0 ? start.width : Math.max(MIN_SIZE, grow * hx * d.x);
  let h = hy === 0 ? start.height : Math.max(MIN_SIZE, grow * hy * d.y);
  let scale = 1;
  if (opts.keepRatio && hx !== 0 && hy !== 0) {
    scale = Math.max(w / start.width, h / start.height, MIN_SIZE / Math.min(start.width, start.height));
    w = start.width * scale;
    h = start.height * scale;
  } else {
    scale = Math.sqrt((w * h) / (start.width * start.height));
  }

  // Nouveau centre : le point fixe ne bouge pas.
  const off = opts.fromCenter ? { x: 0, y: 0 } : rotateVec((hx * w) / 2, (hy * h) / 2, start.rotation);
  const nc = opts.fromCenter ? c : { x: anchor.x + off.x, y: anchor.y + off.y };
  return { x: nc.x - w / 2, y: nc.y - h / 2, width: w, height: h, rotation: start.rotation, scale };
}

/** Normalise un angle dans ]-180, 180]. */
export function normalizeAngle(deg: number): number {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a;
}

/**
 * Angle du calque quand la poignée de rotation (au-dessus du centre) est tirée vers (px, py).
 * `step` > 0 : arrondi à ce pas. Sinon, aimantation douce sur les multiples de 45°.
 */
export function rotationFromPointer(center: { x: number; y: number }, px: number, py: number, step = 0): number {
  const raw = (Math.atan2(py - center.y, px - center.x) * 180) / Math.PI + 90;
  let angle = normalizeAngle(raw);
  if (step > 0) {
    angle = Math.round(angle / step) * step;
  } else {
    const nearest = Math.round(angle / 45) * 45;
    if (Math.abs(angle - nearest) <= 4) angle = nearest;
  }
  return normalizeAngle(Math.round(angle * 10) / 10);
}

/** Rectangle englobant (aligné sur les axes) d'une boîte tournée. */
export function boundingBox(b: Box) {
  const c = boxCenter(b);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const p = rotateVec((sx * b.width) / 2, (sy * b.height) / 2, b.rotation);
      xs.push(c.x + p.x);
      ys.push(c.y + p.y);
    }
  }
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** Lignes d'aide à tracer (en px de la composition). */
  guides: { axis: "x" | "y"; at: number }[];
}

/**
 * Aimante un déplacement : bords et centre du calque sur les bords et le centre de l'image
 * (à `threshold` px près). Renvoie le décalage à ajouter et les lignes d'aide.
 */
export function snapMove(b: Box, frame: { width: number; height: number }, threshold: number): SnapResult {
  const bb = boundingBox(b);
  const cx = (bb.left + bb.right) / 2;
  const cy = (bb.top + bb.bottom) / 2;
  const best = (cands: { value: number; target: number }[]) => {
    let pick: { delta: number; target: number } | null = null;
    for (const c of cands) {
      const delta = c.target - c.value;
      if (Math.abs(delta) <= threshold && (!pick || Math.abs(delta) < Math.abs(pick.delta))) {
        pick = { delta, target: c.target };
      }
    }
    return pick;
  };
  const sx = best([
    { value: bb.left, target: 0 },
    { value: cx, target: frame.width / 2 },
    { value: bb.right, target: frame.width },
  ]);
  const sy = best([
    { value: bb.top, target: 0 },
    { value: cy, target: frame.height / 2 },
    { value: bb.bottom, target: frame.height },
  ]);
  return {
    dx: sx?.delta ?? 0,
    dy: sy?.delta ?? 0,
    guides: [
      ...(sx ? [{ axis: "x" as const, at: sx.target }] : []),
      ...(sy ? [{ axis: "y" as const, at: sy.target }] : []),
    ],
  };
}

/** Curseur de redimensionnement le plus proche de la direction de la poignée, rotation comprise. */
export function resizeCursor(dir: HandleDir, rotation: number): string {
  const angle = normalizeAngle((Math.atan2(dir.hy, dir.hx) * 180) / Math.PI + rotation);
  // Les directions opposées partagent le même curseur : on replie sur [0, 180[.
  const folded = ((angle % 180) + 180) % 180;
  const cursors = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];
  return cursors[Math.round(folded / 45) % 4] as string;
}
