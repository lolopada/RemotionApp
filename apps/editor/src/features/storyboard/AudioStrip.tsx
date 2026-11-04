import { clipVolumeAt } from "@app/composition";
import { type AudioClip, framesToSeconds, getProjectDurationInFrames, getSceneTimings } from "@app/schema";
import clsx from "clsx";
import { Music } from "lucide-react";
import { useMemo, useRef } from "react";
import { WaveformCanvas } from "../../components/WaveformCanvas";
import { useWaveform } from "../../lib/useWaveform";
import { useEditor, useProject } from "../../store/editorStore";
import { type ClipGeom, moveClip, trimClipEnd, trimClipStart } from "./audioEdit";

type Handle = "move" | "start" | "end";

interface Gesture {
  handle: Handle;
  pointerX: number;
  start: ClipGeom;
}

/** Distance d'aimantation, en pixels écran. */
const SNAP_PX = 8;

/**
 * Piste de musique sous le storyboard, à l'échelle de la durée totale, avec la forme d'onde
 * dans chaque morceau. On glisse le morceau pour le déplacer, ses bords pour le couper ;
 * début et fin s'aimantent sur les changements de scène (traits verticaux).
 */
export function AudioStrip() {
  const project = useProject();
  const total = getProjectDurationInFrames(project);
  const trackRef = useRef<HTMLDivElement>(null);
  const timings = useMemo(() => getSceneTimings(project.scenes), [project.scenes]);
  // Repères d'aimantation : début de la vidéo, chaque changement de scène, fin.
  const targets = useMemo(
    () => [0, total, ...timings.flatMap((t) => [t.startFrame, t.startFrame + t.durationInFrames])],
    [timings, total],
  );

  return (
    <div className="flex items-center gap-2 px-4 pb-2.5">
      <Music size={13} className="shrink-0 text-ink-faint" />
      <div ref={trackRef} className="relative h-12 flex-1 overflow-hidden rounded bg-canvas">
        {timings.slice(1).map((t) => (
          <span
            key={t.sceneId}
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/15"
            style={{ left: `${(t.startFrame / total) * 100}%` }}
          />
        ))}
        {project.audio.length === 0 ? (
          <span className="absolute inset-0 flex items-center px-2 text-[11px] text-ink-faint">
            Aucune musique — ajoute-en depuis l'onglet Musique
          </span>
        ) : null}
        {project.audio.map((clip) => (
          <ClipBar key={clip.id} clip={clip} total={total} fps={project.fps} trackRef={trackRef} targets={targets} />
        ))}
      </div>
    </div>
  );
}

function ClipBar({
  clip,
  total,
  fps,
  trackRef,
  targets,
}: {
  clip: AudioClip;
  total: number;
  fps: number;
  trackRef: React.RefObject<HTMLDivElement | null>;
  targets: number[];
}) {
  const selected = useEditor((s) => s.selectedAudioId === clip.id);
  const { selectAudio, updateAudio } = useEditor.getState();
  const wave = useWaveform(clip.src);
  const gesture = useRef<Gesture | null>(null);
  const shownFrames = Math.max(1, Math.min(clip.durationInFrames, total - clip.startFrame));
  const fileFrames = wave ? Math.floor(wave.duration * fps) : null;

  const begin = (e: React.PointerEvent, handle: Handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    selectAudio(clip.id);
    gesture.current = {
      handle,
      pointerX: e.clientX,
      start: {
        startFrame: clip.startFrame,
        durationInFrames: clip.durationInFrames,
        trimStartFrames: clip.trimStartFrames,
      },
    };
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    const width = trackRef.current?.clientWidth;
    if (!g || !width) return;
    const framesPerPx = total / width;
    const delta = (e.clientX - g.pointerX) * framesPerPx;
    const threshold = e.altKey ? 0 : SNAP_PX * framesPerPx;
    const next =
      g.handle === "move"
        ? moveClip(g.start, delta, targets, threshold)
        : g.handle === "start"
          ? trimClipStart(g.start, delta, targets, threshold)
          : trimClipEnd(g.start, delta, fileFrames, targets, threshold);
    updateAudio(clip.id, (c) => {
      c.startFrame = next.startFrame;
      c.durationInFrames = next.durationInFrames;
      c.trimStartFrames = next.trimStartFrames;
    });
  };

  const end = () => {
    gesture.current = null;
  };

  const common = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  const from = framesToSeconds(clip.trimStartFrames, fps);
  const to = from + framesToSeconds(clip.durationInFrames, fps);
  // Les fondus et le volume sont visibles dans la courbe.
  const envelope = (t: number) => Math.min(1, clipVolumeAt(clip, t * clip.durationInFrames));

  return (
    <div
      className={clsx(
        "absolute top-1 bottom-1 overflow-hidden rounded",
        selected ? "bg-emerald-600 ring-1 ring-emerald-300" : "bg-emerald-800/80 hover:bg-emerald-700",
      )}
      style={{
        left: `${(clip.startFrame / total) * 100}%`,
        width: `${(shownFrames / total) * 100}%`,
      }}
      title={`${clip.name || "Musique"} — glisse pour déplacer, tire les bords pour couper (Alt : sans aimantation)`}
    >
      {wave ? <WaveformCanvas src={clip.src} wave={wave} from={from} to={to} envelope={envelope} /> : null}
      <div
        role="presentation"
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => begin(e, "move")}
        {...common}
      >
        <span className="pointer-events-none absolute top-0 left-2 max-w-[80%] truncate text-[10px] text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
          {clip.name || "Musique"}
        </span>
      </div>
      {(["start", "end"] as const).map((side) => (
        <div
          key={side}
          role="presentation"
          className={clsx(
            "absolute top-0 bottom-0 w-2 cursor-col-resize touch-none bg-white/0 hover:bg-white/40",
            side === "start" ? "left-0" : "right-0",
            selected && "bg-white/30",
          )}
          onPointerDown={(e) => begin(e, side)}
          {...common}
        />
      ))}
    </div>
  );
}
