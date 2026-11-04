import type { ImageLayer } from "@app/schema";
import { ColorInput, Field, NumberInput, Section, Slider, Toggle } from "../../../components/ui";

type DropShadow = ImageLayer["dropShadow"];

/** Ombre portée qui suit la forme du calque (photos et formes). */
export function DropShadowSection({
  value,
  onChange,
}: {
  value: DropShadow;
  onChange: (fn: (ds: DropShadow) => void) => void;
}) {
  return (
    <Section
      title="Ombre portée"
      actions={<Toggle checked={value.enabled} onChange={(v) => onChange((ds) => void (ds.enabled = v))} />}
    >
      {value.enabled ? (
        <>
          <Field label="Couleur">
            <ColorInput value={value.color} onChange={(v) => onChange((ds) => void (ds.color = v))} />
          </Field>
          <Field label="Opacité">
            <Slider
              value={value.opacity}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onChange((ds) => void (ds.opacity = v))}
            />
          </Field>
          <Field label="Flou">
            <Slider
              value={value.blur}
              min={0}
              max={150}
              step={1}
              format={(v) => `${v}px`}
              onChange={(v) => onChange((ds) => void (ds.blur = v))}
            />
          </Field>
          <Field label="Décalage">
            <div className="grid grid-cols-2 gap-2">
              <NumberInput value={value.x} suffix="X" onChange={(v) => onChange((ds) => void (ds.x = v))} />
              <NumberInput value={value.y} suffix="Y" onChange={(v) => onChange((ds) => void (ds.y = v))} />
            </div>
          </Field>
        </>
      ) : null}
    </Section>
  );
}
