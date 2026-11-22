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

/**
 * Rangées « ajustées » (façon album photo) : chaque rangée a la hauteur qui fait tenir ses
 * photos entières sur toute la largeur, puis on étire légèrement les rangées pour remplir
 * la hauteur. On garde le nombre de rangées qui déforme le moins. Les photos sont donc très
 * peu rognées, quel que soit leur format.
 */
export function justifiedRows(r: Rect, aspects: number[], gap = 0): Rect[] {
  const n = aspects.length;
  if (n === 0) return [];
  let best: Rect[] = [];
  let bestScore = Number.POSITIVE_INFINITY;
  for (let rows = 1; rows <= n; rows++) {
    // Répartition régulière : les premières rangées prennent une photo de plus.
    const counts = Array.from({ length: rows }, (_, i) => Math.floor(n / rows) + (i < n % rows ? 1 : 0));
    let k = 0;
    const heights = counts.map((c) => {
      const sum = aspects.slice(k, k + c).reduce((a, b) => a + b, 0);
      k += c;
      return (r.width - gap * (c - 1)) / sum;
    });
    const natural = heights.reduce((a, b) => a + b, 0);
    const stretch = (r.height - gap * (rows - 1)) / natural;
    if (stretch <= 0) continue;
    const score = Math.abs(Math.log(stretch));
    if (score >= bestScore) continue;
    bestScore = score;
    best = [];
    let y = r.y;
    k = 0;
    counts.forEach((c, row) => {
      const h = (heights[row] as number) * stretch;
      let x = r.x;
      for (let i = 0; i < c; i++) {
        const w = (heights[row] as number) * (aspects[k] as number);
        best.push(rect(x, y, w, h));
        x += w + gap;
        k++;
      }
      y += h + gap;
    });
  }
  return best;
}

/**
 * Colonnes « maçonnerie » : les photos sont distribuées colonne après colonne, à leur hauteur
 * naturelle, puis chaque colonne est étirée pour remplir la zone. Ordre de sortie = ordre des photos.
 */
export function masonry(r: Rect, aspects: number[], cols: number, gap = 0): Rect[] {
  const n = aspects.length;
  cols = Math.max(1, Math.min(cols, n));
  const w = (r.width - gap * (cols - 1)) / cols;
  const columns: number[][] = Array.from({ length: cols }, () => []);
  aspects.forEach((_, i) => {
    // Chacune son tour (ordre de lecture gardé, ligne par ligne) ; aucune colonne vide.
    const c = i % cols;
    columns[c]?.push(i);
  });
  const out = new Array<Rect>(n);
  columns.forEach((items, c) => {
    const natural = items.reduce((s, i) => s + w / (aspects[i] as number), 0);
    const k = (r.height - gap * (items.length - 1)) / natural;
    let y = r.y;
    for (const i of items) {
      const h = (w / (aspects[i] as number)) * k;
      out[i] = rect(r.x + c * (w + gap), y, w, h);
      y += h + gap;
    }
  });
  return out;
}

/**
 * Cases qui se chevauchent en diagonale (du coin haut-gauche au coin bas-droit) : `size` est la
 * part de la zone occupée par chaque case.
 */
export function cascade(r: Rect, n: number, size = 0.55): Rect[] {
  const w = r.width * size;
  const h = r.height * size;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return rect(r.x + (r.width - w) * t, r.y + (r.height - h) * t, w, h);
  });
}

/** Cases du tour d'une grille `cols` × `rows`, dans l'ordre de lecture, + le centre. */
export function ring(r: Rect, cols: number, rows: number, gap = 0): { cells: Rect[]; center: Rect } {
  const all = grid(r, cols, rows, gap);
  const at = (i: number, j: number) => all[j * cols + i] as Rect;
  const cells: Rect[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) if (j === 0 || j === rows - 1 || i === 0 || i === cols - 1) cells.push(at(i, j));
  }
  const a = at(1, 1);
  const b = at(cols - 2, rows - 2);
  return { cells, center: rect(a.x, a.y, b.x + b.width - a.x, b.y + b.height - a.y) };
}

