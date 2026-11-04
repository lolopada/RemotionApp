/**
 * Géométrie des mises en page : découpage de l'image en zones, photo logée dans une zone,
 * taille de police qui fait tenir un texte. Fonctions pures, en pixels de la composition.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Frame {
  width: number;
  height: number;
}

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
export const full = (f: Frame): Rect => rect(0, 0, f.width, f.height);
export const aspectOf = (r: { width: number; height: number }) => r.width / r.height;

/** Paysage (> 1.15), portrait (< 0.87) ou à peu près carré. */
export const isWide = (f: Frame) => f.width / f.height > 1.15;
export const isTall = (f: Frame) => f.width / f.height < 0.87;

/** Marge de base : 6 % du plus petit côté. */
export const margin = (f: Frame, k = 1) => Math.round(Math.min(f.width, f.height) * 0.06 * k);
/** Unité de police : 1 pour un côté court de 1080 px. */
export const unit = (f: Frame) => Math.min(f.width, f.height) / 1080;

export function inset(r: Rect, m: number, my = m): Rect {
  return rect(r.x + m, r.y + my, Math.max(1, r.width - 2 * m), Math.max(1, r.height - 2 * my));
}

/** Coupe en deux à `ratio` de la largeur (gauche, droite), avec un espace entre les deux. */
export function splitX(r: Rect, ratio: number, gap = 0): [Rect, Rect] {
  const w = (r.width - gap) * ratio;
  return [rect(r.x, r.y, w, r.height), rect(r.x + w + gap, r.y, r.width - gap - w, r.height)];
}

/** Coupe en deux à `ratio` de la hauteur (haut, bas). */
export function splitY(r: Rect, ratio: number, gap = 0): [Rect, Rect] {
  const h = (r.height - gap) * ratio;
  return [rect(r.x, r.y, r.width, h), rect(r.x, r.y + h + gap, r.width, r.height - gap - h)];
}

/** Coupe selon le sens le plus long de la zone : côte à côte en paysage, l'un sous l'autre sinon. */
export function splitLong(r: Rect, ratio: number, gap = 0): [Rect, Rect] {
  return r.width >= r.height ? splitX(r, ratio, gap) : splitY(r, ratio, gap);
}

/** Grille régulière de `cols` × `rows` cases, ligne par ligne. */
export function grid(r: Rect, cols: number, rows: number, gap = 0): Rect[] {
  const w = (r.width - gap * (cols - 1)) / cols;
  const h = (r.height - gap * (rows - 1)) / rows;
  const cells: Rect[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) cells.push(rect(r.x + i * (w + gap), r.y + j * (h + gap), w, h));
  }
  return cells;
}

/** `n` cases alignées dans le sens le plus long de la zone. */
export function strip(r: Rect, n: number, gap = 0): Rect[] {
  return r.width >= r.height ? grid(r, n, 1, gap) : grid(r, 1, n, gap);
}

/** Meilleure grille pour `n` éléments dans la zone (cases les plus proches du ratio voulu). */
export function bestGrid(r: Rect, n: number, gap = 0, targetAspect = 1): Rect[] {
  let best: Rect[] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    if (cols * rows - n >= cols) continue; // une ligne entière vide
    const cells = grid(r, cols, rows, gap);
    const cell = cells[0] as Rect;
    const score = Math.abs(Math.log(aspectOf(cell) / targetAspect)) + (cols * rows - n) * 0.35;
    if (score < bestScore) {
      bestScore = score;
      best = centerLastRow(cells.slice(0, n), cols, rows, n, gap);
    }
  }
  return best;
}

/** Centre les cases de la dernière ligne quand elle est incomplète. */
function centerLastRow(cells: Rect[], cols: number, rows: number, n: number, gap: number): Rect[] {
  const missing = cols * rows - n;
  if (missing === 0 || rows === 1) return cells;
  const shift = (missing * ((cells[0] as Rect).width + gap)) / 2;
  return cells.map((c, i) => (i >= (rows - 1) * cols ? { ...c, x: c.x + shift } : c));
}

/** Plus grand rectangle de ratio `aspect` centré dans la zone (la photo entière y tient). */
export function fitInside(r: Rect, aspect: number, scale = 1): Rect {
  let w = r.width * scale;
  let h = w / aspect;
  if (h > r.height * scale) {
    h = r.height * scale;
    w = h * aspect;
  }
  return rect(r.x + (r.width - w) / 2, r.y + (r.height - h) / 2, w, h);
}

/**
 * Carte polaroid dont la fenêtre photo a le ratio `aspect`, logée dans la zone.
 * Reprend la géométrie de `photoArea` (marge 6 % du petit côté, bas = 20 % de la hauteur).
 */
