import { BackgroundGraphic } from "@app/composition";
import { type Background, type BackgroundInput, createBackground } from "@app/schema";
import { useEffect, useState } from "react";
import { useEditor } from "../../store/editorStore";
import { TabHeader } from "./LibraryPanel";

interface Preset {
  name: string;
  bg: BackgroundInput;
}

const grad = (name: string, colors: string[], angle = 135, extra: Record<string, unknown> = {}): Preset => ({
  name,
  bg: { type: "gradient", colors, angle, ...extra } as BackgroundInput,
});
const radial = (name: string, colors: string[], centerX = 0.5, centerY = 0.5, radius = 1, extra = {}): Preset =>
  grad(name, colors, 135, { kind: "radial", centerX, centerY, radius, ...extra });
const motif = (
  name: string,
  pattern: "dots" | "stripes" | "checks" | "grid",
  base: string,
  ink: string,
  size: number,
  extra: Record<string, unknown> = {},
): Preset => ({ name, bg: { type: "pattern", pattern, base, ink, size, ...extra } as BackgroundInput });
const flow = { motion: { enabled: true, speed: 1 } };

const SECTIONS: { title: string; presets: Preset[] }[] = [
  {
    title: "Dégradés",
    presets: [
      grad("Violet", ["#1e1b4b", "#7c3aed"]),
      grad("Rose nuit", ["#1e1b4b", "#be185d"]),
      grad("Coucher de soleil", ["#1e1b4b", "#be185d", "#f97316", "#facc15"], 160),
      grad("Aurore", ["#0f172a", "#0e7490", "#10b981", "#a3e635"], 150),
      grad("Océan", ["#082f49", "#0369a1", "#22d3ee"], 180),
      grad("Bonbon", ["#f472b6", "#c084fc", "#60a5fa"]),
      grad("Pastel", ["#fde68a", "#fbcfe8", "#bfdbfe"]),
      grad("Nuit profonde", ["#020617", "#1e1b4b", "#4c1d95", "#be185d"], 200),
      grad("Arc-en-ciel", ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"], 90),
      grad("Forêt", ["#064e3b", "#10b981"], 140),
      grad("Feu", ["#f97316", "#facc15"], 120),
      grad("Charbon", ["#000000", "#434343"], 180),
    ],
  },
  {
    title: "Circulaires",
    presets: [
      radial("Projecteur", ["#7c3aed", "#1e1b4b", "#020617"], 0.5, 0.45),
      radial("Soleil", ["#fde047", "#f97316", "#7c2d12"]),
      radial("Lueur du bas", ["#f472b6", "#4c1d95", "#0f172a"], 0.5, 1, 1.1),
      radial("Halo bleu", ["#38bdf8", "#0c4a6e", "#020617"], 0.3, 0.3),
      radial("Lune", ["#f8fafc", "#94a3b8", "#0f172a"], 0.75, 0.3, 0.8),
      radial("Néon", ["#22d3ee", "#7c3aed", "#0f172a"], 0.5, 0.5, 0.9),
    ],
  },
  {
    title: "Motifs",
    presets: [
      motif("Pois roses", "dots", "#fdf2f8", "#f9a8d4", 56, { thickness: 0.6 }),
      motif("Pois nuit", "dots", "#1e1b4b", "#4338ca", 48),
      motif("Pois jaunes", "dots", "#fef3c7", "#fbbf24", 70, { thickness: 0.7 }),
      motif("Rayures marine", "stripes", "#0f172a", "#1e293b", 60, { angle: 45 }),
      motif("Rayures bonbon", "stripes", "#fdf2f8", "#fbcfe8", 70, { thickness: 0.5 }),
      motif("Rayures vives", "stripes", "#7c3aed", "#a78bfa", 50, { angle: -45, thickness: 0.4 }),
      motif("Damier", "checks", "#111827", "#1f2937", 90),
      motif("Damier crème", "checks", "#fff7ed", "#fed7aa", 80),
      motif("Carreaux", "grid", "#ffffff", "#bfdbfe", 48),
      motif("Quadrillage", "grid", "#0f172a", "#334155", 64),
    ],
  },
  {
    title: "Grain",
    presets: [
      { name: "Pellicule", bg: { type: "color", color: "#1f2937", grain: 0.6 } },
      { name: "Papier", bg: { type: "color", color: "#f5f0e6", grain: 0.35 } },
      grad("Violet granuleux", ["#312e81", "#be185d"], 135, { grain: 0.5 }),
      radial("Projecteur granuleux", ["#a78bfa", "#1e1b4b", "#020617"], 0.5, 0.45, 1, { grain: 0.45 }),
    ],
  },
  {
    title: "Animés",
    presets: [
      grad("Aurore mouvante", ["#0f172a", "#7c3aed", "#22d3ee", "#0f172a"], 135, flow),
      grad("Sorbet", ["#f472b6", "#fb923c", "#facc15", "#f472b6"], 120, flow),
      grad("Vagues", ["#082f49", "#0369a1", "#22d3ee", "#082f49"], 170, flow),
      radial("Lave", ["#fde047", "#be123c", "#450a0a"], 0.5, 0.5, 1, flow),
      radial("Lueur pulsante", ["#c084fc", "#1e1b4b", "#020617"], 0.5, 0.5, 0.9, flow),
      motif("Rayures qui défilent", "stripes", "#0f172a", "#1e293b", 60, { angle: 45, ...flow }),
      motif("Pois qui défilent", "dots", "#1e1b4b", "#4338ca", 48, flow),
      motif("Damier qui défile", "checks", "#111827", "#1f2937", 90, { angle: 20, ...flow }),
    ],
  },
  {
    title: "Unis",
    presets: ["#0f172a", "#111827", "#ffffff", "#fdf2f8", "#fef3c7", "#ecfeff", "#7c3aed", "#be123c"].map(
      (color): Preset => ({ name: color, bg: { type: "color", color } }),
    ),
  },
];

/** Miniature : le vrai rendu du fond, animé au survol s'il bouge. */
function Swatch({ background, title, onClick }: { background: Background; title: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const [frame, setFrame] = useState(0);
  const moves = background.type !== "color" && background.motion.enabled;

  useEffect(() => {
    if (!hover || !moves) {
      setFrame(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setFrame(Math.floor(((now - start) / 1000) * 30));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hover, moves]);

  return (
    <button
      type="button"
      title={title}
      aria-label={`Appliquer le fond « ${title} »`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative aspect-video overflow-hidden rounded-md ring-1 ring-line transition hover:ring-2 hover:ring-accent"
    >
      <BackgroundGraphic background={background} width={480} height={270} frame={frame} fps={30} />
      {moves ? (
        <span className="absolute right-1 bottom-1 rounded bg-black/50 px-1 text-[9px] text-white/80 leading-4">
          anim.
        </span>
      ) : null}
    </button>
  );
}

export function BackgroundsTab() {
  const selectedSceneId = useEditor((s) => s.selectedSceneId);
  const updateScene = useEditor((s) => s.updateScene);
  const apply = (background: Background) =>
    updateScene(selectedSceneId, (scene) => {
      scene.background = background;
    });

  return (
    <div>
      <TabHeader
        title="Fonds"
        hint="S'applique à la scène sélectionnée, puis se règle dans le panneau de droite. Pour un fond photo : onglet Photos."
      />
      {SECTIONS.map((section) => (
        <div key={section.title} className="px-3 pb-3">
          <h3 className="mb-1.5 font-semibold text-[11px] text-ink-faint uppercase tracking-wider">{section.title}</h3>
          <div className="grid grid-cols-2 gap-2">
            {section.presets.map((p) => (
              <Swatch
                key={p.name}
                title={p.name}
                background={createBackground(p.bg)}
                onClick={() => apply(createBackground(p.bg))}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
