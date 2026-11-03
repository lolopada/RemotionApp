import type { ImageLayer, MaskShape } from "@app/schema";
import { Button, ColorInput, Field, Section, Select, Slider } from "../../../components/ui";
import type { SectionProps } from "./types";

const MASKS: { value: MaskShape; label: string }[] = [
  { value: "none", label: "Aucun" },
  { value: "rect", label: "Rectangle" },
  { value: "rounded", label: "Arrondi" },
  { value: "circle", label: "Rond / ovale" },
  { value: "heart", label: "Cœur" },
];

export function ImageSection({ layer, update }: SectionProps<ImageLayer>) {
  return (
    <>
      <Section title="Photo">
        {layer.src ? (
          <div className="flex items-center gap-2">
            <img src={layer.src} alt="" className="size-12 rounded object-cover ring-1 ring-line" />
            <Button size="sm" variant="danger" onClick={() => update((l) => void (l.src = null))}>
              Vider le cadre
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-ink-faint">
            Cadre vide : glisse une photo dessus, ou clique une photo de la bibliothèque.
          </p>
        )}
        <Field label="Ajustement">
          <Select
            value={layer.fit}
            options={[
              { value: "cover", label: "Remplir (photo)" },
              { value: "contain", label: "Entière (sticker)" },
            ]}
            onChange={(v) => update((l) => void (l.fit = v))}
          />
        </Field>
      </Section>

      <Section title="Forme et contour">
        <Field label="Masque">
          <Select value={layer.mask.shape} options={MASKS} onChange={(v) => update((l) => void (l.mask.shape = v))} />
        </Field>
        {layer.mask.shape !== "none" ? (
          <Field label="Bord flou">
            <Slider
              value={layer.mask.feather}
              min={0}
              max={200}
              step={1}
              format={(v) => `${v}px`}
              onChange={(v) => update((l) => void (l.mask.feather = v))}
            />
          </Field>
        ) : null}
        {layer.mask.shape === "rounded" ? (
          <Field label="Arrondi">
            <Slider
              value={layer.mask.radius}
              min={0}
              max={300}
              step={1}
              format={(v) => `${v}px`}
              onChange={(v) => update((l) => void (l.mask.radius = v))}
            />
          </Field>
        ) : null}
        <Field label="Bordure">
          <Slider
            value={layer.border.width}
            min={0}
            max={40}
            step={1}
            format={(v) => `${v}px`}
            onChange={(v) => update((l) => void (l.border.width = v))}
          />
        </Field>
        {layer.border.width > 0 ? (
          <Field label="Couleur">
            <ColorInput value={layer.border.color} onChange={(v) => update((l) => void (l.border.color = v))} />
          </Field>
        ) : null}
      </Section>

      <Section title="Recadrage">
        <Field label="Zoom">
          <Slider
            value={layer.crop.zoom}
            min={1}
            max={4}
            step={0.01}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => update((l) => void (l.crop.zoom = v))}
          />
        </Field>
        <Field label="Décalage X">
          <Slider
            value={layer.crop.offsetX}
            min={-0.5}
            max={0.5}
            onChange={(v) => update((l) => void (l.crop.offsetX = v))}
          />
        </Field>
        <Field label="Décalage Y">
          <Slider
            value={layer.crop.offsetY}
            min={-0.5}
            max={0.5}
            onChange={(v) => update((l) => void (l.crop.offsetY = v))}
          />
        </Field>
        <Field label="Zoom lent">
          <Slider
            value={layer.animation.kenBurns}
            min={0}
            max={0.3}
            format={(v) => (v === 0 ? "non" : `+${Math.round(v * 100)}%`)}
            onChange={(v) => update((l) => void (l.animation.kenBurns = v))}
          />
        </Field>
      </Section>
    </>
  );
}
