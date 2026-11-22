import { FILTER_PRESETS, type FilterPreset, photoFilterCss } from "@app/composition";
import type { ImageLayer } from "@app/schema";
import clsx from "clsx";
import { TileImg } from "../../../components/TileImg";
import { Field, Section, Slider } from "../../../components/ui";

type Filter = ImageLayer["filter"];

const percent = (v: number) => `${Math.round(v * 100)}%`;

/** Filtres de couleur (préréglages, luminosité, contraste, saturation, flou) d'une photo ou d'une vidéo. */
export function FilterSection({
  value: f,
  src,
  video = false,
  onChange,
}: {
  value: Filter;
  src: string | null;
  /** Les vignettes montrent alors la première image de la vidéo. */
  video?: boolean;
  /** Modifie le filtre (brouillon immer : on peut muter directement). */
  onChange: (fn: (filter: Filter) => void) => void;
}) {
  const modified = f.preset !== "none" || f.brightness !== 1 || f.contrast !== 1 || f.saturation !== 1 || f.blur > 0;
  return (
    <Section
      title="Filtres"
      actions={
        modified ? (
          <button
            type="button"
            className="text-[11px] text-ink-faint hover:text-ink"
            onClick={() =>
              onChange((v) => {
                v.preset = "none";
                v.brightness = 1;
                v.contrast = 1;
                v.saturation = 1;
                v.blur = 0;
              })
            }
          >
            Réinitialiser
          </button>
        ) : null
      }
    >
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(FILTER_PRESETS) as FilterPreset[]).map((preset) => (
          <button
            type="button"
            key={preset}
            onClick={() => onChange((v) => void (v.preset = preset))}
            className="group text-center"
          >
            <div
              className={clsx(
                "aspect-square overflow-hidden rounded-md ring-1 transition",
                f.preset === preset ? "ring-2 ring-accent" : "ring-line group-hover:ring-ink-faint",
              )}
            >
              {src && video ? (
                <video
                  src={`${src}#t=0.1`}
                  muted
                  preload="metadata"
                  className="size-full object-cover"
                  style={{ filter: photoFilterCss({ ...f, preset }) }}
                />
              ) : src ? (
                <TileImg src={src} alt="" style={{ filter: photoFilterCss({ ...f, preset }) }} />
              ) : (
                <div
                  className="size-full bg-gradient-to-br from-orange-300 via-pink-400 to-indigo-500"
                  style={{ filter: photoFilterCss({ ...f, preset }) }}
                />
              )}
            </div>
            <span className="mt-0.5 block truncate text-[10px] text-ink-muted">{FILTER_PRESETS[preset].label}</span>
          </button>
        ))}
      </div>
      {(
        [
          ["brightness", "Luminosité"],
          ["contrast", "Contraste"],
          ["saturation", "Saturation"],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <Slider
            value={f[key]}
            min={0}
            max={2}
            step={0.01}
            format={percent}
            onChange={(v) => onChange((x) => void (x[key] = v))}
          />
        </Field>
      ))}
      <Field label="Flou">
        <Slider
          value={f.blur}
          min={0}
          max={30}
          step={0.5}
          format={(v) => `${v}px`}
          onChange={(v) => onChange((x) => void (x.blur = v))}
        />
      </Field>
      <p className="text-[11px] text-ink-faint">Les filtres et l'ombre ne s'exportent pas sous Safari.</p>
    </Section>
  );
}