export function polaroidInside(r: Rect, aspect: number, scale = 1): Rect {
  // Ratio de la carte : on itère car la marge dépend de la taille de la carte.
  let cardAspect = aspect * 0.8;
  for (let k = 0; k < 4; k++) {
    const card = fitInside(r, cardAspect, scale);
    const m = Math.min(card.width, card.height) * 0.06;
    const photoW = card.width - 2 * m;
    // (H − m − 0.2H) × aspect = photoW  →  H = (photoW / aspect + m) / 0.8
    const h = (photoW / aspect + m) / 0.8;
    cardAspect = card.width / h;
  }
  return fitInside(r, cardAspect, scale);
}

export const round = (r: Rect): Rect => ({
  x: Math.round(r.x),
  y: Math.round(r.y),
  width: Math.max(1, Math.round(r.width)),
  height: Math.max(1, Math.round(r.height)),
});

/** Écart entre deux ratios (0 = identiques ; 0.69 = l'un fait le double de l'autre). */
export const aspectMismatch = (a: number, b: number) => Math.abs(Math.log(a / b));

// ---------------------------------------------------------------- Texte

/**
 * Nombre de lignes d'un texte coupé aux espaces, `maxChars` caractères par ligne au plus
 * (un mot plus long que la ligne occupe les lignes nécessaires).
 */
export function wrapLines(text: string, maxChars: number): number {
  const limit = Math.max(1, Math.floor(maxChars));
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines += 1;
      continue;
    }
    let current = 0;
    lines += 1;
    for (const word of words) {
      const len = word.length;
      if (current === 0) {
        current = len;
      } else if (current + 1 + len <= limit) {
        current += 1 + len;
      } else {
        lines += 1;
        current = len;
      }
      if (current > limit) {
        lines += Math.ceil(current / limit) - 1;
        current %= limit;
      }
    }
  }
  return lines;
}

export const longestWord = (text: string) => Math.max(0, ...text.split(/\s+/).map((w) => w.length));

export interface StackText {
  text: string;
  /** Taille relative au titre (1 = taille de titre). */
  weight: number;
  lineHeight: number;
  /** Largeur moyenne d'un caractère, en fraction de la taille de police. */
  charWidth: number;
  /** Taille minimale propre à ce texte (sinon celle de la pile). */
  min?: number;
}

export interface StackFit {
  fontSizes: number[];
  heights: number[];
  /** Espace sous chaque texte (avant le suivant). */
  gaps: number[];
  total: number;
  /** false = même à la taille minimale, le texte déborde de la zone. */
  fits: boolean;
  /** Taille du titre retenue / taille maximale demandée (1 = pas réduit). */
  scale: number;
}

/**
 * Taille de police pour qu'une pile de textes (titre, sous-titre, texte…) tienne dans la zone.
 * On part de `maxSize` (taille du titre) et on réduit jusqu'à ce que tout rentre.
 */
export function fitTextStack(
  texts: StackText[],
  zone: { width: number; height: number },
  maxSize: number,
  minSize: number,
): StackFit {
  const measure = (base: number) => {
    const fontSizes = texts.map((t) => Math.max(t.min ?? minSize, Math.round(base * t.weight)));
    const heights = texts.map((t, i) => {
      const fs = fontSizes[i] as number;
      const maxChars = zone.width / (fs * t.charWidth);
      // Un mot plus long que la ligne serait coupé en deux : on considère que ça ne tient pas.
      if (longestWord(t.text) > maxChars) return Number.POSITIVE_INFINITY;
      return Math.ceil(wrapLines(t.text, maxChars) * fs * t.lineHeight);
    });
    const gaps = fontSizes.map((fs, i) => (i < texts.length - 1 ? Math.round(fs * 0.45) : 0));
    const total = heights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
    return { fontSizes, heights, gaps, total };
  };
  let base = maxSize;
  let m = measure(base);
  while (m.total > zone.height && base > minSize) {
    base = Math.max(minSize, base * 0.93);
    m = measure(base);
  }
  if (!Number.isFinite(m.total)) {
    // Même au minimum un mot dépasse : hauteur estimée pour placer quand même les textes.
    m.heights = m.heights.map((h, i) => (Number.isFinite(h) ? h : Math.ceil((m.fontSizes[i] as number) * 2.6)));
    m.total = m.heights.reduce((a, b) => a + b, 0) + m.gaps.reduce((a, b) => a + b, 0);
    return { ...m, fits: false, scale: base / maxSize };
  }
  return { ...m, fits: m.total <= zone.height, scale: base / maxSize };
}
