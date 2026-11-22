import { ScenePreview } from "@app/composition";
import { adaptScene, applyThemeToScene, duplicateScene, type Scene, type SceneTemplate } from "@app/schema";
import { Thumbnail } from "@remotion/player";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useEditor, useProjectFormat, useProjectTheme } from "../../store/editorStore";
import { SCENE_TEMPLATES } from "../../templates/sceneTemplates";
import { TabHeader } from "./LibraryPanel";
import { useMyTemplates } from "./useMyTemplates";

function SceneThumb({ scene }: { scene: Scene }) {
  const project = { ...useProjectFormat(), theme: useProjectTheme() };
  // Tient dans une colonne (≈ 100 px) sans devenir trop haute pour les formats verticaux.
  const width = Math.round(Math.min(100, (125 * project.width) / project.height));
  return (
    <Thumbnail
      component={ScenePreview}
      inputProps={{ scene, showPlaceholders: true }}
      compositionWidth={project.width}
      compositionHeight={project.height}
      durationInFrames={scene.durationInFrames}
      fps={project.fps}
      frameToDisplay={scene.durationInFrames - 1}
      style={{ width, height: Math.round((width * project.height) / project.width) }}
    />
  );
}

/** Copie d'un modèle enregistré, adaptée au format et à la cadence du projet ouvert. */
function sceneFromTemplate(t: SceneTemplate, to: { width: number; height: number; fps: number }): Scene {
  const scene = duplicateScene(t.scene);
  adaptScene(scene, { width: t.width, height: t.height, fps: t.fps }, to);
  return scene;
}

function MyTemplates() {
  const project = { ...useProjectFormat(), theme: useProjectTheme() };
  const addScene = useEditor((s) => s.addScene);
  const { items, error, load, remove, rename } = useMyTemplates();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const format = { width: project.width, height: project.height, fps: project.fps };

  // Relu à chaque ouverture de l'onglet (la liste suit le compte connecté).
  useEffect(() => {
    void load();
  }, [load]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: dépend seulement du format et des modèles
  const previews = useMemo(
    () => items.map((t) => ({ template: t, scene: sceneFromTemplate(t, format) })),
    [items, project.width, project.height, project.fps],
  );

  return (
    <>
      <TabHeader
        title="Mes modèles"
        hint={
          items.length === 0
            ? "Sélectionne une scène, puis « Enregistrer comme modèle » dans le panneau de droite. Tes modèles restent dans ton compte."
            : "Tes scènes enregistrées, adaptées au format de ce projet. Double-clic sur le nom pour le changer."
        }
      />
      {error ? <p className="px-3 pb-2 text-[11px] text-red-300">{error}</p> : null}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          {previews.map(({ template, scene }) => (
            <div key={template.id} className="group relative">
              <button
                type="button"
                onClick={() => addScene(sceneFromTemplate(template, format))}
                className="block overflow-hidden rounded-md ring-1 ring-line transition hover:ring-2 hover:ring-accent"
                title={`Insérer « ${template.name} »`}
              >
                <SceneThumb scene={scene} />
              </button>
              <button
                type="button"
                aria-label={confirm === template.id ? "Confirmer la suppression" : "Supprimer le modèle"}
                title={confirm === template.id ? "Cliquer encore pour supprimer" : "Supprimer le modèle"}
                onClick={() => {
                  if (confirm !== template.id) return setConfirm(template.id);
                  setConfirm(null);
                  void remove(template.id);
                }}
                onMouseLeave={() => setConfirm(null)}
                className={`absolute top-1 right-1 flex size-6 items-center justify-center rounded bg-black/60 text-white ${
                  confirm === template.id ? "flex bg-red-600" : "hidden group-hover:flex"
                }`}
              >
                {confirm === template.id ? <Check size={12} /> : <Trash2 size={12} />}
              </button>
              {editing?.id === template.id ? (
                <input
                  // biome-ignore lint/a11y/noAutofocus: champ ouvert par un double-clic
                  autoFocus
                  aria-label="Nom du modèle"
                  className="mt-1 w-full rounded bg-canvas px-1 text-[11px] outline-none ring-1 ring-accent"
                  value={editing.name}
                  onChange={(e) => setEditing({ id: template.id, name: e.currentTarget.value })}
                  onBlur={() => {
                    if (editing.name.trim() && editing.name !== template.name)
                      void rename(template.id, editing.name.trim());
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => setEditing({ id: template.id, name: template.name })}
                  className="mt-1 block w-full truncate text-left text-[11px] text-ink-muted"
                >
                  {template.name}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function TemplatesTab() {
  const project = { ...useProjectFormat(), theme: useProjectTheme() };
  const addScene = useEditor((s) => s.addScene);
  const format = { width: project.width, height: project.height, fps: project.fps };
  const theme = project.theme;
  /** Les modèles prêts à l'emploi prennent le thème du projet. */
  const build = (t: (typeof SCENE_TEMPLATES)[number]) => {
    const scene = t.build(format);
    if (theme) applyThemeToScene(scene, theme);
    return scene;
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: dépend seulement du format et du thème
  const previews = useMemo(
    () => SCENE_TEMPLATES.map((t) => ({ template: t, scene: build(t) })),
    [project.width, project.height, project.fps, theme],
  );

  return (
    <div>
      <MyTemplates />
      <TabHeader title="Modèles de scènes" hint="Clique pour insérer la scène après la scène sélectionnée." />
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {previews.map(({ template, scene }) => (
          <button type="button" key={template.id} onClick={() => addScene(build(template))} className="group text-left">
            <div className="overflow-hidden rounded-md ring-1 ring-line transition group-hover:ring-2 group-hover:ring-accent">
              <SceneThumb scene={scene} />
            </div>
            <span className="mt-1 block text-[11px] text-ink-muted">{template.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