/** Carré de côté `size` (fraction du petit côté) centré dans la zone. */
export function squareIn(r: Rect, size = 1): Rect {
  const s = Math.min(r.width, r.height) * size;
  return rect(r.x + (r.width - s) / 2, r.y + (r.height - s) / 2, s, s);
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
      // (marge de 15 % : un mot isolé peut être fait de lettres larges, « m », « w »…)
      if (longestWord(t.text) * 1.15 > maxChars) return Number.POSITIVE_INFINITY;
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

// ---------------------------------------------------------------- Compositions libres

/**
 * Spirale dorée : la 1re case prend 62 % de la zone, la suivante 62 % du reste, en tournant
 * (gauche, haut, droite, bas…). Donne des tailles toutes différentes, sans symétrie.
 */
export function goldenSplit(r: Rect, n: number, gap = 0): Rect[] {
  const cells: Rect[] = [];
  let rest = r;
  for (let i = 0; i < n - 1; i++) {
    const k = 0.62;
    const far = i % 4 >= 2; // une fois sur deux, la grande case passe de l'autre côté
    if (rest.width >= rest.height) {
      const [a, b] = splitX(rest, far ? 1 - k : k, gap);
      cells.push(far ? b : a);
      rest = far ? a : b;
    } else {
      const [a, b] = splitY(rest, far ? 1 - k : k, gap);
      cells.push(far ? b : a);
      rest = far ? a : b;
    }
  }
  cells.push(rest);
  return cells.slice(0, n);
}

/**
 * Mosaïque libre : on coupe toujours la plus grande case, dans son sens le plus long, avec des
 * proportions qui varient (jamais 50/50). Renvoie les cases de la plus grande à la plus petite.
 */
export function freeMosaic(r: Rect, n: number, gap = 0): Rect[] {
  const ratios = [0.6, 0.42, 0.56, 0.36, 0.64, 0.46, 0.58, 0.4, 0.62];
  let pieces: Rect[] = [r];
  for (let i = 0; pieces.length < n; i++) {
    pieces.sort((a, b) => b.width * b.height - a.width * a.height);
    const [big, ...others] = pieces as [Rect, ...Rect[]];
    const k = ratios[i % ratios.length] as number;
    const [a, b] = big.width >= big.height * 0.9 ? splitX(big, k, gap) : splitY(big, k, gap);
    pieces = [...others, a, b];
  }
  return pieces.sort((a, b) => b.width * b.height - a.width * a.height);
}

/** Petit générateur pseudo-aléatoire à graine fixe : même contenu → même composition. */
export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Cases d'une grille « bousculée » : tailles, décalages et inclinaisons qui varient d'une case à
 * l'autre (collage fait à la main). La première case (photo mise en avant) est un peu plus grande.
 */
export function jumbled(r: Rect, n: number, gap: number, aspect: number): { box: Rect; rotation: number }[] {
  const rand = seeded(n * 7919 + Math.round(r.width));
  return bestGrid(r, n, gap, aspect).map((c, i) => {
    const scale = i === 0 ? 1.12 : 0.8 + rand() * 0.22;
    const w = c.width * scale;
    const h = c.height * scale;
    const dx = (rand() - 0.5) * c.width * 0.14;
    const dy = (rand() - 0.5) * c.height * 0.14;
    let x = c.x + (c.width - w) / 2 + dx;
    let y = c.y + (c.height - h) / 2 + dy;
    // On reste dans la zone.
    x = Math.max(r.x, Math.min(r.x + r.width - w, x));
    y = Math.max(r.y, Math.min(r.y + r.height - h, y));
    const rotation = Math.round((rand() - 0.5) * 14);
    return { box: rect(x, y, w, h), rotation };
  });
}

/**
 * Cartes en éventail le long d'un arc (pivot sous la zone) : positions et inclinaisons. Les
 * cartes sont aussi grandes que possible, réduites si l'arc ne tient pas dans la zone.
 */
export function fanArc(r: Rect, aspects: number[]): { box: Rect; rotation: number }[] {
  const n = aspects.length;
  const span = Math.min(44, 11 * (n - 1)); // ouverture totale, en degrés
  // Carte polaroid : un peu plus haute que la photo (bas plus large).
  const cardAspect = Math.min(1.25, Math.max(0.72, (aspects.reduce((x, y) => x + y, 0) / n) * 0.82));
  let h = r.height * 0.86;
  let w = h * cardAspect;
  let R = h * 2.1;
  const half = (span / 2) * (Math.PI / 180);
  const width = () => 2 * R * Math.sin(half) + w;
  const height = () => R * (1 - Math.cos(half)) + h;
  const k = Math.min(1, r.width / width(), r.height / height());
  h *= k;
  w *= k;
  R *= k;
  const cx = r.x + r.width / 2;
  const top = r.y + (r.height - height()) / 2;
  return Array.from({ length: n }, (_, i) => {
    const deg = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
    const a = (deg * Math.PI) / 180;
    const x = cx + R * Math.sin(a);
    const y = top + R * (1 - Math.cos(a));
    return { box: rect(x - w / 2, y, w, h), rotation: Math.round(deg) };
  });
}
