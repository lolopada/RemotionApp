import { TRANSITION_LABELS } from "@app/composition";
import { type Background, framesToSeconds, type Scene, secondsToFrames, type TransitionKind } from "@app/schema";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Eye, EyeOff, Image, Lock, Shapes, Type } from "lucide-react";
import { ColorInput, Field, IconButton, NumberInput, Section, Select, Slider, TextInput } from "../../components/ui";
import { useEditor, useProject } from "../../store/editorStore";

const LAYER_ICONS = { image: Image, text: Type, shape: Shapes } as const;

export function SceneInspector({ scene }: { scene: Scene }) {
  const project = useProject();
  const { updateScene, selectLayer, moveLayer, updateLayer } = useEditor.getState();
  const isFirst = project.scenes[0]?.id === scene.id;
  const update = (fn: (s: Scene) => void) => updateScene(scene.id, fn);
  const bg = scene.background;

  const setBgType = (type: Background["type"]) =>
    update((s) => {
      if (type === s.background.type) return;
      if (type === "color") s.background = { type: "color", color: "#111827" };
      if (type === "gradient") s.background = { type: "gradient", from: "#1e1b4b", to: "#7c3aed", angle: 135 };
      if (type === "image") s.background = { type: "image", src: "", blur: 0 };
    });

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

      <Section title="Fond">
        <Field label="Type">
          <Select
            value={bg.type}
            onChange={setBgType}
            options={[
              { value: "color", label: "Couleur" },
              { value: "gradient", label: "Dégradé" },
              { value: "image", label: "Photo" },
            ]}
          />
        </Field>
        {bg.type === "color" ? (
          <Field label="Couleur">
            <ColorInput
              value={bg.color}
              onChange={(v) => update((s) => void (s.background.type === "color" && (s.background.color = v)))}
            />
          </Field>
        ) : null}
        {bg.type === "gradient" ? (
          <>
            <Field label="Début">
              <ColorInput
                value={bg.from}
                onChange={(v) => update((s) => void (s.background.type === "gradient" && (s.background.from = v)))}
              />
            </Field>
            <Field label="Fin">
              <ColorInput
                value={bg.to}
                onChange={(v) => update((s) => void (s.background.type === "gradient" && (s.background.to = v)))}
              />
            </Field>
            <Field label="Angle">
              <Slider
                value={bg.angle}
                min={0}
                max={360}
                step={1}
                format={(v) => `${v}°`}
                onChange={(v) => update((s) => void (s.background.type === "gradient" && (s.background.angle = v)))}
              />
            </Field>
          </>
        ) : null}
        {bg.type === "image" ? (
          <>
            <p className="text-[11px] text-ink-faint">
              {bg.src ? "Photo choisie." : "Onglet Photos → « En fond » sur une photo."}
            </p>
            <Field label="Flou">
              <Slider
                value={bg.blur}
                min={0}
                max={60}
                step={1}
                format={(v) => `${v}px`}
                onChange={(v) => update((s) => void (s.background.type === "image" && (s.background.blur = v)))}
              />
            </Field>
          </>
        ) : null}
      </Section>

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
          </>
        )}
      </Section>

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
