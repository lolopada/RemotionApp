import { getProjectDurationInFrames } from "@app/schema";
import clsx from "clsx";
import { Music } from "lucide-react";
import { useEditor, useProject } from "../../store/editorStore";

/** Piste audio visuelle sous le storyboard (proportionnelle à la durée totale). */
export function AudioStrip() {
  const project = useProject();
  const selectedAudioId = useEditor((s) => s.selectedAudioId);
  const selectAudio = useEditor((s) => s.selectAudio);
  const total = getProjectDurationInFrames(project);

  return (
    <div className="flex items-center gap-2 px-4 pb-2.5">
      <Music size={13} className="shrink-0 text-ink-faint" />
      <div className="relative h-6 flex-1 rounded bg-canvas">
        {project.audio.length === 0 ? (
          <span className="absolute inset-0 flex items-center px-2 text-[11px] text-ink-faint">
            Aucune musique — ajoute-en depuis l'onglet Musique
          </span>
        ) : null}
        {project.audio.map((clip) => (
          <button
            type="button"
            key={clip.id}
            onClick={() => selectAudio(clip.id)}
            className={clsx(
              "absolute top-0.5 bottom-0.5 truncate rounded px-2 text-left text-[11px] text-white transition",
              clip.id === selectedAudioId ? "bg-emerald-500" : "bg-emerald-700/80 hover:bg-emerald-600",
            )}
            style={{
              left: `${(clip.startFrame / total) * 100}%`,
              width: `${(Math.min(clip.durationInFrames, total - clip.startFrame) / total) * 100}%`,
            }}
            title={clip.name}
          >
            {clip.name || "Musique"}
          </button>
        ))}
      </div>
    </div>
  );
}
