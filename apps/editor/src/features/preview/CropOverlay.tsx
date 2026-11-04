import { imageBox, maxOffset, photoArea } from "@app/composition";
import type { ImageLayer } from "@app/schema";
import { Check, RotateCcw, ZoomIn } from "lucide-react";
import { useEffect, useRef } from "react";
import { useEditor } from "../../store/editorStore";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

/**
 * Recadrage à la souris (double-clic sur une photo) :
 *  - glisser = déplacer la photo dans son cadre,
 *  - molette ou curseur = zoomer,
 *  - Entrée / Échap / clic à côté = terminer.
 * La partie de la photo hors du cadre est montrée en transparence.
 */
export function CropOverlay({ layer, scale }: { layer: ImageLayer; scale: number }) {
  const { updateLayer, setCropLayer } = useEditor.getState();
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const { x, y, width, height, rotation } = layer.transform;
  const area = photoArea(layer);
  const box = imageBox(layer, area.width, area.height);
  const { zoom, offsetX, offsetY } = layer.crop;
  const cover = layer.fit === "cover" && layer.imageAspect !== null;

  /** Garde la photo collée aux bords du cadre (pas de vide) en mode « remplir ». */
  const clampCrop = (z: number, ox: number, oy: number) => {
    const lim = cover ? maxOffset(layer, area.width, area.height, z) : { x: 0.5, y: 0.5 };
    return {
      zoom: z,
      offsetX: Math.max(-lim.x, Math.min(lim.x, ox)),
      offsetY: Math.max(-lim.y, Math.min(lim.y, oy)),
    };
  };
  const setCrop = (z: number, ox: number, oy: number) =>
    updateLayer(layer.id, (l) => {
      if (l.type === "image") l.crop = clampCrop(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)), ox, oy);
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.stopPropagation();
        setCropLayer(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [setCropLayer]);

  // Déplacement à l'écran → déplacement dans le repère (tourné) du calque.
  const toLocal = (dx: number, dy: number) => {
    const a = (-rotation * Math.PI) / 180;
    return { dx: (dx * Math.cos(a) - dy * Math.sin(a)) / scale, dy: (dx * Math.sin(a) + dy * Math.cos(a)) / scale };
  };

  const s = scale;
  const imgTransform = [
    `translate(${offsetX * area.width * s}px, ${offsetY * area.height * s}px)`,
    `scale(${zoom})`,
    layer.flipX || layer.flipY ? `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` : "",
  ].join(" ");

  return (
    <div
      role="application"
      aria-label="Recadrage de la photo"
      className="absolute inset-0 cursor-default touch-none select-none bg-black/40"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setCropLayer(null); // clic à côté
      }}
      onWheel={(e) => {
        e.preventDefault();
        setCrop(zoom * Math.exp(-e.deltaY * 0.0015), offsetX, offsetY);
      }}
    >
      <div
        className="absolute"
        style={{
          left: x * s,
          top: y * s,
          width: width * s,
          height: height * s,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: zone de glisser à la souris */}
        <div
          className="absolute cursor-grab outline-2 outline-accent active:cursor-grabbing"
          style={{ left: area.x * s, top: area.y * s, width: area.width * s, height: area.height * s }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const { dx, dy } = toLocal(e.clientX - d.x, e.clientY - d.y);
            setCrop(zoom, d.ox + dx / area.width, d.oy + dy / area.height);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onDoubleClick={() => setCropLayer(null)}
        >
          {layer.src ? (
            <img
              src={layer.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none opacity-45"
              style={{
                left: box.left * s,
                top: box.top * s,
                width: box.width * s,
                height: box.height * s,
                objectFit: box.objectFit,
                transform: imgTransform,
              }}
            />
          ) : null}
          {/* Grille des tiers pour aider à composer */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: grille fixe
              <div key={i} className="border border-white/25" />
            ))}
          </div>
        </div>
      </div>

      <div
        className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-panel/95 px-3 py-2 text-xs shadow-xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-ink-muted">Glisse pour cadrer</span>
        <ZoomIn size={14} className="text-ink-faint" />
        <input
          type="range"
          aria-label="Zoom"
          className="w-28 accent-accent"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setCrop(e.currentTarget.valueAsNumber, offsetX, offsetY)}
        />
        <span className="w-9 text-ink-muted tabular-nums">{zoom.toFixed(2)}×</span>
        <button
          type="button"
          title="Réinitialiser"
          onClick={() => setCrop(1, 0, 0)}
          className="rounded p-1 text-ink-muted hover:bg-panel-hover hover:text-ink"
        >
          <RotateCcw size={13} />
        </button>
        <button
          type="button"
          onClick={() => setCropLayer(null)}
          className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-white hover:bg-accent-hover"
        >
          <Check size={13} /> Terminé
        </button>
      </div>
    </div>
  );
}
