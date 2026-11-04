import { useEffect, useRef } from "react";
import { useWaveform } from "../lib/useWaveform";
import { normalizePeaks, peakReference, slicePeaks, type Waveform } from "../lib/waveform";

const BAR = 2;
const GAP = 1;

/**
 * Dessine la forme d'onde de la portion [from, to] (secondes) d'un fichier, en barres
 * centrées. `envelope` (0…1 → gain) fait apparaître les fondus et le volume.
 */
export function WaveformCanvas({
  src,
  from,
  to,
  color = "rgba(255,255,255,0.85)",
  envelope,
  className,
  wave: given,
}: {
  src: string;
  from: number;
  to: number;
  color?: string;
  envelope?: (t: number) => number;
  className?: string;
  /** Forme d'onde déjà chargée (évite un second appel au hook). */
  wave?: Waveform | null;
}) {
  const loaded = useWaveform(given === undefined ? src : null);
  const wave = given === undefined ? loaded : given;
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !wave) return;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      const columns = Math.max(1, Math.floor(w / (BAR + GAP)));
      const cols = normalizePeaks(slicePeaks(wave, from, to, columns), peakReference(wave.peaks));
      ctx.fillStyle = color;
      const mid = h / 2;
      for (let i = 0; i < columns; i++) {
        const gain = envelope ? envelope((i + 0.5) / columns) : 1;
        const amp = Math.min(1, (cols[i] ?? 0) * gain);
        const half = Math.max(0.5, amp * (h / 2 - 1));
        ctx.fillRect(i * (BAR + GAP), mid - half, BAR, half * 2);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [wave, from, to, color, envelope]);

  if (!wave) return null;
  return (
    <canvas ref={ref} className={className ?? "absolute inset-0 size-full"} role="img" aria-label="Forme d'onde" />
  );
}
