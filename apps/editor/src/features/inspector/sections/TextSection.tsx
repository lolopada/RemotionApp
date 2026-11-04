import { getFontInfo, nearestWeight } from "@app/composition";
import { framesToSeconds, secondsToFrames, type TextAnimationKind, type TextLayer } from "@app/schema";
import clsx from "clsx";
import { AlignCenter, AlignLeft, AlignRight, Italic } from "lucide-react";
import { FontPicker } from "../../../components/FontPicker";
import {
  ColorInput,
  Field,
  NumberInput,
  Section,
  Segmented,
  Select,
  Slider,
  TextArea,
  Toggle,
} from "../../../components/ui";
import { useProject } from "../../../store/editorStore";
import type { SectionProps } from "./types";

const WEIGHT_LABELS: Record<number, string> = {
  100: "Fin",
  200: "Très léger",
  300: "Léger",
  400: "Normal",
  500: "Medium",
  600: "Semi-gras",
  700: "Gras",
  800: "Extra-gras",
  900: "Noir",
};

const TEXT_ANIMATIONS: { value: TextAnimationKind; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "typewriter", label: "Machine à écrire" },
  { value: "letters", label: "Lettre par lettre" },
  { value: "words", label: "Mot par mot" },
  { value: "highlight", label: "Surlignage" },
];

