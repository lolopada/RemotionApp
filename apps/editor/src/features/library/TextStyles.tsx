import { LayerView } from "@app/composition";
import { createTextLayer, type TextLayer } from "@app/schema";
import { Thumbnail } from "@remotion/player";
import { memo, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { useEditor, useProject, useSelectedLayer } from "../../store/editorStore";
import { applyPreset, resolvePresetStyle, TEXT_PRESETS, type TextPreset } from "../../templates/textPresets";

const PREVIEW_W = 600;
const PREVIEW_H = 260;

/** Mini-composition : le texte du style, dans l'état final de son animation. */
function PresetPreview({ layer, bg }: { layer: TextLayer; bg: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <LayerView layer={layer} sceneDurationInFrames={90} />
    </AbsoluteFill>
  );
}

const PresetTile = memo(function PresetTile({ preset, onClick }: { preset: TextPreset; onClick: () => void }) {
  const layer = useMemo(
    () =>
      createTextLayer({
        ...resolvePresetStyle(preset),
        text: preset.sample,
        // Aperçu : taille réduite pour tenir dans la vignette.
        fontSize: Math.min(110, preset.size * 0.75),
        transform: { x: 20, y: 20, width: PREVIEW_W - 40, height: PREVIEW_H - 40 },
        animation: { enter: "none" },
      }),
    [preset],
  );
  return (
    <button type="button" onClick={onClick} className="group text-left" title={`Style « ${preset.name} »`}>
      <div className="overflow-hidden rounded-md ring-1 ring-line transition group-hover:ring-2 group-hover:ring-accent">
        <Thumbnail
          component={PresetPreview}
          inputProps={{ layer, bg: preset.previewBg }}
          compositionWidth={PREVIEW_W}
          compositionHeight={PREVIEW_H}
          durationInFrames={90}
          fps={30}
          frameToDisplay={89}
          style={{ width: "100%", aspectRatio: `${PREVIEW_W} / ${PREVIEW_H}` }}
        />
      </div>
      <span className="mt-1 block text-[11px] text-ink-muted">{preset.name}</span>
    </button>
  );
});

/**
 * Styles de texte en un clic : appliqué au texte sélectionné, ou ajouté
 * comme nouveau texte au centre si aucun texte n'est sélectionné.
 */
export function TextStyles() {
  const project = useProject();
  const selected = useSelectedLayer();
  const { addLayer, updateLayer } = useEditor.getState();
  const scale = Math.min(project.width, project.height) / 1080;

  const use = (preset: TextPreset) => {
    if (selected?.type === "text") {
      updateLayer(selected.id, (l) => {
        if (l.type === "text") applyPreset(l, preset);
      });
      return;
    }
    const w = Math.round(project.width * 0.8);
    const h = Math.round(preset.size * scale * 2);
    addLayer(
      createTextLayer({
        ...resolvePresetStyle(preset),
        name: preset.name,
        text: preset.sample,
        fontSize: Math.round(preset.size * scale),
        transform: {
          x: Math.round((project.width - w) / 2),
          y: Math.round((project.height - h) / 2),
          width: w,
          height: h,
        },
      }),
    );
  };

  return (
    <div className="grid grid-cols-2 gap-2 px-3">
      {TEXT_PRESETS.map((p) => (
        <PresetTile key={p.id} preset={p} onClick={() => use(p)} />
      ))}
    </div>
  );
}
