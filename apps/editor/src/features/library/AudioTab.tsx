import type { StoredFile as AssetInfo } from "@app/schema";
import { createAudioClip, getProjectDurationInFrames, secondsToFrames } from "@app/schema";
import { Music, Plus } from "lucide-react";
import { getAudioDurationInSeconds } from "../../lib/media";
import { useEditor, useProject } from "../../store/editorStore";
import { TabHeader } from "./LibraryPanel";
import { UploadButton } from "./UploadButton";
import { useAssets } from "./useAssets";

export function AudioTab() {
  const project = useProject();
  const addAudio = useEditor((s) => s.addAudio);
  const { assets, error, uploading, upload } = useAssets("audio");

  /** Ajoute le morceau à la suite des précédents, coupé à la fin de la vidéo. */
  const add = async (asset: AssetInfo) => {
    const seconds = await getAudioDurationInSeconds(asset.url).catch(() => 30);
    const total = getProjectDurationInFrames(project);
    const start = Math.min(
      total - 1,
      project.audio.reduce((end, c) => Math.max(end, c.startFrame + c.durationInFrames), 0),
    );
    addAudio(
      createAudioClip({
        name: asset.name,
        src: asset.url,
        startFrame: start,
        durationInFrames: Math.max(1, Math.min(secondsToFrames(seconds, project.fps), total - start)),
      }),
    );
  };

  return (
    <div>
      <TabHeader
        title="Musique"
        hint="Les morceaux s'enchaînent sur la piste sous le storyboard, avec fondus automatiques."
      />
      <div className="px-3">
        <UploadButton
          accept="audio/*"
          label="Importer une musique"
          uploading={uploading}
          onFiles={(f) => void upload(f)}
        />
        {error ? <p className="mt-2 text-[11px] text-red-300">{error}</p> : null}
      </div>
      <ul className="space-y-1 p-3">
        {assets.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded-md bg-canvas px-2 py-1.5 ring-1 ring-line">
            <Music size={14} className="shrink-0 text-emerald-400" />
            <span className="min-w-0 flex-1 truncate text-xs">{a.name}</span>
            <button
              type="button"
              title="Ajouter à la piste"
              onClick={() => void add(a)}
              className="rounded p-1 text-ink-muted hover:bg-panel-hover hover:text-ink"
            >
              <Plus size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
