import { isBoxShape } from "@app/composition";
import { type ImageLayer, type MaskShape, SHAPES } from "@app/schema";
import clsx from "clsx";
import { Crop, FlipHorizontal2, FlipVertical2 } from "lucide-react";
import { ShapeIcon } from "../../../components/ShapeIcon";
import { Button, ColorInput, Field, Section, Segmented, Select, Slider, TextInput } from "../../../components/ui";
import { useEditor } from "../../../store/editorStore";
import { DropShadowSection } from "./DropShadowSection";
import { FilterSection } from "./FilterSection";
import type { SectionProps } from "./types";

export const SHAPE_LABELS: Record<MaskShape, string> = {
  none: "Aucune",
  rect: "Rectangle",
  rounded: "Arrondi",
  circle: "Rond",
  heart: "Cœur",
  star: "Étoile",
  hexagon: "Hexagone",
  diamond: "Losange",
  arch: "Arche",
  bubble: "Bulle",
  cloud: "Nuage",
  stamp: "Timbre",
};

export function ImageSection({ layer, update }: SectionProps<ImageLayer>) {
  const setCropLayer = useEditor((s) => s.setCropLayer);
  const polaroid = layer.frame === "polaroid";
  const f = layer.filter;
  const ds = layer.dropShadow;
  const boxShape = polaroid || isBoxShape(layer.mask.shape);

  return (
    <>
      <Section title="Photo">
        {layer.src ? (
          <div className="flex items-center gap-2">
            <img src={layer.src} alt="" className="size-12 rounded object-cover ring-1 ring-line" />
            <div className="flex flex-col gap-1">
              <Button size="sm" onClick={() => setCropLayer(layer.id)}>
                <Crop size={13} /> Recadrer
              </Button>
              <Button size="sm" variant="danger" onClick={() => update((l) => void (l.src = null))}>
                Vider le cadre
              </Button>
            </div>
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
        <Field label="Miroir">
          <div className="flex gap-1.5">
            {(
              [
                ["flipX", "Horizontal", FlipHorizontal2],
                ["flipY", "Vertical", FlipVertical2],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                type="button"
                key={key}
                onClick={() => update((l) => void (l[key] = !l[key]))}
                className={clsx(
                  "flex h-7 flex-1 items-center justify-center gap-1 rounded-md border text-xs",
                  layer[key] ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-faint hover:text-ink",
                )}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </Field>
        {layer.src ? (
          <p className="text-[11px] text-ink-faint">Astuce : double-clic sur la photo pour la cadrer à la souris.</p>
        ) : null}
      </Section>

      <Section title="Cadre">
        <Field label="Style">
          <Segmented
            value={layer.frame}
            onChange={(v) => update((l) => void (l.frame = v))}
            options={[
              { value: "none", label: "Forme", title: "Photo découpée selon une forme" },
              { value: "polaroid", label: "Polaroid", title: "Carte blanche, plus large en bas" },
            ]}
          />
        </Field>
        {polaroid ? (
          <Field label="Légende">
            <TextInput value={layer.caption} onChange={(v) => update((l) => void (l.caption = v))} />
          </Field>
        ) : (
          <>
            <div className="grid grid-cols-6 gap-1">
              {(["none", ...SHAPES] as MaskShape[]).map((shape) => (
                <button
                  type="button"
                  key={shape}
                  title={SHAPE_LABELS[shape]}
                  onClick={() =>
                    update((l) => {
                      if (l.type !== "image") return;
                      l.mask.shape = shape;
                      if (l.border.style === "double" && !isBoxShape(shape)) l.border.style = "solid";
                    })
                  }
                  className={clsx(
                    "flex aspect-square items-center justify-center rounded-md border transition",
                    layer.mask.shape === shape
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line text-ink-faint hover:text-ink",
                  )}
                >
                  <ShapeIcon shape={shape} size={18} />
                </button>
              ))}
            </div>
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
          </>
        )}
      </Section>

      <Section title="Bordure">
        <Field label="Épaisseur">
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
          <>
            <Field label="Couleur">
              <ColorInput value={layer.border.color} onChange={(v) => update((l) => void (l.border.color = v))} />
            </Field>
            <Field label="Trait">
              <Segmented
                value={layer.border.style}
                onChange={(v) => update((l) => void (l.border.style = v))}
                options={[
                  { value: "solid", label: "Plein", title: "Trait plein" },
                  { value: "dashed", label: "Tirets", title: "Tirets" },
                  { value: "dotted", label: "Points", title: "Pointillés" },
                  ...(boxShape ? [{ value: "double" as const, label: "Double", title: "Double trait" }] : []),
                ]}
              />
            </Field>
          </>
        ) : null}
      </Section>

      <DropShadowSection value={ds} onChange={(fn) => update((l) => void fn(l.dropShadow))} />

      <FilterSection value={f} src={layer.src} onChange={(fn) => update((l) => void fn(l.filter))} />

      <Section title="Cadrage">
        <Field label="Zoom">
          <Slider
            value={layer.crop.zoom}
            min={1}
            max={5}
            step={0.01}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => update((l) => void (l.crop.zoom = v))}
          />
        </Field>
        <Field label="Zoom lent">
          <Slider
            value={layer.animation.kenBurns}
            min={0}
            max={0.3}
            format={(v) => (v === 0 ? "non" : `${Math.round(v * 100)}%`)}
            onChange={(v) => update((l) => void (l.animation.kenBurns = v))}
          />
        </Field>
        {layer.animation.kenBurns > 0 ? (
          <Field label="Sens">
            <Select
              value={layer.animation.kenBurnsMode}
              onChange={(v) => update((l) => void (l.animation.kenBurnsMode = v))}
              options={[
                { value: "in", label: "Zoom avant" },
                { value: "out", label: "Zoom arrière" },
                { value: "pan-left", label: "Glisse vers la gauche" },
                { value: "pan-right", label: "Glisse vers la droite" },
                { value: "pan-up", label: "Glisse vers le haut" },
                { value: "pan-down", label: "Glisse vers le bas" },
              ]}
            />
          </Field>
        ) : null}
      </Section>
    </>
  );
}
