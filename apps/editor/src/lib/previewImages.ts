import type { ImageSources } from "@app/composition";
import { useSyncExternalStore } from "react";

/**
 * Copies réduites des photos, pour l'affichage dans l'éditeur.
 *
 * Une photo de téléphone (4032×3024, 12 Mpx) affichée dans un aperçu de 1 000 px oblige le
 * navigateur à décoder et redessiner 12 Mpx à chaque image de l'animation, pour chaque photo :
 * c'est ce qui fait ramer l'aperçu, les vignettes et la fenêtre « Nouvelle page ». On en
 * calcule une fois une copie à la taille utile (`createImageBitmap` décode hors du fil
 * principal, dans un worker), gardée pour la session. L'export, lui, garde les originales (qualité 4K).
 */

/** Côté le plus long des copies : aperçu (écran Retina compris) et petites vignettes. */
export const PREVIEW_MAX = 2048;
export const TILE_MAX = 360;
/** Une copie de plus de quelques pourcents de pixels en moins ne vaut pas le calcul. */
const MIN_GAIN = 1.3;
/** Copies calculées en même temps (le reste attend, l'interface reste fluide). */
const CONCURRENCY = 2;

type Entry = { state: "pending" } | { state: "ready"; url: string } | { state: "original" };

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
const queue: (() => Promise<void>)[] = [];
let running = 0;

const notify = () => {
  for (const l of listeners) l();
};

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    const job = queue.shift() as () => Promise<void>;
    running++;
    void job().finally(() => {
      running--;
      pump();
    });
  }
}

/** Les SVG (stickers), images intégrées et cadres vides ne sont pas concernés. */
const eligible = (src: string) => src !== "" && !src.startsWith("data:") && !/\.svg(\?|$)/i.test(src);

/** Le travail se fait dans un worker ; sans worker (vieux navigateur), on garde l'originale. */
let worker: Worker | null | undefined;
const waiting = new Map<number, (blob: Blob | null) => void>();
let nextId = 1;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./previewWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; blob: Blob | null }>) => {
      waiting.get(e.data.id)?.(e.data.blob);
      waiting.delete(e.data.id);
    };
  } catch {
    worker = null;
  }
  return worker;
}

async function makeCopy(src: string, max: number): Promise<Entry> {
  const w = typeof OffscreenCanvas === "undefined" ? null : getWorker();
  if (!w) return { state: "original" };
  const id = nextId++;
  // Adresse absolue : le worker ne connaît pas la page.
  const url = new URL(src, location.href).href;
  const blob = await new Promise<Blob | null>((resolve) => {
    waiting.set(id, resolve);
    w.postMessage({ id, src: url, max, minGain: MIN_GAIN });
  });
  return blob ? { state: "ready", url: URL.createObjectURL(blob) } : { state: "original" };
}

function request(src: string, max: number) {
  const key = `${max}|${src}`;
  if (cache.has(key)) return;
  cache.set(key, { state: "pending" });
  queue.push(async () => {
    let entry: Entry;
    try {
      entry = await makeCopy(src, max);
    } catch {
      entry = { state: "original" };
    }
    cache.set(key, entry);
    notify();
  });
  pump();
}

/**
 * Source à afficher : la copie réduite si elle est prête, sinon l'originale (la copie est
 * alors demandée, et l'affichage se met à jour tout seul quand elle arrive).
 */
export function previewSrc(src: string, max = PREVIEW_MAX): string {
  if (!eligible(src)) return src;
  const entry = cache.get(`${max}|${src}`);
  if (!entry) {
    // Hors du rendu React : la demande part au prochain tour.
    queueMicrotask(() => request(src, max));
    return src;
  }
  return entry.state === "ready" ? entry.url : src;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** À fournir à la composition (aperçu, vignettes, propositions) via `ImageSourcesContext`. */
export const previewImageSources: ImageSources = { get: (src) => previewSrc(src), subscribe };

/** Petite vignette d'interface (bibliothèque, fenêtre « Nouvelle page »…). */
export function useTileSrc(src: string): string {
  return useSyncExternalStore(
    subscribe,
    () => previewSrc(src, TILE_MAX),
    () => src,
  );
}
