import { TRANSITION_LABELS } from "@app/composition";
import { framesToSeconds, type Scene, secondsToFrames, type TransitionKind } from "@app/schema";
import clsx from "clsx";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Eye,
  EyeOff,
  Image,
  Lock,
  Shapes,
  Type,
} from "lucide-react";
import { useState } from "react";
import { Button, Field, IconButton, NumberInput, Section, Select, TextInput } from "../../components/ui";
import { useEditor, useProject } from "../../store/editorStore";
import { useMyTemplates } from "../library/useMyTemplates";
import { BackgroundEditor } from "./BackgroundEditor";

const LAYER_ICONS = { image: Image, text: Type, shape: Shapes, video: Clapperboard } as const;

export function SceneInspector({ scene }: { scene: Scene }) {
  const project = useProject();
  const { updateScene, selectLayer, moveLayer, updateLayer, applyTransitionToAll } = useEditor.getState();
  const isFirst = project.scenes[0]?.id === scene.id;
  const update = (fn: (s: Scene) => void) => updateScene(scene.id, fn);

  return (
    <div>
      <Section title="Scène">
        <Field label="Nom">
          <TextInput value={scene.name} onChange={(v) => update((s) => void (s.name = v))} />
        </Field>
        <Field label="Durée">
          <NumberInput
            value={framesToSeconds(scene.durationInFrames, project.fps)}
            step={0.5}
            min={0.5}
            suffix="s"
            onChange={(v) => update((s) => void (s.durationInFrames = secondsToFrames(v, project.fps)))}
          />
        </Field>
      </Section>

      <BackgroundEditor scene={scene} update={update} />

      <Section title="Transition d'entrée">
        {isFirst ? (
          <p className="text-[11px] text-ink-faint">La première scène n'a pas de transition d'entrée.</p>
        ) : (
          <>
            <Field label="Effet">
              <Select<TransitionKind>
                value={scene.transitionIn.kind}
                onChange={(v) => update((s) => void (s.transitionIn.kind = v))}
                options={Object.entries(TRANSITION_LABELS).map(([value, label]) => ({
                  value: value as TransitionKind,
                  label,
                }))}
              />
            </Field>
            <Field label="Durée">
              <NumberInput
                value={framesToSeconds(scene.transitionIn.durationInFrames, project.fps)}
                step={0.1}
                min={0.1}
                suffix="s"
                onChange={(v) =>
                  update((s) => void (s.transitionIn.durationInFrames = secondsToFrames(v, project.fps)))
                }
              />
            </Field>
            {project.scenes.length > 2 ? (
              <button
                type="button"
                onClick={() => applyTransitionToAll(scene.id)}
                className="w-full rounded-md border border-line px-2 py-1.5 text-xs text-ink-muted transition hover:border-accent hover:text-ink"
              >
                Appliquer à toutes les scènes
              </button>
            ) : null}
          </>
        )}
      </Section>

      <SaveAsTemplate scene={scene} />

      <Section title={`Calques (${scene.layers.length})`}>
        {scene.layers.length === 0 ? (
          <p className="text-[11px] text-ink-faint">Ajoute des éléments depuis la bibliothèque.</p>
        ) : null}
        <ul className="-mx-1 space-y-0.5">
          {[...scene.layers].reverse().map((layer, i) => {
            const Icon = LAYER_ICONS[layer.type];
            return (
              <li
                key={layer.id}
                className={clsx(
                  "group flex items-center gap-1 rounded-md px-1 hover:bg-panel-hover",
                  layer.hidden && "opacity-50",
                )}
              >
                <button
                  type="button"
                  onClick={() => selectLayer(layer.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs"
                >
                  <Icon size={13} className="shrink-0 text-ink-faint" />
                  <span className="truncate">{layer.name || layer.type}</span>
                  {layer.locked ? <Lock size={11} className="shrink-0 text-ink-faint" /> : null}
                </button>
                <IconButton
                  label={layer.hidden ? "Afficher" : "Masquer"}
                  className="size-6"
                  onClick={() => updateLayer(layer.id, (l) => void (l.hidden = !l.hidden))}
                >
                  {layer.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </IconButton>
                <IconButton
                  label="Vers l'avant"
                  className="size-6"
                  disabled={i === 0}
                  onClick={() => moveLayer(layer.id, 1)}
                >
                  <ChevronUp size={13} />
                </IconButton>
                <IconButton
                  label="Vers l'arrière"
                  className="size-6"
                  disabled={i === scene.layers.length - 1}
                  onClick={() => moveLayer(layer.id, -1)}
                >
                  <ChevronDown size={13} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

/** Enregistre la scène dans « Mes modèles » (compte), pour la réutiliser dans n'importe quel projet. */
function SaveAsTemplate({ scene }: { scene: Scene }) {
  const project = useProject();
  const save = useMyTemplates((s) => s.save);
  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "saving" | "saved" | "error"; message?: string } | null>(null);

  const submit = async () => {
    if (!name?.trim()) return;
    setStatus({ kind: "saving" });
    try {
      await save(name.trim(), structuredClone(scene), {
        width: project.width,
        height: project.height,
        fps: project.fps,
      });
      setName(null);
      setStatus({ kind: "saved" });
      setTimeout(() => setStatus((s) => (s?.kind === "saved" ? null : s)), 3000);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Enregistrement impossible" });
    }
  };

  return (
    <Section title="Mes modèles">
      {name === null ? (
        <>
          <button
            type="button"
            onClick={() => {
              setName(scene.name || "Ma scène");
              setStatus(null);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-ink-muted text-xs transition hover:border-accent hover:text-ink"
          >
            <BookmarkPlus size={13} /> Enregistrer comme modèle
          </button>
          {status?.kind === "saved" ? (
            <p className="flex items-center gap-1 text-[11px] text-emerald-300">
              <Check size={12} /> Ajouté à « Mes modèles » (onglet Modèles).
            </p>
          ) : null}
        </>
      ) : (
        <>
          <Field label="Nom">
            <TextInput value={name} onChange={setName} />
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              className="flex-1"
              disabled={!name.trim() || status?.kind === "saving"}
              onClick={() => void submit()}
            >
              Enregistrer
            </Button>
            <Button size="sm" onClick={() => setName(null)}>
              Annuler
            </Button>
          </div>
          {status?.kind === "error" ? <p className="text-[11px] text-red-300">{status.message}</p> : null}
        </>
      )}
    </Section>
  );
}
