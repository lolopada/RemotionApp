/**
 * Forme d'onde : pics de volume d'un fichier audio (ou de la bande son d'une vidéo),
 * calculés dans le navigateur. Le calcul est pur (testé) ; seul `loadWaveform` touche au réseau.
 */

export interface Waveform {
  /** Volume maximal (0…1) de chaque tranche de temps égale du fichier. */
  peaks: Float32Array;
  /** Durée du fichier, en secondes. */
  duration: number;
}

/** Plus grande valeur absolue de chaque tranche, tous canaux confondus. */
export function computePeaks(channels: Float32Array[], buckets: number): Float32Array {
  const peaks = new Float32Array(buckets);
  const length = channels[0]?.length ?? 0;
  if (length === 0 || buckets <= 0) return peaks;
  for (const data of channels) {
    for (let b = 0; b < buckets; b++) {
      const from = Math.floor((b * length) / buckets);
      const to = Math.max(from + 1, Math.floor(((b + 1) * length) / buckets));
      let max = peaks[b] ?? 0;
      for (let i = from; i < to && i < length; i++) {
        const v = Math.abs(data[i] ?? 0);
        if (v > max) max = v;
      }
      peaks[b] = max;
    }
  }
  return peaks;
}

/**
 * Colonnes d'affichage pour la portion [from, to] (secondes) du fichier.
 * Ce qui dépasse du fichier (avant 0 ou après la fin) vaut 0.
 */
export function slicePeaks(wave: Waveform, from: number, to: number, columns: number): Float32Array {
  const out = new Float32Array(Math.max(0, columns));
  const span = to - from;
  if (columns <= 0 || span <= 0 || wave.duration <= 0) return out;
  const perSecond = wave.peaks.length / wave.duration;
  for (let c = 0; c < columns; c++) {
    const t0 = from + (c * span) / columns;
    const t1 = from + ((c + 1) * span) / columns;
    if (t1 <= 0 || t0 >= wave.duration) continue;
    const i0 = Math.max(0, Math.floor(t0 * perSecond));
    const i1 = Math.min(wave.peaks.length, Math.max(i0 + 1, Math.ceil(t1 * perSecond)));
    let max = 0;
    for (let i = i0; i < i1; i++) max = Math.max(max, wave.peaks[i] ?? 0);
    out[c] = max;
  }
  return out;
}

/** Normalise pour que le pic le plus fort touche presque le haut (un morceau discret reste lisible). */
export function normalizePeaks(columns: Float32Array, reference: number): Float32Array {
  if (reference <= 0) return columns;
  return columns.map((v) => Math.min(1, v / reference));
}

/** Valeur de référence d'un fichier : le 99e centile des pics (un claquement isolé n'écrase pas tout). */
export function peakReference(peaks: Float32Array): number {
  if (peaks.length === 0) return 0;
  const sorted = [...peaks].sort((a, b) => a - b);
  return Math.max(0.02, sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? 0);
}

// --- Chargement (navigateur) ---

const RATE = 8000; // suffisant pour une courbe, et 5× plus léger que 44,1 kHz en mémoire
const PEAKS_PER_SECOND = 50;
const MAX_BUCKETS = 24_000;
const MAX_BYTES = 120 * 1024 * 1024;

const cache = new Map<string, Promise<Waveform | null>>();

/** Forme d'onde d'un fichier ; null si illisible (pas de piste audio, trop lourd, codec inconnu). Mise en cache. */
export function loadWaveform(url: string): Promise<Waveform | null> {
  let pending = cache.get(url);
  if (!pending) {
    pending = decode(url).catch(() => null);
    cache.set(url, pending);
  }
  return pending;
}

async function decode(url: string): Promise<Waveform | null> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return null;
  const size = Number(res.headers.get("content-length") ?? 0);
  if (size > MAX_BYTES) return null;
  const bytes = await res.arrayBuffer();
  // Un OfflineAudioContext à 8 kHz fait rééchantillonner le décodage : bien moins de mémoire.
  const ctx = new OfflineAudioContext(1, RATE, RATE);
  const audio = await ctx.decodeAudioData(bytes);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  const buckets = Math.min(MAX_BUCKETS, Math.max(200, Math.ceil(audio.duration * PEAKS_PER_SECOND)));
  return { peaks: computePeaks(channels, buckets), duration: audio.duration };
}
