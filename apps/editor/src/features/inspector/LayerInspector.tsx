import {
  type AnimationEasing,
  type BlendMode,
  type EnterAnimation,
  type ExitAnimation,
  framesToSeconds,
  type Layer,
  type LayerAnimation,
  type LayerType,
} from "@app/schema";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Lock, LockOpen, Trash2 } from "lucide-react";
import type { ComponentType } from "react";
import { Field, IconButton, NumberInput, Section, Select, Slider, TextInput, Toggle } from "../../components/ui";
import { useEditor, useProject } from "../../store/editorStore";
import { ImageSection } from "./sections/ImageSection";
import { ShapeSection } from "./sections/ShapeSection";
import { TextSection } from "./sections/TextSection";
import type { SectionProps } from "./sections/types";
import { VideoSection } from "./sections/VideoSection";

/** Réglages spécifiques à chaque type de calque (même principe que la composition). */
const TYPE_SECTIONS: { [K in LayerType]: ComponentType<SectionProps<Extract<Layer, { type: K }>>> } = {
  image: ImageSection,
  text: TextSection,
  shape: ShapeSection,
  video: VideoSection,
};

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normale" },
  { value: "multiply", label: "Produit" },
  { value: "screen", label: "Écran" },
  { value: "overlay", label: "Superposition" },
  { value: "soft-light", label: "Lumière douce" },
  { value: "hard-light", label: "Lumière crue" },
  { value: "darken", label: "Obscurcir" },
  { value: "lighten", label: "Éclaircir" },
  { value: "color-dodge", label: "Densité couleur −" },
  { value: "difference", label: "Différence" },
  { value: "luminosity", label: "Luminosité" },
];

const ENTER: { value: EnterAnimation; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "fade", label: "Fondu" },
  { value: "zoom", label: "Zoom" },
  { value: "pop", label: "Pop (rebond)" },
  { value: "bounce", label: "Chute et rebond" },
  { value: "spin", label: "Rotation" },
  { value: "flip", label: "Retournement" },
  { value: "flip-v", label: "Retournement vertical" },
  { value: "blur", label: "Flou vers net" },
  { value: "slide-up", label: "Glisse depuis le bas" },
  { value: "slide-down", label: "Glisse depuis le haut" },
  { value: "slide-left", label: "Glisse depuis la droite" },
  { value: "slide-right", label: "Glisse depuis la gauche" },
  { value: "wipe-right", label: "Volet vers la droite" },
  { value: "wipe-left", label: "Volet vers la gauche" },
  { value: "wipe-down", label: "Volet vers le bas" },
  { value: "wipe-up", label: "Volet vers le haut" },
];
const EXIT: { value: ExitAnimation; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "fade", label: "Fondu" },
  { value: "zoom", label: "Zoom arrière" },
  { value: "spin", label: "Rotation" },
  { value: "flip", label: "Retournement" },
  { value: "flip-v", label: "Retournement vertical" },
  { value: "blur", label: "Devient flou" },
  { value: "slide-down", label: "Part vers le bas" },
  { value: "slide-up", label: "Part vers le haut" },
  { value: "slide-left", label: "Part vers la gauche" },
  { value: "slide-right", label: "Part vers la droite" },
  { value: "wipe-right", label: "Volet vers la droite" },
  { value: "wipe-left", label: "Volet vers la gauche" },
  { value: "wipe-down", label: "Volet vers le bas" },
  { value: "wipe-up", label: "Volet vers le haut" },
];
const EASINGS: { value: AnimationEasing; label: string }[] = [
  { value: "smooth", label: "Douce (ralentit à l'arrivée)" },
  { value: "inout", label: "Progressive (départ et arrivée doux)" },
  { value: "linear", label: "Linéaire (vitesse constante)" },
  { value: "elastic", label: "Élastique (dépasse puis revient)" },
];
const LOOPS: { value: LayerAnimation["loop"]["kind"]; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "float", label: "Flottement" },
  { value: "pulse", label: "Pulsation" },
  { value: "sway", label: "Balancement" },
  { value: "spin", label: "Rotation lente" },
];

