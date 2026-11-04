import { useRef } from "react";
import { useWaveform } from "../lib/useWaveform";
import { WaveformCanvas } from "./WaveformCanvas";

/**
 * Forme d'onde du fichier entier. La partie utilisée (`range`, en secondes) reste claire, le reste est
 * assombri ; cliquer ou glisser place le point de départ (`onPick`, en secondes).
 */
export function WaveformPicker({
  src,
  range,
  start,
  onPick,
}: {
  src: string;
  /** Portion jouée [from, to] ; si absent, tout ce qui suit `start`. */
  range?: { from: number; to: number };
  start: number;
  onPick: (seconds: number, fileDuration: number) => void;
}) {
  const wave = useWaveform(src);
  const box = useRef<HTMLDivElement>(null);
  if (wave === undefined) return <div className="h-14 animate-pulse rounded-md bg-canvas" />;
  if (!wave) return null;

  const pct = (s: number) => `${Math.max(0, Math.min(1, s / wave.duration)) * 100}%`;
  const from = range?.from ?? start;
  const to = range?.to ?? wave.duration;

  const pick = (e: React.PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const t = ((e.clientX - rect.left) / rect.width) * wave.duration;
    onPick(Math.max(0, Math.min(wave.duration, Math.round(t * 10) / 10)), wave.duration);
  };

  return (
    <div
      ref={box}
      role="presentation"
      className="relative h-14 cursor-col-resize touch-none overflow-hidden rounded-md bg-canvas ring-1 ring-line"
      title="Clique ou glisse pour choisir où commence la lecture"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && pick(e)}
    >
      <WaveformCanvas src={src} wave={wave} from={0} to={wave.duration} color="rgba(167,139,250,0.9)" />
      <div className="pointer-events-none absolute inset-y-0 left-0 bg-black/55" style={{ width: pct(from) }} />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 bg-black/55"
        style={{ width: `${100 - Number.parseFloat(pct(to))}%` }}
      />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: pct(from) }} />
      <span className="pointer-events-none absolute right-1 bottom-0.5 text-[10px] text-white/70 tabular-nums">
        {wave.duration.toFixed(1).replace(".", ",")} s
      </span>
    </div>
  );
}
