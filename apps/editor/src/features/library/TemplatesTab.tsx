import { ScenePreview } from "@app/composition";
import { Thumbnail } from "@remotion/player";
import { useMemo } from "react";
import { useEditor, useProject } from "../../store/editorStore";
import { SCENE_TEMPLATES } from "../../templates/sceneTemplates";
import { TabHeader } from "./LibraryPanel";

export function TemplatesTab() {
  const project = useProject();
  const addScene = useEditor((s) => s.addScene);
  const format = { width: project.width, height: project.height, fps: project.fps };
  // Aperçus construits une fois par format.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dépend seulement du format
  const previews = useMemo(
    () => SCENE_TEMPLATES.map((t) => ({ template: t, scene: t.build(format) })),
    [project.width, project.height, project.fps],
  );
  const thumbWidth = 126;

  return (
    <div>
      <TabHeader title="Modèles de scènes" hint="Clique pour insérer la scène après la scène sélectionnée." />
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {previews.map(({ template, scene }) => (
          <button
            type="button"
            key={template.id}
            onClick={() => addScene(template.build(format))}
            className="group text-left"
          >
            <div className="overflow-hidden rounded-md ring-1 ring-line transition group-hover:ring-2 group-hover:ring-accent">
              <Thumbnail
                component={ScenePreview}
                inputProps={{ scene, showPlaceholders: true }}
                compositionWidth={project.width}
                compositionHeight={project.height}
                durationInFrames={scene.durationInFrames}
                fps={project.fps}
                frameToDisplay={scene.durationInFrames - 1}
                style={{ width: thumbWidth, height: Math.round((thumbWidth * project.height) / project.width) }}
              />
            </div>
            <span className="mt-1 block text-[11px] text-ink-muted">{template.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
