import { ScenePreview } from "@app/composition";
import { framesToSeconds, type ProjectSummary } from "@app/schema";
import { Thumbnail } from "@remotion/player";
import { Copy, Film, LoaderCircle, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { MenuItem, Popover } from "../../components/Popover";
import { api } from "../../lib/api";
import { formatDuration, formatRelative } from "../../lib/format";
import { navigate } from "../../lib/router";
import { HomeLayout } from "./HomeLayout";
import { createNewProject, duplicateProject, FORMAT_LABELS, type FormatKey, renameProject } from "./projectActions";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await api.listProjects());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <HomeLayout actions={<NewProjectButton />}>
      <h1 className="mb-6 font-semibold text-2xl">Mes projets</h1>
      {error ? <p className="text-red-300 text-sm">{error}</p> : null}
      {projects === null && !error ? <LoaderCircle className="animate-spin text-ink-faint" /> : null}
      {projects?.length === 0 ? <EmptyState /> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        {projects?.map((p) => (
          <ProjectCard key={p.id} project={p} onChange={refresh} />
        ))}
      </div>
    </HomeLayout>
  );
}

function EmptyState() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line border-dashed py-16 text-center">
      <Film size={32} className="text-ink-faint" />
      <p className="text-ink-muted">Aucun projet pour l'instant.</p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          void navigate(`/p/${await createNewProject("landscape", "demo")}`);
        }}
        className="flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm text-white hover:bg-accent-hover"
      >
        <Sparkles size={15} /> Commencer avec la démo
      </button>
    </div>
  );
}

function NewProjectButton() {
  const [format, setFormat] = useState<FormatKey>("landscape");
  const [busy, setBusy] = useState(false);

  const create = async (start: "blank" | "demo") => {
    setBusy(true);
    try {
      void navigate(`/p/${await createNewProject(format, start)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 font-medium text-sm text-white hover:bg-accent-hover"
        >
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} Nouveau projet
        </button>
      )}
      className="w-64 p-2"
    >
      {() => (
        <div className="space-y-3 p-1">
          <div>
            <p className="mb-1.5 text-[11px] text-ink-faint uppercase tracking-wider">Format</p>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(FORMAT_LABELS) as FormatKey[]).map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-md border px-1 py-2 text-[11px] transition ${
                    f === format ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-muted hover:text-ink"
                  }`}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1">
            <MenuItem onClick={() => void create("blank")}>
              <Plus size={14} /> Projet vide
            </MenuItem>
            <MenuItem onClick={() => void create("demo")}>
              <Sparkles size={14} /> À partir de la démo
            </MenuItem>
          </div>
        </div>
      )}
    </Popover>
  );
}

function ProjectCard({ project, onChange }: { project: ProjectSummary; onChange: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const open = () => void navigate(`/p/${project.id}`);

  const submitRename = async (e: FormEvent) => {
    e.preventDefault();
    setRenaming(false);
    if (name.trim() && name !== project.name) {
      await renameProject(project.id, name.trim());
      onChange();
    }
  };

  // Vignette : la 1re scène, dans un cadre 16:9 (les formats portrait sont centrés).
  const boxW = 320;
  const boxH = 180;
  const k = Math.min(boxW / project.width, boxH / project.height);

  return (
    <div className="group">
      <button
        type="button"
        onClick={open}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-black ring-1 ring-line transition group-hover:ring-2 group-hover:ring-accent"
      >
        {project.previewScene ? (
          <Thumbnail
            component={ScenePreview}
            inputProps={{ scene: project.previewScene, showPlaceholders: true }}
            compositionWidth={project.width}
            compositionHeight={project.height}
            durationInFrames={project.previewScene.durationInFrames}
            fps={project.fps}
            frameToDisplay={Math.min(project.previewScene.durationInFrames - 1, Math.round(project.fps * 1.5))}
            style={{ width: Math.round(project.width * k), height: Math.round(project.height * k), maxWidth: "100%" }}
          />
        ) : null}
        <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white tabular-nums">
          {formatDuration(framesToSeconds(project.durationInFrames, project.fps))}
        </span>
      </button>
      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form onSubmit={submitRename}>
              <input
                // biome-ignore lint/a11y/noAutofocus: champ de renommage ouvert à la demande
                autoFocus
                className="h-7 w-full rounded border border-accent bg-canvas px-2 text-sm outline-none"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                onBlur={submitRename}
              />
            </form>
          ) : (
            <button type="button" onClick={open} className="block w-full truncate text-left font-medium text-sm">
              {project.name}
            </button>
          )}
          <p className="text-[11px] text-ink-faint">
            {project.sceneCount} scène{project.sceneCount > 1 ? "s" : ""} · modifié {formatRelative(project.updatedAt)}
          </p>
        </div>
        <Popover
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label="Actions"
              className="rounded p-1 text-ink-faint hover:bg-panel-hover hover:text-ink"
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  close();
                  setRenaming(true);
                }}
              >
                <Pencil size={14} /> Renommer
              </MenuItem>
              <MenuItem
                onClick={async () => {
                  close();
                  await duplicateProject(project.id);
                  onChange();
                }}
              >
                <Copy size={14} /> Dupliquer
              </MenuItem>
              <MenuItem
                danger
                onClick={async () => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  close();
                  await api.deleteProject(project.id);
                  onChange();
                }}
              >
                <Trash2 size={14} /> {confirmDelete ? "Confirmer la suppression" : "Supprimer"}
              </MenuItem>
            </>
          )}
        </Popover>
      </div>
    </div>
  );
}
