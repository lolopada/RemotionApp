import { DECOR_SHAPES, type DecorShape, type ShapeLayer } from "@app/schema";
import clsx from "clsx";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { ShapeIcon } from "../../../components/ShapeIcon";
import { Button, ColorInput, Field, IconButton, Section, Segmented, Slider, Toggle } from "../../../components/ui";
import { DropShadowSection } from "./DropShadowSection";
import { SHAPE_LABELS } from "./ImageSection";
import type { SectionProps } from "./types";

export const DECOR_LABELS: Record<DecorShape, string> = {
  rect: SHAPE_LABELS.rect,
  rounded: SHAPE_LABELS.rounded,
  circle: SHAPE_LABELS.circle,
  heart: SHAPE_LABELS.heart,
  star: SHAPE_LABELS.star,
  hexagon: SHAPE_LABELS.hexagon,
  diamond: SHAPE_LABELS.diamond,
  arch: SHAPE_LABELS.arch,
  bubble: "Bulle de BD",
  cloud: SHAPE_LABELS.cloud,
  stamp: SHAPE_LABELS.stamp,
  triangle: "Triangle",
  arrow: "Flèche",
  burst: "Explosion",
  line: "Ligne",
};

export function ShapeSection({ layer, update }: SectionProps<ShapeLayer>) {
  const edit = (fn: (l: ShapeLayer) => void) =>
    update((l) => {
      if (l.type === "shape") fn(l);
    });
  const isLine = layer.shape === "line";
  const stroked = isLine || layer.stroke.enabled;

  return (
    <>
      <Section title="Forme">
        <div className="grid grid-cols-5 gap-1.5">
          {DECOR_SHAPES.map((shape) => (
            <button
              type="button"
              key={shape}
              title={DECOR_LABELS[shape]}
              onClick={() =>
                edit((l) => {
                  l.shape = shape;
                  // Une ligne n'a pas de surface : elle est toujours tracée.
                  if (shape === "line") l.stroke.enabled = true;
                })
              }
              className={clsx(
                "flex aspect-square items-center justify-center rounded-md border transition",
                layer.shape === shape
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-ink-faint hover:text-ink",
              )}
            >
              <ShapeIcon shape={shape} size={18} />
            </button>
          ))}
        </div>
        {layer.shape === "rounded" ? (
          <Field label="Arrondi">
            <Slider
              value={layer.radius}
              min={0}
              max={300}
              step={1}
              format={(v) => `${v}px`}
              onChange={(v) => edit((l) => void (l.radius = v))}
            />
          </Field>
        ) : null}
      </Section>

      {isLine ? null : (
        <Section title="Remplissage">
          <Segmented
            value={layer.fillMode}
            onChange={(v) => edit((l) => void (l.fillMode = v))}
            options={[
              { value: "solid", label: "Uni", title: "Une couleur" },
              { value: "gradient", label: "Dégradé", title: "Dégradé de 2 à 4 couleurs" },
              { value: "none", label: "Vide", title: "Pas de remplissage (contour seul)" },
            ]}
          />
          {layer.fillMode === "solid" ? (
            <Field label="Couleur">
              <ColorInput value={layer.fill} onChange={(v) => edit((l) => void (l.fill = v))} />
            </Field>
          ) : null}
          {layer.fillMode === "gradient" ? (
            <>
              <div
                className="h-3 rounded-full ring-1 ring-line"
                style={{ backgroundImage: `linear-gradient(90deg, ${layer.gradient.colors.join(", ")})` }}
              />
              {layer.gradient.colors.map((color, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: les couleurs n'ont pas d'identité propre
                <div key={i} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <ColorInput value={color} onChange={(v) => edit((l) => void (l.gradient.colors[i] = v))} />
                  </div>
                  <IconButton
                    label="Retirer cette couleur"
                    className="size-6"
                    disabled={layer.gradient.colors.length <= 2}
                    onClick={() => edit((l) => void l.gradient.colors.splice(i, 1))}
                  >
                    <X size={12} />
                  </IconButton>
                </div>
              ))}
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="flex-1 border border-line"
                  disabled={layer.gradient.colors.length >= 4}
                  onClick={() => edit((l) => void l.gradient.colors.push(l.gradient.colors.at(-1) ?? "#ffffff"))}
                >
                  <Plus size={12} /> Couleur
                </Button>
                <Button
                  size="sm"
                  className="border border-line"
                  onClick={() => edit((l) => void l.gradient.colors.reverse())}
                >
                  <ArrowLeftRight size={12} /> Inverser
                </Button>
              </div>
              <Field label="Angle">
                <Slider
                  value={layer.gradient.angle}
                  min={0}
                  max={360}
                  step={1}
                  format={(v) => `${v}°`}
                  onChange={(v) => edit((l) => void (l.gradient.angle = v))}
                />
              </Field>
            </>
          ) : null}
        </Section>
      )}

      <Section
        title={isLine ? "Trait" : "Contour"}
        actions={
          isLine ? undefined : (
            <Toggle checked={layer.stroke.enabled} onChange={(v) => edit((l) => void (l.stroke.enabled = v))} />
          )
        }
      >
        {stroked ? (
          <>
            <Field label="Couleur">
              <ColorInput value={layer.stroke.color} onChange={(v) => edit((l) => void (l.stroke.color = v))} />
            </Field>
            <Field label="Épaisseur">
              <Slider
                value={layer.stroke.width}
                min={1}
                max={80}
                step={1}
                format={(v) => `${v}px`}
                onChange={(v) => edit((l) => void (l.stroke.width = v))}
              />
            </Field>
            <Field label="Style">
              <Segmented
                value={layer.stroke.style}
                onChange={(v) => edit((l) => void (l.stroke.style = v))}
                options={[
                  { value: "solid", label: "Plein", title: "Trait plein" },
                  { value: "dashed", label: "Tirets", title: "Tirets" },
                  { value: "dotted", label: "Points", title: "Points" },
                ]}
              />
            </Field>
          </>
        ) : null}
      </Section>

      <DropShadowSection value={layer.dropShadow} onChange={(fn) => edit((l) => void fn(l.dropShadow))} />
    </>
  );
}
