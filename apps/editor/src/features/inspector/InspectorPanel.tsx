import { useEditor, useSelectedLayer, useSelectedScene } from "../../store/editorStore";
import { AudioInspector } from "./AudioInspector";
import { LayerInspector } from "./LayerInspector";
import { SceneInspector } from "./SceneInspector";

/** Panneau droit : réglages de ce qui est sélectionné (musique > calque > scène). */
export function InspectorPanel() {
  const layer = useSelectedLayer();
  const scene = useSelectedScene();
  const audioId = useEditor((s) => s.selectedAudioId);
  const clip = useEditor((s) => s.project.audio.find((c) => c.id === audioId));

  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-line border-l bg-panel">
      {clip ? (
        <AudioInspector clip={clip} />
      ) : layer ? (
        <LayerInspector layer={layer} />
      ) : scene ? (
        <SceneInspector scene={scene} />
      ) : null}
    </aside>
  );
}
