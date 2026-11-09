import { ScenePreview, TRANSITION_LABELS } from "@app/composition";
import { framesToSeconds, getProjectDurationInFrames, type Project, type Scene } from "@app/schema";
import { Thumbnail } from "@remotion/player";
import clsx from "clsx";
import { ArrowRightLeft, Copy, Plus, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { IconButton } from "../../components/ui";
import { useEditor, useProject } from "../../store/editorStore";
import { useLayoutWizard } from "../layouts/wizardStore";
import { AudioStrip } from "./AudioStrip";
import { DurationBar } from "./DurationBar";

const THUMB_HEIGHT = 72;

/**
 * Storyboard : les scènes sous forme de vignettes, à la place d'une timeline.
 * Glisser une vignette pour réordonner. Le bouton entre deux vignettes
 * ouvre la transition de la scène suivante.
 */
export function Storyboard() {
  const project = useProject();
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const extraSceneIds = useEditor((s) => s.extraSceneIds);
  const { selectScene, duplicateScene, removeScene, moveScene, toggleSceneSelection, selectSceneRange } =
    useEditor.getState();
  const openWizard = useLayoutWizard((s) => s.open);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const thumbWidth = Math.round((THUMB_HEIGHT * project.width) / project.height);
  const total = getProjectDurationInFrames(project);

  const onDrop = (index: number) => {
    if (dragId) {
      const from = project.scenes.findIndex((s) => s.id === dragId);
      moveScene(dragId, from < index ? index - 1 : index);
    }
    setDragId(null);
    setDropIndex(null);
  };

  return (
    <div className="shrink-0 border-line border-t bg-panel">
      <div className="flex items-center justify-between px-4 pt-2 text-[11px] text-ink-faint">
        <span className="font-semibold uppercase tracking-wider">Storyboard</span>
        <span className="tabular-nums">
          {project.scenes.length} scènes · {framesToSeconds(total, project.fps).toFixed(1)} s
        </span>
      </div>

      <DurationBar />

      <div className="flex items-center gap-1 overflow-x-auto px-4 pt-2 pb-2">
        {project.scenes.map((scene, i) => (
          <div key={scene.id} className="flex shrink-0 items-center gap-1">
            {i > 0 ? (
              <TransitionChip
                scene={scene}
                highlighted={dropIndex === i}
                onClick={() => selectScene(scene.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropIndex(i);
                }}
                onDrop={() => onDrop(i)}
              />
            ) : null}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: vignette déplaçable (glisser-déposer natif) */}
            <div
              draggable
              onDragStart={(e) => {
                setDragId(scene.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropIndex(null);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setDropIndex(e.clientX < rect.left + rect.width / 2 ? i : i + 1);
              }}
              onDrop={() => dropIndex !== null && onDrop(dropIndex)}
              className={clsx("group relative", dragId === scene.id && "opacity-40")}
            >
              <button
                type="button"
                onClick={(e) => {
                  if (e.shiftKey) selectSceneRange(scene.id);
                  else if (e.ctrlKey || e.metaKey) toggleSceneSelection(scene.id);
                  else selectScene(scene.id);
                }}
                aria-pressed={scene.id === selectedSceneId || extraSceneIds.includes(scene.id)}
                className={clsx(
                  "block overflow-hidden rounded-md ring-2 transition",
                  scene.id === selectedSceneId
                    ? "ring-accent"
                    : extraSceneIds.includes(scene.id)
                      ? "ring-accent/60"
                      : "ring-transparent hover:ring-line",
                )}
              >
                <SceneThumb project={project} scene={scene} width={thumbWidth} />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between rounded-b-md bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-0.5 text-[10px] text-white">
                <span>{i + 1}</span>
                <span className="tabular-nums">
                  {framesToSeconds(scene.durationInFrames, project.fps).toFixed(1)} s
                </span>
              </div>
              <div className="absolute top-1 right-1 hidden gap-0.5 rounded bg-black/60 group-hover:flex">
                <IconButton label="Dupliquer" className="size-6" onClick={() => duplicateScene(scene.id)}>
                  <Copy size={12} />
                </IconButton>
                <IconButton
                  label="Supprimer"
                  className="size-6"
                  disabled={project.scenes.length <= 1}
                  onClick={() => removeScene(scene.id)}
                >
                  <Trash2 size={12} />
                </IconButton>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => openWizard({ mode: "new", afterId: project.scenes.at(-1)?.id })}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            setDropIndex(project.scenes.length);
          }}
          onDrop={() => onDrop(project.scenes.length)}
          className="ml-2 flex shrink-0 items-center justify-center rounded-md border border-line border-dashed text-ink-faint transition hover:border-accent hover:text-accent"
          style={{ width: thumbWidth, height: THUMB_HEIGHT }}
          title="Nouvelle page"
          aria-label="Nouvelle page"
        >
          <Plus size={18} />
        </button>
      </div>

      <AudioStrip />
    </div>
  );
}

function TransitionChip({
  scene,
  highlighted,
  onClick,
  onDragOver,
  onDrop,
}: {
  scene: Scene;
  highlighted: boolean;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const active = scene.transitionIn.kind !== "none";
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      title={`Transition : ${TRANSITION_LABELS[scene.transitionIn.kind]}`}
      className={clsx(
        "flex h-6 w-5 items-center justify-center rounded transition",
        highlighted
          ? "bg-accent text-white"
          : active
            ? "text-accent hover:bg-accent-soft"
            : "text-ink-faint hover:bg-panel-hover",
      )}
    >
      <ArrowRightLeft size={12} />
    </button>
  );
}

/** Vignette d'une scène, rendue par la même composition que l'aperçu. */
const SceneThumb = memo(function SceneThumb({
  project,
  scene,
  width,
}: {
  project: Project;
  scene: Scene;
  width: number;
}) {
  return (
    <Thumbnail
      component={ScenePreview}
      inputProps={{ scene, showPlaceholders: true }}
      compositionWidth={project.width}
      compositionHeight={project.height}
      durationInFrames={scene.durationInFrames}
      fps={project.fps}
      frameToDisplay={Math.min(scene.durationInFrames - 1, Math.round(project.fps * 1.5))}
      style={{ width, height: THUMB_HEIGHT }}
    />
  );
});