/** Durée en secondes (l'animation est stockée en images, selon la cadence du projet). */
function Seconds({
  frames,
  fps,
  min = 0,
  max,
  onChange,
}: {
  frames: number;
  fps: number;
  min?: number;
  max?: number;
  onChange: (frames: number) => void;
}) {
  return (
    <NumberInput
      value={framesToSeconds(frames, fps)}
      step={0.1}
      min={min}
      max={max}
      suffix="s"
      onChange={(v) => onChange(Math.max(0, Math.round(v * fps)))}
    />
  );
}

const sec = (frames: number, fps: number) => `${(Math.round((frames / fps) * 10) / 10).toString().replace(".", ",")} s`;

export function LayerInspector({ layer }: { layer: Layer }) {
  const { updateLayer, removeLayer, duplicateLayer, moveLayer, selectLayer } = useEditor.getState();
  const update = (fn: (l: Layer) => void) => updateLayer(layer.id, fn);
  const t = layer.transform;
  const TypeSection = TYPE_SECTIONS[layer.type] as ComponentType<SectionProps<Layer>>;
  const project = useProject();
  const sceneId = useEditor((s) => s.selectedSceneId);
  const sceneFrames = project.scenes.find((sc) => sc.id === sceneId)?.durationInFrames ?? 1;
  const fps = project.fps;
  const an = layer.animation;
  const anim = (fn: (a: LayerAnimation) => void) => update((l) => void fn(l.animation));
  const start = an.enterDelayInFrames;
  const end = an.endAtFrame ?? sceneFrames;

  return (
    <div>
      <div className="flex items-center gap-1 border-line border-b px-2 py-2">
        <IconButton label="Retour à la scène" onClick={() => selectLayer(null)}>
          <ArrowLeft size={15} />
        </IconButton>
        <span className="flex-1 truncate font-medium text-sm">{layer.name || layer.type}</span>
        <IconButton label="Vers l'avant" onClick={() => moveLayer(layer.id, 1)}>
          <ChevronUp size={15} />
        </IconButton>
        <IconButton label="Vers l'arrière" onClick={() => moveLayer(layer.id, -1)}>
          <ChevronDown size={15} />
        </IconButton>
        <IconButton
          label={layer.locked ? "Déverrouiller" : "Verrouiller"}
          onClick={() => update((l) => void (l.locked = !l.locked))}
        >
          {layer.locked ? <Lock size={14} /> : <LockOpen size={14} />}
        </IconButton>
        <IconButton label="Dupliquer" onClick={() => duplicateLayer(layer.id)}>
          <Copy size={14} />
        </IconButton>
        <IconButton label="Supprimer (Suppr)" className="hover:text-red-300" onClick={() => removeLayer(layer.id)}>
          <Trash2 size={14} />
        </IconButton>
      </div>

      <Section title="Calque">
        <Field label="Nom">
          <TextInput value={layer.name} onChange={(v) => update((l) => void (l.name = v))} />
        </Field>
      </Section>

      <TypeSection layer={layer} update={update} />

      <Section title="Position">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput value={t.x} suffix="X" onChange={(v) => update((l) => void (l.transform.x = v))} />
          <NumberInput value={t.y} suffix="Y" onChange={(v) => update((l) => void (l.transform.y = v))} />
          <NumberInput
            value={t.width}
            min={1}
            suffix="L"
            onChange={(v) => update((l) => void (l.transform.width = Math.max(1, v)))}
          />
          <NumberInput
            value={t.height}
            min={1}
            suffix="H"
            onChange={(v) => update((l) => void (l.transform.height = Math.max(1, v)))}
          />
        </div>
        <Field label="Rotation">
          <Slider
            value={t.rotation}
            min={-180}
            max={180}
            step={1}
            format={(v) => `${v}°`}
            onChange={(v) => update((l) => void (l.transform.rotation = v))}
          />
        </Field>
        <Field label="Opacité">
          <Slider
            value={t.opacity}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update((l) => void (l.transform.opacity = v))}
          />
        </Field>
        <Field label="Fusion">
          <Select
            value={layer.blendMode}
            options={BLEND_MODES}
            onChange={(v) => update((l) => void (l.blendMode = v))}
          />
        </Field>
      </Section>

      <Section title="Apparition">
        <Field label="Apparaît à">
          <Seconds
            frames={an.enterDelayInFrames}
            fps={fps}
            max={Math.max(0, framesToSeconds(sceneFrames - 1, fps))}
            onChange={(v) => anim((a) => void (a.enterDelayInFrames = Math.min(v, sceneFrames - 1)))}
          />
        </Field>
        <Field label="Disparaît à">
          <div className="flex items-center gap-2">
            <Toggle
              checked={an.endAtFrame !== null}
              onChange={(on) => anim((a) => void (a.endAtFrame = on ? Math.max(start + 1, sceneFrames) : null))}
            />
            {an.endAtFrame === null ? (
              <span className="text-[11px] text-ink-faint">Reste jusqu'à la fin de la scène</span>
            ) : (
              <Seconds
                frames={an.endAtFrame}
                fps={fps}
                min={0.1}
                max={framesToSeconds(sceneFrames, fps)}
                onChange={(v) => anim((a) => void (a.endAtFrame = Math.min(sceneFrames, Math.max(start + 1, v))))}
              />
            )}
          </div>
        </Field>
        <p className="text-[11px] text-ink-faint leading-snug">
          Visible de {sec(start, fps)} à {sec(end, fps)} (scène : {sec(sceneFrames, fps)}). Avance la lecture pour le
          voir apparaître.
        </p>
      </Section>

      <Section title="Entrée">
        <Field label="Effet">
          <Select value={an.enter} options={ENTER} onChange={(v) => anim((a) => void (a.enter = v))} />
        </Field>
        {an.enter !== "none" ? (
          <Field label="Durée">
            <Seconds
              frames={an.enterDurationInFrames}
              fps={fps}
              min={0.1}
              onChange={(v) => anim((a) => void (a.enterDurationInFrames = Math.max(1, v)))}
            />
          </Field>
        ) : null}
      </Section>

      <Section title="Sortie">
        <Field label="Effet">
          <Select value={an.exit} options={EXIT} onChange={(v) => anim((a) => void (a.exit = v))} />
        </Field>
        {an.exit !== "none" ? (
          <Field label="Durée">
            <Seconds
              frames={an.exitDurationInFrames}
              fps={fps}
              min={0.1}
              onChange={(v) => anim((a) => void (a.exitDurationInFrames = Math.max(1, v)))}
            />
          </Field>
        ) : null}
        {an.enter !== "none" || an.exit !== "none" ? (
          <Field label="Courbe">
            <Select value={an.easing} options={EASINGS} onChange={(v) => anim((a) => void (a.easing = v))} />
          </Field>
        ) : null}
        {an.enter === "pop" || an.enter === "bounce" ? (
          <p className="text-[11px] text-ink-faint">Le rebond à l'entrée a sa propre courbe.</p>
        ) : null}
      </Section>

      <Section title="En boucle">
        <Field label="Mouvement">
          <Select value={an.loop.kind} options={LOOPS} onChange={(v) => anim((a) => void (a.loop.kind = v))} />
        </Field>
        {an.loop.kind !== "none" ? (
          <>
            <Field label="Vitesse">
              <Slider
                value={an.loop.speed}
                min={0.1}
                max={4}
                step={0.1}
                format={(v) => `${v.toFixed(1)}×`}
                onChange={(v) => anim((a) => void (a.loop.speed = v))}
              />
            </Field>
            {an.loop.kind !== "spin" ? (
              <Field label="Intensité">
                <Slider
                  value={an.loop.amount}
                  min={0.1}
                  max={3}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}×`}
                  onChange={(v) => anim((a) => void (a.loop.amount = v))}
                />
              </Field>
            ) : null}
          </>
        ) : null}
      </Section>
    </div>
  );
}
