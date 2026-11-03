import type { Background } from "@app/schema";
import { useEditor } from "../../store/editorStore";
import { TabHeader } from "./LibraryPanel";

const COLORS = ["#0f172a", "#111827", "#ffffff", "#fdf2f8", "#fef3c7", "#ecfeff", "#7c3aed", "#be123c"];

const GRADIENTS: [string, string, number][] = [
  ["#1e1b4b", "#7c3aed", 135],
  ["#1e1b4b", "#be185d", 135],
  ["#fdf2f8", "#fbcfe8", 160],
  ["#0f172a", "#312e81", 180],
  ["#f97316", "#facc15", 120],
  ["#0ea5e9", "#22d3ee", 160],
  ["#064e3b", "#10b981", 140],
  ["#000000", "#434343", 180],
];

const css = (b: Background) =>
  b.type === "color"
    ? { backgroundColor: b.color }
    : b.type === "gradient"
      ? { backgroundImage: `linear-gradient(${b.angle}deg, ${b.from}, ${b.to})` }
      : {};

export function BackgroundsTab() {
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const updateScene = useEditor((s) => s.updateScene);
  const apply = (background: Background) =>
    updateScene(selectedSceneId, (scene) => {
      scene.background = background;
    });

  const swatches: Background[] = [
    ...GRADIENTS.map(([from, to, angle]): Background => ({ type: "gradient", from, to, angle })),
    ...COLORS.map((color): Background => ({ type: "color", color })),
  ];

  return (
    <div>
      <TabHeader title="Fonds" hint="S'applique à la scène sélectionnée. Pour un fond photo : onglet Photos." />
      <div className="grid grid-cols-4 gap-2 px-3 pb-3">
        {swatches.map((b) => (
          <button
            type="button"
            key={JSON.stringify(b)}
            onClick={() => apply(b)}
            className="aspect-square rounded-md ring-1 ring-line transition hover:ring-2 hover:ring-accent"
            style={css(b)}
            aria-label="Appliquer ce fond"
          />
        ))}
      </div>
    </div>
  );
}