export function TextSection({ layer, update }: SectionProps<TextLayer>) {
  const project = useProject();
  const info = getFontInfo(layer.fontFamily);
  const weights = info?.weights ?? [400, 700];
  const italic = layer.fontStyle === "italic";
  const anim = layer.textAnimation;

  return (
    <>
      <Section title="Texte">
        <TextArea value={layer.text} onChange={(v) => update((l) => void (l.text = v))} />
        <Field label="Police">
          <FontPicker
            value={layer.fontFamily}
            onChange={(family) =>
              update((l) => {
                l.fontFamily = family;
                l.fontWeight = nearestWeight(family, l.fontWeight);
              })
            }
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
          <div className="flex gap-1.5">
            <div className="min-w-0 flex-1">
              <Select
                value={String(nearestWeight(layer.fontFamily, layer.fontWeight))}
                options={weights.map((w) => ({ value: String(w), label: WEIGHT_LABELS[w] ?? String(w) }))}
                onChange={(v) => update((l) => void (l.fontWeight = Number(v)))}
              />
            </div>
            <button
              type="button"
              title="Italique"
              onClick={() => update((l) => void (l.fontStyle = italic ? "normal" : "italic"))}
              className={clsx(
                "flex size-7 shrink-0 items-center justify-center rounded-md border",
                italic ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-faint hover:text-ink",
              )}
            >
              <Italic size={13} />
            </button>
          </div>
        </Field>
        <Field label="Casse">
          <Segmented
            value={layer.textTransform}
            onChange={(v) => update((l) => void (l.textTransform = v))}
            options={[
              { value: "none", label: "Aa", title: "Telle quelle" },
              { value: "uppercase", label: "AA", title: "MAJUSCULES" },
              { value: "lowercase", label: "aa", title: "minuscules" },
              { value: "capitalize", label: "Aa Bb", title: "Première Lettre En Majuscule" },
            ]}
          />
        </Field>
        <Field label="Alignement">
          <Segmented
            value={layer.align}
            onChange={(v) => update((l) => void (l.align = v))}
            options={[
              { value: "left", label: <AlignLeft size={13} />, title: "Gauche" },
              { value: "center", label: <AlignCenter size={13} />, title: "Centré" },
              { value: "right", label: <AlignRight size={13} />, title: "Droite" },
            ]}
          />
        </Field>
        <Field label="Interligne">
          <Slider
            value={layer.lineHeight}
            min={0.7}
            max={2.5}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => update((l) => void (l.lineHeight = v))}
          />
        </Field>
        <Field label="Espacement">
          <Slider
            value={layer.letterSpacing}
            min={-5}
            max={40}
            step={0.5}
            format={(v) => `${v}`}
            onChange={(v) => update((l) => void (l.letterSpacing = v))}
          />
        </Field>
      </Section>

      <Section title="Couleur">
        <Field label="Remplissage">
          <Segmented
            value={layer.gradient.enabled ? "gradient" : "solid"}
            onChange={(v) => update((l) => void (l.gradient.enabled = v === "gradient"))}
            options={[
              { value: "solid", label: "Unie", title: "Couleur unie" },
              { value: "gradient", label: "Dégradé", title: "Dégradé de couleurs" },
            ]}
          />
        </Field>
        {layer.gradient.enabled ? (
          <>
            <Field label="Début">
              <ColorInput value={layer.gradient.from} onChange={(v) => update((l) => void (l.gradient.from = v))} />
            </Field>
            <Field label="Fin">
              <ColorInput value={layer.gradient.to} onChange={(v) => update((l) => void (l.gradient.to = v))} />
            </Field>
            <Field label="Angle">
              <Slider
                value={layer.gradient.angle}
                min={0}
                max={360}
                step={5}
                format={(v) => `${v}°`}
                onChange={(v) => update((l) => void (l.gradient.angle = v))}
              />
            </Field>
          </>
        ) : (
          <Field label="Couleur">
            <ColorInput value={layer.color} onChange={(v) => update((l) => void (l.color = v))} />
          </Field>
        )}
        <Field label="Contour">
          <Slider
            value={layer.strokeWidth}
            min={0}
            max={24}
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

      <Section
        title="Ombre / halo"
        actions={<Toggle checked={layer.shadow} onChange={(v) => update((l) => void (l.shadow = v))} />}
      >
        {layer.shadow ? (
          <>
            <Field label="Type">
              <Segmented
                value={layer.shadowX === 0 && layer.shadowY === 0 ? "glow" : "shadow"}
                onChange={(v) =>
                  update((l) => {
                    if (v === "glow") {
                      l.shadowX = 0;
                      l.shadowY = 0;
                    } else if (l.shadowX === 0 && l.shadowY === 0) {
                      l.shadowY = 6;
                    }
                  })
                }
                options={[
                  { value: "shadow", label: "Ombre", title: "Ombre portée décalée" },
                  { value: "glow", label: "Halo", title: "Halo lumineux autour du texte (néon)" },
                ]}
              />
            </Field>
            <Field label="Couleur">
              <ColorInput value={layer.shadowColor} onChange={(v) => update((l) => void (l.shadowColor = v))} />
            </Field>
            <Field label="Opacité">
              <Slider
                value={layer.shadowOpacity}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => update((l) => void (l.shadowOpacity = v))}
              />
            </Field>
            <Field label="Flou">
              <Slider
                value={layer.shadowBlur}
                min={0}
                max={80}
                step={1}
                format={(v) => `${v}px`}
                onChange={(v) => update((l) => void (l.shadowBlur = v))}
              />
            </Field>
            {layer.shadowX !== 0 || layer.shadowY !== 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <NumberInput value={layer.shadowX} suffix="X" onChange={(v) => update((l) => void (l.shadowX = v))} />
                <NumberInput value={layer.shadowY} suffix="Y" onChange={(v) => update((l) => void (l.shadowY = v))} />
              </div>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section
        title="Fond du texte"
        actions={<Toggle checked={layer.box.enabled} onChange={(v) => update((l) => void (l.box.enabled = v))} />}
      >
        {layer.box.enabled ? (
          <>
            <Field label="Forme">
              <Segmented
                value={layer.box.radius >= 200 ? "pill" : layer.box.radius === 0 ? "band" : "rounded"}
                onChange={(v) => update((l) => void (l.box.radius = v === "pill" ? 999 : v === "band" ? 0 : 12))}
                options={[
                  { value: "band", label: "Bandeau", title: "Coins droits" },
                  { value: "rounded", label: "Arrondi", title: "Coins arrondis" },
                  { value: "pill", label: "Pastille", title: "Bouts ronds" },
                ]}
              />
            </Field>
            <Field label="Couleur">
              <ColorInput value={layer.box.color} onChange={(v) => update((l) => void (l.box.color = v))} />
            </Field>
            <Field label="Opacité">
              <Slider
                value={layer.box.opacity}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => update((l) => void (l.box.opacity = v))}
              />
            </Field>
            {layer.box.radius > 0 && layer.box.radius < 200 ? (
              <Field label="Arrondi">
                <Slider
                  value={layer.box.radius}
                  min={1}
                  max={120}
                  step={1}
                  format={(v) => `${v}px`}
                  onChange={(v) => update((l) => void (l.box.radius = v))}
                />
              </Field>
            ) : null}
            <Field label="Marges">
              <div className="grid grid-cols-2 gap-2">
                <NumberInput
                  value={layer.box.paddingX}
                  min={0}
                  suffix="↔"
                  onChange={(v) => update((l) => void (l.box.paddingX = Math.max(0, v)))}
                />
                <NumberInput
                  value={layer.box.paddingY}
                  min={0}
                  suffix="↕"
                  onChange={(v) => update((l) => void (l.box.paddingY = Math.max(0, v)))}
                />
              </div>
            </Field>
            <Field label="Pleine largeur">
              <Toggle checked={layer.box.fullWidth} onChange={(v) => update((l) => void (l.box.fullWidth = v))} />
            </Field>
          </>
        ) : null}
      </Section>

      <Section title="Animation du texte">
        <Field label="Effet">
          <Select
            value={anim.kind}
            options={TEXT_ANIMATIONS}
            onChange={(v) => update((l) => void (l.textAnimation.kind = v))}
          />
        </Field>
        {anim.kind !== "none" ? (
          <>
            <Field label="Durée">
              <NumberInput
                value={framesToSeconds(anim.durationInFrames, project.fps)}
                step={0.1}
                min={0.1}
                suffix="s"
                onChange={(v) =>
                  update((l) => void (l.textAnimation.durationInFrames = secondsToFrames(v, project.fps)))
                }
              />
            </Field>
            {anim.kind === "highlight" ? (
              <Field label="Surligneur">
                <ColorInput
                  value={anim.highlightColor}
                  onChange={(v) => update((l) => void (l.textAnimation.highlightColor = v))}
                />
              </Field>
            ) : null}
            <p className="text-[11px] text-ink-faint">Démarre après le « Délai » de l'animation du calque.</p>
          </>
        ) : null}
      </Section>
    </>
  );
}
