import type { StoredFile } from "@app/schema";
import { Download, FolderOpen, LoaderCircle, Trash2, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatBytes, formatDuration, formatRelative } from "../../lib/format";
import { navigate } from "../../lib/router";
import { HomeLayout } from "./HomeLayout";

/** Toutes les vidéos exportées, gardées sur le serveur. */
export function VideosPage() {
  const [videos, setVideos] = useState<StoredFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVideos(await api.listVideos());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const total = videos?.reduce((n, v) => n + v.size, 0) ?? 0;

  return (
    <HomeLayout>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-semibold text-2xl">Mes vidéos</h1>
        {videos?.length ? (
          <span className="text-ink-faint text-xs">
            {videos.length} vidéo{videos.length > 1 ? "s" : ""} · {formatBytes(total)}
          </span>
        ) : null}
      </div>
      {error ? <p className="text-red-300 text-sm">{error}</p> : null}
      {videos === null && !error ? <LoaderCircle className="animate-spin text-ink-faint" /> : null}
      {videos?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-line border-dashed py-16 text-center text-ink-muted">
          <Video size={32} className="text-ink-faint" />
          Aucune vidéo exportée. Dans l'éditeur, « Exporter MP4 » l'enregistre ici automatiquement.
        </div>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
        {videos?.map((v) => (
          <VideoCard key={v.id} video={v} onChange={refresh} />
        ))}
      </div>
    </HomeLayout>
  );
}

function VideoCard({ video, onChange }: { video: StoredFile; onChange: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const ext = video.mime === "video/webm" ? "webm" : "mp4";

  return (
    <div className="overflow-hidden rounded-lg bg-panel ring-1 ring-line">
      {/* biome-ignore lint/a11y/useMediaCaption: vidéo exportée par l'utilisateur, sans sous-titres */}
      <video src={video.url} controls preload="metadata" className="aspect-video w-full bg-black" />
      <div className="space-y-2 p-3">
        <div>
          <p className="truncate font-medium text-sm">{video.name}</p>
          <p className="text-[11px] text-ink-faint">
            {formatRelative(video.createdAt)}
            {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)}` : ""}
            {video.width ? ` · ${video.width}×${video.height}` : ""} · {formatBytes(video.size)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={video.url}
            download={`${video.name}.${ext}`}
            className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-white text-xs hover:bg-accent-hover"
          >
            <Download size={13} /> Télécharger
          </a>
          {video.projectId ? (
            <button
              type="button"
              onClick={() => void navigate(`/p/${video.projectId}`)}
              className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-ink-muted text-xs hover:bg-panel-hover hover:text-ink"
            >
              <FolderOpen size={13} /> Projet
            </button>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              if (!confirm) return setConfirm(true);
              await api.deleteVideo(video.id);
              onChange();
            }}
            onBlur={() => setConfirm(false)}
            className="ml-auto flex h-7 items-center gap-1.5 rounded-md px-2.5 text-red-300 text-xs hover:bg-red-500/15"
          >
            <Trash2 size={13} /> {confirm ? "Confirmer" : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}
