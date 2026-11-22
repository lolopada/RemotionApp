import clsx from "clsx";
import { Music, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { TabHeader } from "./LibraryPanel";
import { addAssetToTrack } from "./music/addToTrack";
import { MusicSuggestions } from "./music/MusicSuggestions";
import { UploadButton } from "./UploadButton";
import { useAssets } from "./useAssets";

type Status = { enabled: boolean; moods: { id: string; label: string }[] } | null;

export function AudioTab() {
  const { assets, error, uploading, upload, refresh } = useAssets("audio");
  const [status, setStatus] = useState<Status>(null);
  const [view, setView] = useState<"suggestions" | "mine">("suggestions");

  useEffect(() => {
    api
      .musicStatus()
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, moods: [] }));
  }, []);

  return (
    <div>
      <TabHeader
        title="Musique"
        hint="Les morceaux s'enchaînent sur la piste sous le storyboard, avec fondus automatiques."
      />
      <div className="mx-3 mb-2 grid grid-cols-2 rounded-md bg-canvas p-0.5 text-xs ring-1 ring-line">
        {(
          [
            ["suggestions", "Propositions"],
            ["mine", "Mes musiques"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={clsx(
              "rounded px-2 py-1 transition",
              view === id ? "bg-panel-hover text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "suggestions" ? (
        status === null ? null : status.enabled ? (
          <MusicSuggestions moods={status.moods} onImported={() => void refresh()} />
        ) : (
          <p className="mx-3 rounded-md border border-line border-dashed p-3 text-[11px] text-ink-faint leading-snug">
            Les propositions de musique ne sont pas encore activées sur ce serveur : il faut une clé Jamendo (gratuite),
            à mettre dans <code>JAMENDO_CLIENT_ID</code> (voir le guide de déploiement). En attendant, importe tes
            propres musiques dans « Mes musiques ».
          </p>
        )
      ) : (
        <>
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
                <span className="min-w-0 flex-1 truncate text-xs" title={a.credit ?? a.name}>
                  {a.name}
                </span>
                {a.credit ? (
                  <span className="shrink-0 rounded bg-panel px-1 text-[9px] text-ink-faint" title={a.credit}>
                    CC
                  </span>
                ) : null}
                <button
                  type="button"
                  title="Ajouter à la piste"
                  onClick={() => void addAssetToTrack(a)}
                  className="rounded p-1 text-ink-muted hover:bg-panel-hover hover:text-ink"
                >
                  <Plus size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
