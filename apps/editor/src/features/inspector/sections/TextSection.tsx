import { FONT_FAMILIES } from "@app/composition";
import type { TextLayer } from "@app/schema";
import { ColorInput, Field, NumberInput, Section, Select, Slider, TextArea, Toggle } from "../../../components/ui";
import type { SectionProps } from "./types";

export function TextSection({ layer, update }: SectionProps<TextLayer>) {
  return (
    <Section title="Texte">
      <TextArea value={layer.text} onChange={(v) => update((l) => void (l.text = v))} />
      <Field label="Police">
        <Select
          value={layer.fontFamily}
          options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))}
          onChange={(v) => update((l) => void (l.fontFamily = v))}
        />
      </Field>
      <Field label="Taille">
        <NumberInput
          value={layer.fontSize}
          min={4}
          suffix="px"
          onChange={(v) => update((l) => void (l.fontSize = Math.max(4, v)))}
        />
      </Field>
      <Field label="Graisse">
        <Select
          value={String(layer.fontWeight)}
          options={[
            { value: "400", label: "Normal" },
            { value: "700", label: "Gras" },
            { value: "900", label: "Très gras" },
          ]}
          onChange={(v) => update((l) => void (l.fontWeight = Number(v)))}
        />
      </Field>
      <Field label="Couleur">
        <ColorInput value={layer.color} onChange={(v) => update((l) => void (l.color = v))} />
      </Field>
      <Field label="Alignement">
        <Select
          value={layer.align}
          options={[
            { value: "left", label: "Gauche" },
            { value: "center", label: "Centré" },
            { value: "right", label: "Droite" },
          ]}
          onChange={(v) => update((l) => void (l.align = v))}
        />
      </Field>
      <Field label="Espacement">
        <Slider
          value={layer.letterSpacing}
          min={-5}
          max={30}
          step={0.5}
          format={(v) => `${v}`}
          onChange={(v) => update((l) => void (l.letterSpacing = v))}
        />
      </Field>
      <Field label="Ombre">
        <Toggle checked={layer.shadow} onChange={(v) => update((l) => void (l.shadow = v))} />
      </Field>
      <Field label="Contour">
        <Slider
          value={layer.strokeWidth}
          min={0}
          max={20}
          step={1}
          format={(v) => `${v}px`}
          onChange={(v) => update((l) => void (l.strokeWidth = v))}
        />
      </Field>
      {layer.strokeWidth > 0 ? (
        <Field label="Couleur contour">
          <ColorInput value={layer.strokeColor} onChange={(v) => update((l) => void (l.strokeColor = v))} />
        </Field>
      ) : null}
    </Section>
  );
}
