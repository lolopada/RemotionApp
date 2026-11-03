import type { ShapeLayer } from "@app/schema";
import { ColorInput, Field, Section, Select, Slider } from "../../../components/ui";
import type { SectionProps } from "./types";

export function ShapeSection({ layer, update }: SectionProps<ShapeLayer>) {
  return (
    <Section title="Forme">
      <Field label="Forme">
        <Select
          value={layer.shape}
          options={[
            { value: "rect", label: "Rectangle" },
            { value: "rounded", label: "Arrondi" },
            { value: "circle", label: "Rond" },
            { value: "heart", label: "Cœur" },
          ]}
          onChange={(v) => update((l) => void (l.shape = v))}
        />
      </Field>
      <Field label="Couleur">
        <ColorInput value={layer.fill} onChange={(v) => update((l) => void (l.fill = v))} />
      </Field>
      {layer.shape === "rounded" ? (
        <Field label="Arrondi">
          <Slider
            value={layer.radius}
            min={0}
            max={300}
            step={1}
            format={(v) => `${v}px`}
            onChange={(v) => update((l) => void (l.radius = v))}
          />
        </Field>
      ) : null}
    </Section>
  );
}
