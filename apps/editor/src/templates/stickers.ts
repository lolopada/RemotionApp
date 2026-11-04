/**
 * Petite bibliothèque de stickers intégrée : de vrais SVG dessinés dans une boîte 100×100,
 * sans texte (une police ne s'exporterait pas dans une image SVG).
 * Un sticker est ajouté comme calque photo (`src` = data:image/svg+xml, ajusté dans son cadre),
 * donc il garde cadre, ombre, bordure, filtres, miroir, rotation et animations.
 */

export type StickerCategory = "Éclats" | "Cœurs et nature" | "Fête" | "Repères et déco";

export interface Sticker {
  id: string;
  label: string;
  category: StickerCategory;
  /** Contenu SVG (viewBox 0 0 100 100). */
  svg: string;
}

const f = (n: number) => Math.round(n * 10) / 10;
const points = (list: [number, number][]) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");

/** Étoile / explosion à `n` branches. */
function star(cx: number, cy: number, outer: number, inner: number, n = 5, rotation = -90): string {
  const list: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rotation + (i * 180) / n) * Math.PI) / 180;
    const r = i % 2 === 0 ? outer : inner;
    list.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return points(list);
}

/** Pétales : `n` ellipses réparties autour d'un centre. */
function petals(cx: number, cy: number, n: number, dist: number, rx: number, ry: number, fill: string): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 360) / n;
    return `<ellipse cx="${cx}" cy="${cy - dist}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join("");
}

/** Rayons : traits arrondis autour d'un centre. */
function rays(cx: number, cy: number, from: number, to: number, n: number, stroke: string, width: number): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    const x1 = cx + from * Math.cos(a);
    const y1 = cy + from * Math.sin(a);
    const x2 = cx + to * Math.cos(a);
    const y2 = cy + to * Math.sin(a);
    return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
  }).join("");
}

const HEART =
  "M50 88 C20 64 6 48 6 32 C6 18 17 10 29 10 C39 10 46 16 50 24 C54 16 61 10 71 10 C83 10 94 18 94 32 C94 48 80 64 50 88 Z";

export const STICKERS: Sticker[] = [
  // ───── Éclats ─────
  {
    id: "star",
    label: "Étoile",
    category: "Éclats",
    svg: `<polygon points="${star(50, 54, 46, 19)}" fill="#facc15" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round"/><polygon points="${star(50, 54, 28, 11)}" fill="#fde68a"/>`,
  },
  {
    id: "sparkle",
    label: "Paillettes",
    category: "Éclats",
    svg: `<path d="M50 6 Q54 46 94 50 Q54 54 50 94 Q46 54 6 50 Q46 46 50 6Z" fill="#fef08a" stroke="#facc15" stroke-width="2.5" stroke-linejoin="round"/><path d="M82 8 Q83.5 20 96 22 Q83.5 24 82 36 Q80.5 24 68 22 Q80.5 20 82 8Z" fill="#ffffff"/><path d="M18 66 Q19 74 27 75 Q19 76 18 84 Q17 76 9 75 Q17 74 18 66Z" fill="#ffffff"/>`,
  },
  {
    id: "bolt",
    label: "Éclair",
    category: "Éclats",
    svg: `<polygon points="60,4 20,56 46,56 36,96 80,40 54,40" fill="#facc15" stroke="#f97316" stroke-width="4" stroke-linejoin="round"/>`,
  },
  {
    id: "boom",
    label: "Explosion",
    category: "Éclats",
    svg: `<polygon points="${star(50, 50, 48, 28, 12, -90)}" fill="#ef4444" stroke="#7f1d1d" stroke-width="3" stroke-linejoin="round"/><polygon points="${star(50, 50, 34, 20, 12, -75)}" fill="#fb923c"/><polygon points="${star(50, 50, 20, 12, 12, -90)}" fill="#fde047"/>`,
  },
  {
    id: "fireworks",
    label: "Feu d'artifice",
    category: "Éclats",
    svg: `${rays(50, 50, 14, 40, 12, "#f472b6", 5)}${rays(50, 50, 6, 10, 12, "#fde047", 4)}<circle cx="50" cy="50" r="4" fill="#ffffff"/>`,
  },
  {
    id: "confetti",
    label: "Confettis",
    category: "Éclats",
    svg: `<rect x="12" y="14" width="14" height="6" rx="1.5" fill="#f43f5e" transform="rotate(30 19 17)"/><rect x="66" y="10" width="14" height="6" rx="1.5" fill="#22d3ee" transform="rotate(-40 73 13)"/><rect x="40" y="38" width="14" height="6" rx="1.5" fill="#facc15" transform="rotate(75 47 41)"/><rect x="76" y="48" width="14" height="6" rx="1.5" fill="#a78bfa" transform="rotate(15 83 51)"/><rect x="14" y="62" width="14" height="6" rx="1.5" fill="#4ade80" transform="rotate(-20 21 65)"/><rect x="50" y="78" width="14" height="6" rx="1.5" fill="#fb923c" transform="rotate(50 57 81)"/><circle cx="30" cy="40" r="4" fill="#fb923c"/><circle cx="62" cy="62" r="4" fill="#f472b6"/><circle cx="88" cy="82" r="4" fill="#38bdf8"/><circle cx="88" cy="24" r="3" fill="#facc15"/><circle cx="8" cy="88" r="3" fill="#a78bfa"/><circle cx="40" cy="12" r="3" fill="#4ade80"/>`,
  },
  // ───── Cœurs et nature ─────
  {
    id: "heart",
    label: "Cœur",
    category: "Cœurs et nature",
    svg: `<path d="${HEART}" fill="#f43f5e" stroke="#be123c" stroke-width="3" stroke-linejoin="round"/><path d="M22 28 Q24 20 33 19" fill="none" stroke="#fecdd3" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "hearts",
    label: "Cœurs",
    category: "Cœurs et nature",
    svg: `<path d="${HEART}" fill="#f9a8d4" transform="translate(4 30) scale(0.55)"/><path d="${HEART}" fill="#ec4899" transform="translate(40 4) scale(0.58)"/><path d="${HEART}" fill="#fb7185" transform="translate(50 52) scale(0.42)"/>`,
  },
  {
    id: "sun",
    label: "Soleil",
    category: "Cœurs et nature",
    svg: `${rays(50, 50, 33, 46, 12, "#fb923c", 6)}<circle cx="50" cy="50" r="26" fill="#facc15" stroke="#f59e0b" stroke-width="3"/>`,
  },
  {
    id: "moon",
    label: "Lune",
    category: "Cœurs et nature",
    svg: `<defs><mask id="m"><rect width="100" height="100" fill="#fff"/><circle cx="66" cy="38" r="32" fill="#000"/></mask></defs><circle cx="46" cy="54" r="40" fill="#fde68a" mask="url(#m)"/><polygon points="${star(78, 20, 7, 3, 4, -90)}" fill="#fde68a"/>`,
  },
  {
    id: "cloud",
    label: "Nuage",
    category: "Cœurs et nature",
    svg: `<g fill="#e0f2fe"><circle cx="30" cy="60" r="20"/><circle cx="52" cy="44" r="24"/><circle cx="74" cy="60" r="18"/><rect x="30" y="58" width="44" height="22"/></g><path d="M16 78 H84" stroke="#bae6fd" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "rainbow",
    label: "Arc-en-ciel",
    category: "Cœurs et nature",
    svg: `<g fill="none" stroke-width="6" stroke-linecap="round"><path d="M8 76 A42 42 0 0 1 92 76" stroke="#ef4444"/><path d="M14 76 A36 36 0 0 1 86 76" stroke="#fb923c"/><path d="M20 76 A30 30 0 0 1 80 76" stroke="#facc15"/><path d="M26 76 A24 24 0 0 1 74 76" stroke="#4ade80"/><path d="M32 76 A18 18 0 0 1 68 76" stroke="#38bdf8"/></g><g fill="#ffffff"><circle cx="14" cy="80" r="9"/><circle cx="24" cy="82" r="8"/><circle cx="86" cy="80" r="9"/><circle cx="76" cy="82" r="8"/></g>`,
  },
  {
    id: "flower",
    label: "Fleur",
    category: "Cœurs et nature",
    svg: `${petals(50, 50, 6, 22, 12, 20, "#f9a8d4")}<circle cx="50" cy="50" r="12" fill="#facc15" stroke="#f59e0b" stroke-width="2"/>`,
  },
  {
    id: "leaf",
    label: "Feuille",
    category: "Cœurs et nature",
    svg: `<path d="M14 86 C10 44 36 12 90 10 C92 60 66 90 14 86 Z" fill="#4ade80" stroke="#15803d" stroke-width="3" stroke-linejoin="round"/><path d="M14 86 C36 62 54 42 78 22" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "drop",
    label: "Goutte",
    category: "Cœurs et nature",
    svg: `<path d="M50 6 C50 6 18 44 18 64 C18 82 32 94 50 94 C68 94 82 82 82 64 C82 44 50 6 50 6 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="3" stroke-linejoin="round"/><path d="M34 64 Q34 76 44 80" fill="none" stroke="#e0f2fe" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "snowflake",
    label: "Flocon",
    category: "Cœurs et nature",
    svg: `<g stroke="#7dd3fc" stroke-width="5" stroke-linecap="round" fill="none"><path d="M50 8 V92 M14 29 L86 71 M14 71 L86 29"/><path d="M42 14 L50 22 L58 14 M42 86 L50 78 L58 86 M10 38 L20 40 L18 30 M90 62 L80 60 L82 70 M10 62 L20 60 L18 70 M90 38 L80 40 L82 30"/></g>`,
  },
  {
    id: "wave",
    label: "Vague",
    category: "Cœurs et nature",
    svg: `<path d="M6 40 Q18 22 30 40 T54 40 T78 40 T98 36" fill="none" stroke="#38bdf8" stroke-width="7" stroke-linecap="round"/><path d="M2 64 Q14 46 26 64 T50 64 T74 64 T96 60" fill="none" stroke="#0ea5e9" stroke-width="7" stroke-linecap="round"/>`,
  },
  // ───── Fête ─────
  {
    id: "balloon",
    label: "Ballon",
    category: "Fête",
    svg: `<ellipse cx="50" cy="40" rx="28" ry="33" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/><polygon points="50,72 44,82 56,82" fill="#b91c1c"/><path d="M50 82 Q38 90 50 98" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/><path d="M34 26 Q36 18 44 15" fill="none" stroke="#fecaca" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "gift",
    label: "Cadeau",
    category: "Fête",
    svg: `<rect x="12" y="42" width="76" height="50" rx="4" fill="#a78bfa" stroke="#6d28d9" stroke-width="3"/><rect x="8" y="30" width="84" height="18" rx="4" fill="#c4b5fd" stroke="#6d28d9" stroke-width="3"/><rect x="44" y="30" width="12" height="62" fill="#fde047"/><path d="M50 30 C38 8 18 14 30 28 Z M50 30 C62 8 82 14 70 28 Z" fill="#fde047" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>`,
  },
  {
    id: "party",
    label: "Cotillon",
    category: "Fête",
    svg: `<polygon points="14,92 30,40 60,70" fill="#fb923c" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/><path d="M26 54 L44 64 M20 72 L36 80" stroke="#fde68a" stroke-width="4" stroke-linecap="round"/><path d="M50 40 Q60 20 74 24 M60 56 Q82 52 88 38 M44 28 Q46 12 58 8" fill="none" stroke="#f472b6" stroke-width="3.5" stroke-linecap="round"/><circle cx="76" cy="12" r="4" fill="#22d3ee"/><circle cx="90" cy="60" r="4" fill="#facc15"/><circle cx="68" cy="34" r="3.5" fill="#4ade80"/>`,
  },
  {
    id: "crown",
    label: "Couronne",
    category: "Fête",
    svg: `<polygon points="10,78 6,30 30,52 50,18 70,52 94,30 90,78" fill="#facc15" stroke="#d97706" stroke-width="3.5" stroke-linejoin="round"/><rect x="10" y="78" width="80" height="12" rx="3" fill="#f59e0b" stroke="#d97706" stroke-width="3"/><circle cx="6" cy="30" r="5" fill="#ef4444"/><circle cx="50" cy="16" r="5" fill="#38bdf8"/><circle cx="94" cy="30" r="5" fill="#ef4444"/><circle cx="50" cy="66" r="6" fill="#ef4444"/>`,
  },
  {
    id: "cake",
    label: "Gâteau",
    category: "Fête",
    svg: `<rect x="14" y="56" width="72" height="34" rx="5" fill="#fbcfe8" stroke="#db2777" stroke-width="3"/><path d="M14 66 Q24 78 34 66 T54 66 T74 66 T86 66" fill="#f472b6" stroke="#db2777" stroke-width="3"/><rect x="22" y="38" width="56" height="20" rx="4" fill="#fde68a" stroke="#d97706" stroke-width="3"/><rect x="47" y="24" width="6" height="14" fill="#60a5fa"/><path d="M50 8 C58 16 57 22 50 24 C43 22 42 16 50 8 Z" fill="#fb923c" stroke="#ea580c" stroke-width="2"/>`,
  },
  {
    id: "bunting",
    label: "Guirlande",
    category: "Fête",
    svg: `<path d="M4 16 Q50 44 96 16" fill="none" stroke="#64748b" stroke-width="3"/><polygon points="10,21 28,28 16,50" fill="#f43f5e"/><polygon points="30,29 48,34 38,56" fill="#facc15"/><polygon points="50,34 68,32 58,56" fill="#38bdf8"/><polygon points="70,31 88,24 80,48" fill="#4ade80"/>`,
  },
  // ───── Repères et déco ─────
  {
    id: "check",
    label: "Validé",
    category: "Repères et déco",
    svg: `<circle cx="50" cy="50" r="44" fill="#22c55e" stroke="#15803d" stroke-width="3"/><path d="M28 52 L44 68 L74 34" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "arrow-curve",
    label: "Flèche courbe",
    category: "Repères et déco",
    svg: `<path d="M14 80 C12 40 44 18 80 30" fill="none" stroke="#f97316" stroke-width="7" stroke-linecap="round"/><path d="M62 14 L84 31 L60 46" fill="none" stroke="#f97316" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "arrow-doodle",
    label: "Flèche gribouillée",
    category: "Repères et déco",
    svg: `<path d="M8 62 C28 40 40 76 58 52 S76 46 86 50" fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/><path d="M72 32 L92 50 L70 66" fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "banner",
    label: "Bandeau",
    category: "Repères et déco",
    svg: `<polygon points="2,30 22,30 22,76 2,76 12,53" fill="#be123c"/><polygon points="98,30 78,30 78,76 98,76 88,53" fill="#be123c"/><polygon points="22,22 78,22 78,68 22,68" fill="#f43f5e" stroke="#9f1239" stroke-width="2.5" stroke-linejoin="round"/><polygon points="22,68 22,76 32,68" fill="#881337"/><polygon points="78,68 78,76 68,68" fill="#881337"/>`,
  },
  {
    id: "tag",
    label: "Étiquette",
    category: "Repères et déco",
    svg: `<path d="M10 50 L42 14 H88 Q94 14 94 20 V80 Q94 86 88 86 H42 Z" fill="#fde047" stroke="#ca8a04" stroke-width="3.5" stroke-linejoin="round"/><circle cx="32" cy="50" r="6" fill="#ffffff" stroke="#ca8a04" stroke-width="3"/>`,
  },
  {
    id: "rosette",
    label: "Rosette",
    category: "Repères et déco",
    svg: `<polygon points="30,60 20,96 38,86 50,96 54,62" fill="#2563eb"/><polygon points="70,60 80,96 62,86 50,96 46,62" fill="#1d4ed8"/><polygon points="${star(50, 40, 38, 31, 14, -90)}" fill="#facc15" stroke="#d97706" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="40" r="22" fill="#fde047" stroke="#d97706" stroke-width="2.5"/><polygon points="${star(50, 40, 13, 5.5, 5, -90)}" fill="#f59e0b"/>`,
  },
  {
    id: "thought",
    label: "Bulle de pensée",
    category: "Repères et déco",
    svg: `<g fill="#ffffff" stroke="#94a3b8" stroke-width="3"><circle cx="30" cy="38" r="20"/><circle cx="52" cy="26" r="22"/><circle cx="74" cy="38" r="20"/><circle cx="62" cy="52" r="18"/><circle cx="40" cy="52" r="18"/><circle cx="24" cy="76" r="6"/><circle cx="12" cy="90" r="4"/></g><g fill="#ffffff"><circle cx="30" cy="38" r="17"/><circle cx="52" cy="26" r="19"/><circle cx="74" cy="38" r="17"/><circle cx="62" cy="52" r="15"/><circle cx="40" cy="52" r="15"/></g>`,
  },
  {
    id: "tape",
    label: "Scotch",
    category: "Repères et déco",
    svg: `<polygon points="8,34 14,40 8,46 14,52 8,58 14,64 8,70 92,66 86,60 92,54 86,48 92,42 86,36 92,30" fill="#fcd34d" fill-opacity="0.85" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round" transform="rotate(-6 50 50)"/><g stroke="#ffffff" stroke-opacity="0.7" stroke-width="3" transform="rotate(-6 50 50)"><path d="M30 34 V66 M44 34 V66 M58 34 V66 M72 34 V66"/></g>`,
  },
  {
    id: "pin",
    label: "Punaise",
    category: "Repères et déco",
    svg: `<path d="M46 52 L50 94 L54 52 Z" fill="#94a3b8"/><ellipse cx="50" cy="52" rx="22" ry="8" fill="#be123c"/><path d="M34 52 L38 18 H62 L66 52 Z" fill="#ef4444"/><ellipse cx="50" cy="18" rx="14" ry="6" fill="#f87171" stroke="#be123c" stroke-width="2"/><path d="M42 24 L44 44" stroke="#fecaca" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "camera",
    label: "Appareil photo",
    category: "Repères et déco",
    svg: `<rect x="8" y="28" width="84" height="56" rx="8" fill="#334155" stroke="#0f172a" stroke-width="3"/><path d="M32 28 L38 16 H62 L68 28 Z" fill="#475569" stroke="#0f172a" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="56" r="20" fill="#0f172a"/><circle cx="50" cy="56" r="14" fill="#38bdf8"/><circle cx="44" cy="50" r="4" fill="#e0f2fe"/><circle cx="80" cy="38" r="3.5" fill="#f87171"/>`,
  },
  {
    id: "music",
    label: "Notes",
    category: "Repères et déco",
    svg: `<g fill="#a78bfa" stroke="#6d28d9" stroke-width="3" stroke-linejoin="round"><ellipse cx="28" cy="76" rx="14" ry="10"/><ellipse cx="72" cy="66" rx="14" ry="10"/><path d="M40 76 V22 L84 12 V66" fill="none" stroke-linecap="round"/><path d="M40 22 L84 12 V30 L40 40 Z"/></g>`,
  },
];

/** Image SVG complète (avec taille, indispensable pour <img> et l'export). */
export function stickerSvg(sticker: Sticker): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 100 100">${sticker.svg}</svg>`;
}

/** URL `data:` utilisable comme `src` d'un calque photo. */
export function stickerUrl(sticker: Sticker): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stickerSvg(sticker))}`;
}

export const STICKER_CATEGORIES: StickerCategory[] = ["Éclats", "Cœurs et nature", "Fête", "Repères et déco"];
