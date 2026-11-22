import { framesToSeconds, type MaskShape, SHAPES, secondsToFrames, type VideoLayer } from "@app/schema";
import clsx from "clsx";
import { FlipHorizontal2, FlipVertical2, Timer, Volume2, VolumeX } from "lucide-react";
import { ShapeIcon } from "../../../components/ShapeIcon";
import { Button, Field, NumberInput, Section, Select, Slider, Toggle } from "../../../components/ui";
import { WaveformPicker } from "../../../components/WaveformPicker";
import { useEditor, useProjectFormat } from "../../../store/editorStore";
import { DropShadowSection } from "./DropShadowSection";
import { FilterSection } from "./FilterSection";
import { SHAPE_LABELS } from "./ImageSection";
import type { SectionProps } from "./types";

const RATES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map((v) => ({ value: String(v), label: `${v}×` }));

export function VideoSection({ layer, update }: SectionProps<VideoLayer>) {
  const project = useProjectFormat();
  const sceneId = useEditor((s) => s.selectedSceneId);
  const fps = project.fps;
  const total = layer.sourceDurationSeconds;
  const trimSeconds = framesToSeconds(layer.trimStartFrames, fps);
  const start = layer.animation.enterDelayInFrames;

  /** Durée de lecture restante (en frames du projet), de `trimStart` à la fin du fichier. */
  const remainingFrames =
    total === null ? null : Math.max(1, secondsToFrames((total - trimSeconds) / layer.playbackRate, fps));

  const fitScene = () => {
    if (remainingFrames === null) return;
    useEditor.getState().updateScene(sceneId, (s) => {
      s.durationInFrames = Math.max(1, start + remainingFrames);
    });
  };

  return (
    <>
      <Section title="Vidéo">
        <video
          src={`${layer.src}#t=0.1`}
          muted
          preload="metadata"
          className="aspect-video w-full rounded-md bg-black object-contain ring-1 ring-line"
        />
        <p className="text-[11px] text-ink-faint">
          {total !== null ? `Durée du fichier : ${total.toFixed(1).replace(".", ",")} s. ` : ""}
          La lecture démarre quand le calque apparaît dans la scène.
        </p>
        <Field label="Ajustement">
          <Select
            value={layer.fit}
            options={[
              { value: "cover", label: "Remplir (rogne les bords)" },
              { value: "contain", label: "Entière (bandes possibles)" },
            ]}
            onChange={(v) => update((l) => void (l.fit = v))}
          />
        </Field>
        <Field label="Zoom">
          <Slider
            value={layer.zoom}
            min={1}
            max={3}
            step={0.01}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => update((l) => void (l.zoom = v))}
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
      </Section>

      <Section title="Lecture">
        <WaveformPicker
          src={layer.src}
          start={trimSeconds}
          onPick={(seconds, fileDuration) =>
            update(
              (l) => void (l.trimStartFrames = Math.round(Math.min(seconds, Math.max(0, fileDuration - 0.1)) * fps)),
            )
          }
        />
        <Field label="Commence à">
          <NumberInput
            value={Math.round(trimSeconds * 10) / 10}
            step={0.1}
            min={0}
            max={total !== null ? Math.max(0, total - 0.1) : undefined}
            suffix="s"
            onChange={(v) => update((l) => void (l.trimStartFrames = Math.max(0, Math.round(v * fps))))}
          />
        </Field>
        <Field label="Vitesse">
          <Select
            value={String(layer.playbackRate)}
            options={RATES}
            onChange={(v) => update((l) => void (l.playbackRate = Number(v)))}
          />
        </Field>
        <Field label="Son">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={layer.muted ? "Remettre le son" : "Couper le son"}
              onClick={() => update((l) => void (l.muted = !l.muted))}
              className={clsx(
                "flex size-7 shrink-0 items-center justify-center rounded-md border",
                layer.muted ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-faint hover:text-ink",
              )}
            >
              {layer.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <Slider
              value={layer.muted ? 0 : layer.volume}
              onChange={(v) =>
                update((l) => {
                  l.volume = v;
                  l.muted = v === 0;
                })
              }
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
        </Field>
        <Field label="En boucle">
          <div className="flex items-center gap-2">
            <Toggle checked={layer.loop} onChange={(v) => update((l) => void (l.loop = v))} />
            <span className="text-[11px] text-ink-faint">
              {layer.loop ? "Recommence si le calque dure plus longtemps" : "S'arrête sur la dernière image"}
            </span>
          </div>
        </Field>
        {remainingFrames !== null ? (
          <Button size="sm" className="w-full" onClick={fitScene}>
            <Timer size={13} /> Caler la scène sur la vidéo ({(remainingFrames / fps).toFixed(1).replace(".", ",")} s)
          </Button>
        ) : null}
      </Section>

      <Section title="Forme">
        <div className="grid grid-cols-6 gap-1">
          {(["none", ...SHAPES] as MaskShape[]).map((shape) => (
            <button
              type="button"
              key={shape}
              title={SHAPE_LABELS[shape]}
              onClick={() => update((l) => void (l.mask.shape = shape))}
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
      </Section>

      <DropShadowSection value={layer.dropShadow} onChange={(fn) => update((l) => void fn(l.dropShadow))} />

      <FilterSection value={layer.filter} src={layer.src} video onChange={(fn) => update((l) => void fn(l.filter))} />
    </>
  );
}
