import { evenSize, FORMATS } from "@app/schema";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Button, NumberInput } from "../../components/ui";
import { useEditor, useProject } from "../../store/editorStore";
import { FORMAT_LABELS, type FormatKey, FPS_OPTIONS } from "../home/projectActions";
import { TabHeader } from "./LibraryPanel";

/** Petit rectangle aux proportions du format. */
function Ratio({ width, height }: { width: number; height: number }) {
  const k = 26 / Math.max(width, height);
  return (
    <span
      className="block rounded-[2px] border-2 border-current"
      style={{ width: Math.round(width * k), height: Math.round(height * k) }}
    />
  );
}

/** Format de l'image et cadence du projet. Les calques sont adaptés, les durées gardées en secondes. */
export function FormatTab() {
  const project = useProject();
  const { setFormat, setFps } = useEditor.getState();
  const [w, setW] = useState(project.width);
  const [h, setH] = useState(project.height);
  useEffect(() => {
    setW(project.width);
    setH(project.height);
  }, [project.width, project.height]);

  const isCurrent = (f: { width: number; height: number }) => f.width === project.width && f.height === project.height;
  const custom = !(Object.values(FORMATS) as { width: number; height: number }[]).some(isCurrent);

  return (
    <div className="pb-4">
      <TabHeader
        title="Format"
        hint="Change la taille de la vidéo : chaque élément garde sa place relative et est mis à l'échelle pour tenir dans l'image."
      />
      <div className="grid grid-cols-3 gap-1.5 px-3">
        {(Object.keys(FORMATS) as FormatKey[]).map((key) => {
          const f = FORMATS[key];
          return (
            <button
              type="button"
              key={key}
              onClick={() => setFormat({ width: f.width, height: f.height })}
              className={clsx(
                "flex flex-col items-center gap-1.5 rounded-md border px-1 py-2 text-[10px] transition",
                isCurrent(f) ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              <span className="flex h-7 items-center">
                <Ratio width={f.width} height={f.height} />
              </span>
              {FORMAT_LABELS[key]}
            </button>
          );
        })}
      </div>

      <div className={clsx("mx-3 mt-3 rounded-lg border p-2.5", custom ? "border-accent" : "border-line")}>
        <p className="mb-2 font-medium text-xs">Taille libre</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput value={w} min={16} step={2} suffix="L" onChange={(v) => setW(v)} />
          <NumberInput value={h} min={16} step={2} suffix="H" onChange={(v) => setH(v)} />
        </div>
        <Button
          size="sm"
          variant="primary"
          className="mt-2 w-full"
          disabled={evenSize(w) === project.width && evenSize(h) === project.height}
          onClick={() => setFormat({ width: evenSize(w), height: evenSize(h) })}
        >
          Appliquer {evenSize(w)} × {evenSize(h)}
        </Button>
        <p className="mt-1.5 text-[10px] text-ink-faint">Pixels pairs, de 16 à 3840 de côté.</p>
      </div>

      <TabHeader title="Images par seconde" hint="60 pour des mouvements très fluides, 24 pour un rendu « cinéma »." />
      <div className="flex gap-1.5 px-3">
        {FPS_OPTIONS.map((fps) => (
          <button
            type="button"
            key={fps}
            onClick={() => setFps(fps)}
            className={clsx(
              "flex-1 rounded-md border py-1.5 text-xs transition",
              project.fps === fps
                ? "border-accent bg-accent-soft text-ink"
                : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {fps} i/s
          </button>
        ))}
      </div>
      <p className="mt-3 px-3 text-[11px] text-ink-faint">
        Actuellement : {project.width} × {project.height} · {project.fps} images/s. La qualité (720p, 1080p, 4K) se
        choisit au moment de l'export.
      </p>
    </div>
  );
}
