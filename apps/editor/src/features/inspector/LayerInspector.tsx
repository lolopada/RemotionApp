import type { EnterAnimation, ExitAnimation, Layer, LayerType } from "@app/schema";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Lock, LockOpen, Trash2 } from "lucide-react";
import type { ComponentType } from "react";
import { Field, IconButton, NumberInput, Section, Select, Slider, TextInput } from "../../components/ui";
import { useEditor } from "../../store/editorStore";
import { ImageSection } from "./sections/ImageSection";
import { ShapeSection } from "./sections/ShapeSection";
import { TextSection } from "./sections/TextSection";
import type { SectionProps } from "./sections/types";

/** Réglages spécifiques à chaque type de calque (même principe que la composition). */
const TYPE_SECTIONS: { [K in LayerType]: ComponentType<SectionProps<Extract<Layer, { type: K }>>> } = {
  image: ImageSection,
  text: TextSection,
  shape: ShapeSection,
};

const ENTER: { value: EnterAnimation; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "fade", label: "Fondu" },
  { value: "zoom", label: "Zoom" },
  { value: "slide-up", label: "Monte" },
  { value: "slide-left", label: "Glisse" },
  { value: "pop", label: "Pop (rebond)" },
];
const EXIT: { value: ExitAnimation; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "fade", label: "Fondu" },
  { value: "zoom", label: "Zoom arrière" },
  { value: "slide-down", label: "Descend" },
];

export function LayerInspector({ layer }: { layer: Layer }) {
  const { updateLayer, removeLayer, duplicateLayer, moveLayer, selectLayer } = useEditor.getState();
  const update = (fn: (l: Layer) => void) => updateLayer(layer.id, fn);
  const t = layer.transform;
  const TypeSection = TYPE_SECTIONS[layer.type] as ComponentType<SectionProps<Layer>>;

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
      </Section>

      <Section title="Animation">
        <Field label="Entrée">
          <Select
            value={layer.animation.enter}
            options={ENTER}
            onChange={(v) => update((l) => void (l.animation.enter = v))}
          />
        </Field>
        <Field label="Délai">
          <NumberInput
            value={layer.animation.enterDelayInFrames}
            min={0}
            suffix="img"
            onChange={(v) => update((l) => void (l.animation.enterDelayInFrames = Math.max(0, Math.round(v))))}
          />
        </Field>
        <Field label="Durée entrée">
          <NumberInput
            value={layer.animation.enterDurationInFrames}
            min={1}
            suffix="img"
            onChange={(v) => update((l) => void (l.animation.enterDurationInFrames = Math.max(1, Math.round(v))))}
          />
        </Field>
        <Field label="Sortie">
          <Select
            value={layer.animation.exit}
            options={EXIT}
            onChange={(v) => update((l) => void (l.animation.exit = v))}
          />
        </Field>
      </Section>
    </div>
  );
}
