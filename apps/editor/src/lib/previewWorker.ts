/**
 * Fabrique une copie réduite d'une photo, hors du fil principal (voir previewImages.ts) :
 * téléchargement, décodage, réduction et encodage ne bloquent jamais l'interface.
 */
interface Job {
  id: number;
  src: string;
  max: number;
  minGain: number;
}

// Le projet est typé pour la page (DOM) : on décrit juste ce qu'on utilise du worker.
const ctx = globalThis as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage: (message: { id: number; blob: Blob | null }) => void;
};

ctx.onmessage = async (e: MessageEvent<Job>) => {
  const { id, src, max, minGain } = e.data;
  try {
    const res = await fetch(src, { credentials: "same-origin" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.type === "image/gif" || blob.type === "image/svg+xml") {
      ctx.postMessage({ id, blob: null });
      return;
    }
    const full = await createImageBitmap(blob);
    const k = max / Math.max(full.width, full.height);
    if (1 / k < minGain) {
      full.close();
      ctx.postMessage({ id, blob: null });
      return;
    }
    const width = Math.max(1, Math.round(full.width * k));
    const height = Math.max(1, Math.round(full.height * k));
    full.close();
    const small = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d")?.drawImage(small, 0, 0);
    small.close();
    // JPEG pour les photos ; PNG si l'image peut avoir de la transparence (photo détourée).
    const opaque = blob.type === "image/jpeg";
    const out = await canvas.convertToBlob(opaque ? { type: "image/jpeg", quality: 0.88 } : { type: "image/png" });
    ctx.postMessage({ id, blob: out });
  } catch {
    ctx.postMessage({ id, blob: null });
  }
};
