import { getSceneAtFrame } from "@app/schema";
import { Pause, Play, SkipBack } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "../../components/ui";
import { formatSeconds } from "../../lib/media";
import { useEditor } from "../../store/editorStore";
import { playerRef } from "./playerController";

/** Barre de lecture sous l'aperçu (lecture, temps, curseur). */
export function Transport({ durationInFrames, fps }: { durationInFrames: number; fps: number }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    setFrame(player.getCurrentFrame());
    const onFrame = ({ detail }: { detail: { frame: number } }) => setFrame(detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  });

  const seek = (f: number) => {
    playerRef.current?.seekTo(f);
    const { project, selectScene, selectedSceneId } = useEditor.getState();
    const scene = getSceneAtFrame(project.scenes, f);
    if (scene && scene.id !== selectedSceneId) selectScene(scene.id);
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-line border-t px-4">
      <IconButton label="Revenir au début" onClick={() => seek(0)}>
        <SkipBack size={15} />
      </IconButton>
      <IconButton label={playing ? "Pause (Espace)" : "Lecture (Espace)"} onClick={() => playerRef.current?.toggle()}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </IconButton>
      <span className="w-24 shrink-0 text-ink-muted text-xs tabular-nums">
        {formatSeconds(frame, fps)} / {formatSeconds(durationInFrames, fps)}
      </span>
      <input
        type="range"
        className="w-full accent-accent"
        min={0}
        max={Math.max(0, durationInFrames - 1)}
        value={Math.min(frame, durationInFrames - 1)}
        onChange={(e) => seek(e.currentTarget.valueAsNumber)}
      />
    </div>
  );
}
