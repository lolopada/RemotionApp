import {
  BACKGROUND_PATTERNS,
  type Background,
  type BackgroundPattern,
  createBackground,
  type Scene,
} from "@app/schema";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { Button, ColorInput, Field, IconButton, Section, Select, Slider, Toggle } from "../../components/ui";

type Gradient = Extract<Background, { type: "gradient" }>;
type Pattern = Extract<Background, { type: "pattern" }>;
type ImageBg = Extract<Background, { type: "image" }>;

export const PATTERN_LABELS: Record<BackgroundPattern, string> = {
  dots: "Pois",
  stripes: "Rayures",
  checks: "Damier",
  grid: "Quadrillage",
};

const VEIL_MODES: { value: ImageBg["veil"]["mode"]; label: string }[] = [
  { value: "solid", label: "Plein" },
  { value: "bottom", label: "Dégradé depuis le bas" },
  { value: "top", label: "Dégradé depuis le haut" },
  { value: "vignette", label: "Vignette (bords)" },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Fond de la scène : couleur, dégradé (2 à 6 couleurs, linéaire ou circulaire), motif ou photo. */
export function BackgroundEditor({ scene, update }: { scene: Scene; update: (fn: (s: Scene) => void) => void }) {
  const bg = scene.background;

  const setType = (type: Background["type"]) =>
    update((s) => {
      if (type === s.background.type) return;
      const prev = s.background;
      const grain = prev.grain;
      const first =
        prev.type === "color" ? prev.color : prev.type === "gradient" ? (prev.colors[0] ?? "#1e1b4b") : null;
      if (type === "color") s.background = createBackground({ type, color: first ?? "#111827", grain });
      if (type === "gradient")
        s.background = createBackground({ type, colors: [first ?? "#1e1b4b", "#7c3aed"], angle: 135, grain });
      if (type === "pattern")
        s.background = createBackground({ type, pattern: "dots", base: first ?? "#1e1b4b", ink: "#4338ca", grain });
      if (type === "image")
        s.background = createBackground({ type, src: prev.type === "image" ? prev.src : "", blur: 0, grain });
    });

  const gradient = (fn: (g: Gradient) => void) =>
    update((s) => {
      if (s.background.type === "gradient") fn(s.background);
    });
  const pattern = (fn: (p: Pattern) => void) =>
    update((s) => {
      if (s.background.type === "pattern") fn(s.background);
    });
  const image = (fn: (i: ImageBg) => void) =>
    update((s) => {
      if (s.background.type === "image") fn(s.background);
    });

  return (
    <Section title="Fond">
      <Field label="Type">
        <Select
          value={bg.type}
          onChange={setType}
          options={[
            { value: "color", label: "Couleur" },
            { value: "gradient", label: "Dégradé" },
            { value: "pattern", label: "Motif" },
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
          <Field label="Forme">
            <Select
              value={bg.kind}
              onChange={(v) => gradient((g) => void (g.kind = v))}
              options={[
                { value: "linear", label: "Linéaire" },
                { value: "radial", label: "Circulaire" },
              ]}
            />
          </Field>
          <div
            className="h-3 rounded-full ring-1 ring-line"
            style={{ backgroundImage: `linear-gradient(90deg, ${bg.colors.join(", ")})` }}
          />
          <div className="space-y-1.5">
            {bg.colors.map((color, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: les couleurs n'ont pas d'identité propre
              <div key={i} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <ColorInput value={color} onChange={(v) => gradient((g) => void (g.colors[i] = v))} />
                </div>
                <IconButton
                  label="Retirer cette couleur"
                  className="size-6"
                  disabled={bg.colors.length <= 2}
                  onClick={() => gradient((g) => void g.colors.splice(i, 1))}
                >
                  <X size={12} />
                </IconButton>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="flex-1 border border-line"
              disabled={bg.colors.length >= 6}
              onClick={() =>
                gradient((g) => {
                  g.colors.push(g.colors[g.colors.length - 1] ?? "#ffffff");
                })
              }
            >
              <Plus size={12} /> Ajouter une couleur
            </Button>
            <Button size="sm" className="border border-line" onClick={() => gradient((g) => void g.colors.reverse())}>
              <ArrowLeftRight size={12} /> Inverser
            </Button>
          </div>
          {bg.kind === "linear" ? (
            <Field label="Angle">
              <Slider
                value={bg.angle}
                min={0}
                max={360}
                step={1}
                format={(v) => `${v}°`}
                onChange={(v) => gradient((g) => void (g.angle = v))}
              />
            </Field>
          ) : (
            <>
              <Field label="Centre X">
                <Slider value={bg.centerX} format={pct} onChange={(v) => gradient((g) => void (g.centerX = v))} />
              </Field>
              <Field label="Centre Y">
                <Slider value={bg.centerY} format={pct} onChange={(v) => gradient((g) => void (g.centerY = v))} />
              </Field>
              <Field label="Taille">
                <Slider
                  value={bg.radius}
                  min={0.2}
                  max={3}
                  step={0.05}
                  format={pct}
                  onChange={(v) => gradient((g) => void (g.radius = v))}
                />
              </Field>
            </>
          )}
        </>
      ) : null}

      {bg.type === "pattern" ? (
        <>
          <Field label="Motif">
            <Select<BackgroundPattern>
              value={bg.pattern}
              onChange={(v) => pattern((p) => void (p.pattern = v))}
              options={BACKGROUND_PATTERNS.map((value) => ({ value, label: PATTERN_LABELS[value] }))}
            />
          </Field>
          <Field label="Fond">
            <ColorInput value={bg.base} onChange={(v) => pattern((p) => void (p.base = v))} />
          </Field>
          <Field label="Motif (couleur)">
            <ColorInput value={bg.ink} onChange={(v) => pattern((p) => void (p.ink = v))} />
          </Field>
          <Field label="Taille">
            <Slider
              value={bg.size}
              min={8}
              max={400}
              step={1}
              format={(v) => `${v}px`}
              onChange={(v) => pattern((p) => void (p.size = v))}
            />
          </Field>
          {bg.pattern !== "checks" ? (
            <Field label="Épaisseur">
              <Slider
                value={bg.thickness}
                min={0.1}
                max={0.9}
                step={0.01}
                format={pct}
                onChange={(v) => pattern((p) => void (p.thickness = v))}
              />
            </Field>
          ) : null}
          <Field label="Rotation">
            <Slider
              value={bg.angle}
              min={-180}
              max={180}
              step={1}
              format={(v) => `${v}°`}
              onChange={(v) => pattern((p) => void (p.angle = v))}
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
              onChange={(v) => image((i) => void (i.blur = v))}
            />
          </Field>
          <Field label="Voile coloré">
            <Toggle checked={bg.veil.enabled} onChange={(v) => image((i) => void (i.veil.enabled = v))} />
          </Field>
          {bg.veil.enabled ? (
            <>
              <Field label="Couleur">
                <ColorInput value={bg.veil.color} onChange={(v) => image((i) => void (i.veil.color = v))} />
              </Field>
              <Field label="Opacité">
                <Slider
                  value={bg.veil.opacity}
                  format={pct}
                  onChange={(v) => image((i) => void (i.veil.opacity = v))}
                />
              </Field>
              <Field label="Style">
                <Select
                  value={bg.veil.mode}
                  options={VEIL_MODES}
                  onChange={(v) => image((i) => void (i.veil.mode = v))}
                />
              </Field>
            </>
          ) : null}
        </>
      ) : null}

      {bg.type !== "color" ? (
        <>
          <Field label={bg.type === "image" ? "Zoom lent" : "Animé"}>
            <Toggle
              checked={bg.motion.enabled}
              onChange={(v) => update((s) => void (s.background.type !== "color" && (s.background.motion.enabled = v)))}
            />
          </Field>
          {bg.motion.enabled ? (
            <Field label="Vitesse">
              <Slider
                value={bg.motion.speed}
                min={0.1}
                max={4}
                step={0.1}
                format={(v) => `${v.toFixed(1)}×`}
                onChange={(v) => update((s) => void (s.background.type !== "color" && (s.background.motion.speed = v)))}
              />
            </Field>
          ) : null}
        </>
      ) : null}

      <Field label="Grain">
        <Slider value={bg.grain} format={pct} onChange={(v) => update((s) => void (s.background.grain = v))} />
      </Field>
    </Section>
  );
}
