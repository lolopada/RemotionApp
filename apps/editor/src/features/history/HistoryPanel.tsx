import { ProjectVideo } from "@app/composition";
import {
  framesToSeconds,
  getProjectDurationInFrames,
  type Project,
  type ProjectVersion,
  type ProjectVersionKind,
} from "@app/schema";
import { Player } from "@remotion/player";
import clsx from "clsx";
import { Bookmark, CopyPlus, History, LoaderCircle, RotateCcw, Save, Trash2, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui";
import { api } from "../../lib/api";
import { formatDuration } from "../../lib/format";
import { navigate } from "../../lib/router";
import { useEditor } from "../../store/editorStore";
import { projectFromVersion } from "../home/projectActions";

const KIND_LABEL: Record<ProjectVersionKind, string> = {
  auto: "Sauvegarde auto",
  manual: "Version nommée",
  "before-restore": "Avant restauration",
};

const PANEL_WIDTH = 400;
const PREVIEW_WIDTH = PANEL_WIDTH - 32;

const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const longDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Historique des versions du projet ouvert : aperçu jouable de chaque
 * version, restauration (annulable), copie en nouveau projet, versions nommées.
 */
export function HistoryPanel({
  onClose,
  flush,
  reload,
}: {
  onClose: () => void;
  flush: () => Promise<void>;
  reload: () => void;
}) {
  const projectId = useEditor((s) => s.project.id);
  const [versions, setVersions] = useState<ProjectVersion[] | null>(null);
  const [selected, setSelected] = useState<ProjectVersion | null>(null);
  const [preview, setPreview] = useState<Project | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVersions(await api.listVersions(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }, [projectId]);

  useEffect(() => {
    // Les dernières modifs d'abord, pour que l'historique soit à jour.
    void flush().then(refresh);
  }, [flush, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const select = async (v: ProjectVersion) => {
    setSelected(v);
    setPreview(null);
    setConfirmRestore(false);
    setNaming(null);
    try {
      setPreview(await api.getVersion(projectId, v.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const saveVersion = (e: FormEvent) => {
    e.preventDefault();
    void run("save", async () => {
      await flush();
      await api.createVersion(projectId, label.trim() || null);
      setLabel("");
      await refresh();
    });
  };

  const restore = (v: ProjectVersion) =>
    run("restore", async () => {
      await flush();
      await api.restoreVersion(projectId, v.id);
      reload();
      onClose();
    });

  const copyToNewProject = (v: ProjectVersion) =>
    run("copy", async () => {
      const id = await projectFromVersion(projectId, v.id, longDate(v.createdAt));
      await navigate(`/p/${id}`);
    });

  const keep = (v: ProjectVersion, name: string) =>
    run("keep", async () => {
      if (!name.trim()) return;
      const updated = await api.labelVersion(projectId, v.id, name.trim());
      setSelected(updated);
      setNaming(null);
      await refresh();
    });

  const remove = (v: ProjectVersion) =>
    run("delete", async () => {
      await api.deleteVersion(projectId, v.id);
      setSelected(null);
      setPreview(null);
      await refresh();
    });

  const groups = useMemo(() => {
    const map = new Map<string, ProjectVersion[]>();
    for (const v of versions ?? []) {
      const key = dayLabel(v.createdAt);
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return [...map.entries()];
  }, [versions]);

  return (
    <>
      <button
        type="button"
        aria-label="Fermer l'historique"
        className="fixed inset-0 top-12 z-30 cursor-default bg-black/30"
        onClick={onClose}
      />
      <aside
        className="fixed top-12 right-0 bottom-0 z-40 flex flex-col border-line border-l bg-panel shadow-2xl shadow-black/60"
        style={{ width: PANEL_WIDTH }}
        aria-label="Historique des versions"
      >
        <div className="flex items-center gap-2 border-line border-b px-4 py-3">
          <History size={16} className="text-accent" />
          <h2 className="flex-1 font-semibold text-sm">Historique des versions</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-ink-faint hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={saveVersion} className="flex gap-2 border-line border-b px-4 py-3">
          <input
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-canvas px-2 text-xs outline-none focus:border-accent"
            placeholder="Nommer l'état actuel (ex. : avant les transitions)"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
          />
          <Button type="submit" variant="primary" size="sm" disabled={busy !== null}>
            {busy === "save" ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
            Enregistrer
          </Button>
        </form>

        {selected ? (
          <div className="border-line border-b bg-canvas/60 p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="truncate font-medium text-sm">{selected.label ?? KIND_LABEL[selected.kind]}</p>
              <span className="shrink-0 text-[11px] text-ink-faint">{longDate(selected.createdAt)}</span>
            </div>
            <div
              className="flex items-center justify-center overflow-hidden rounded-md bg-black"
              style={{ width: PREVIEW_WIDTH, height: Math.round((PREVIEW_WIDTH * 9) / 16) }}
            >
              {preview ? (
                <Player
                  key={selected.id}
                  component={ProjectVideo}
                  inputProps={{ project: preview, showPlaceholders: true }}
                  durationInFrames={getProjectDurationInFrames(preview)}
                  compositionWidth={preview.width}
                  compositionHeight={preview.height}
                  fps={preview.fps}
                  controls
                  style={{ width: "100%", height: "100%" }}
                  acknowledgeRemotionLicense
                />
              ) : (
                <LoaderCircle className="animate-spin text-ink-faint" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="primary"
                disabled={busy !== null}
                onClick={() => (confirmRestore ? void restore(selected) : setConfirmRestore(true))}
              >
                {busy === "restore" ? <LoaderCircle size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                {confirmRestore ? "Confirmer" : "Restaurer"}
              </Button>
              <Button size="sm" disabled={busy !== null} onClick={() => void copyToNewProject(selected)}>
                <CopyPlus size={13} /> Copier en nouveau projet
              </Button>
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => setNaming(selected.label ?? `Version du ${longDate(selected.createdAt)}`)}
              >
                <Bookmark size={13} /> {selected.kind === "manual" ? "Renommer" : "Garder"}
              </Button>
              <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => void remove(selected)}>
                <Trash2 size={13} />
              </Button>
            </div>
            {naming !== null ? (
              <form
                className="mt-2 flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void keep(selected, naming);
                }}
              >
                <input
                  // biome-ignore lint/a11y/noAutofocus: champ ouvert à la demande
                  autoFocus
                  aria-label="Nom de la version"
                  className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-canvas px-2 text-xs outline-none"
                  value={naming}
                  onChange={(e) => setNaming(e.currentTarget.value)}
                />
                <Button type="submit" size="sm" variant="primary">
                  OK
                </Button>
              </form>
            ) : null}
            {confirmRestore ? (
              <p className="mt-2 text-[11px] text-ink-muted">
                Le projet reviendra à cet état. L'état actuel est gardé dans l'historique (« Avant restauration ») : tu
                pourras revenir en arrière.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="px-4 pt-3 text-red-300 text-xs">{error}</p> : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <div className="mx-2 mb-1 flex items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-xs">
            <span className="size-2 rounded-full bg-accent" />
            Version actuelle (en cours d'édition)
          </div>
          {versions === null ? <LoaderCircle className="mx-auto mt-6 animate-spin text-ink-faint" /> : null}
          {versions?.length === 0 ? (
            <p className="px-3 py-6 text-center text-ink-faint text-xs">
              Pas encore d'ancienne version. Elles apparaissent au fil de l'édition, ou quand tu en enregistres une.
            </p>
          ) : null}
          {groups.map(([day, items]) => (
            <div key={day} className="mt-3">
              <p className="px-3 pb-1 font-semibold text-[11px] text-ink-faint uppercase tracking-wider">{day}</p>
              {items.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => void select(v)}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition",
                    selected?.id === v.id ? "bg-panel-hover ring-1 ring-accent" : "hover:bg-panel-hover",
                  )}
                >
                  <span className="w-10 shrink-0 pt-0.5 text-ink-muted text-xs tabular-nums">{time(v.createdAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {v.kind === "manual" ? <Bookmark size={11} className="shrink-0 text-accent" /> : null}
                      <span className="truncate text-sm">{v.label ?? KIND_LABEL[v.kind]}</span>
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {v.name} · {v.sceneCount} scène{v.sceneCount > 1 ? "s" : ""} ·{" "}
                      {formatDuration(framesToSeconds(v.durationInFrames, v.fps))}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <p className="border-line border-t px-4 py-2.5 text-[11px] text-ink-faint leading-snug">
          Une version auto est gardée au plus toutes les 10 min d'édition (les 50 dernières). Les versions nommées sont
          gardées pour toujours.
        </p>
      </aside>
    </>
  );
}
