import { createImageLayer, type Layer, type Scene } from "@app/schema";
import clsx from "clsx";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { useEditor } from "../../store/editorStore";
import { ASSET_DRAG_TYPE, getDraggedAsset } from "./dnd";
import { hitTestLayers } from "./hitTest";

interface Drag {
  layerId: string;
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
}

/**
 * Calque transparent posé sur le <Player> : sélection au clic, déplacement
 * à la souris et « Smart Drop » (déposer une photo sur un cadre la remplace
 * en gardant le masque).
 * Étape suivante : poignées de redimensionnement / rotation (react-moveable).
 */
export function SelectionOverlay({ scene, scale }: { scene: Scene; scale: number }) {
  const selectedLayerId = useEditor((s) => s.selectedLayerId);
  const { selectLayer, updateLayer, addLayer } = useEditor.getState();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const toComp = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const layerAt = (clientX: number, clientY: number) => {
    const p = toComp(clientX, clientY);
    return hitTestLayers(scene.layers, p.x, p.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const layer = layerAt(e.clientX, e.clientY);
    selectLayer(layer?.id ?? null);
    if (!layer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      layerId: layer.id,
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: layer.transform.x,
      startY: layer.transform.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) {
      setHoverId(layerAt(e.clientX, e.clientY)?.id ?? null);
      return;
    }
    const dx = (e.clientX - d.pointerX) / scale;
    const dy = (e.clientY - d.pointerY) / scale;
    updateLayer(d.layerId, (l) => {
      l.transform.x = Math.round(d.startX + dx);
      l.transform.y = Math.round(d.startY + dy);
    });
  };

  const endDrag = () => {
    drag.current = null;
  };

  // --- Glisser-déposer de médias ---
  const imageLayerAt = (clientX: number, clientY: number) => {
    const p = toComp(clientX, clientY);
    const images = scene.layers.filter((l): l is Extract<Layer, { type: "image" }> => l.type === "image");
    return hitTestLayers(images, p.x, p.y);
  };

  const placeImage = (url: string, clientX: number, clientY: number, name: string) => {
    const target = imageLayerAt(clientX, clientY);
    if (target && target.type === "image") {
      updateLayer(target.id, (l) => {
        if (l.type === "image") l.src = url;
      });
      selectLayer(target.id);
      return;
    }
    const p = toComp(clientX, clientY);
    const size = 480;
    addLayer(
      createImageLayer({
        name,
        src: url,
        transform: { x: Math.round(p.x - size / 2), y: Math.round(p.y - size / 2), width: size, height: size },
      }),
    );
  };

  const onDragOver = (e: React.DragEvent) => {
    const accepts = e.dataTransfer.types.includes(ASSET_DRAG_TYPE) || e.dataTransfer.types.includes("Files");
    if (!accepts) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropTargetId(imageLayerAt(e.clientX, e.clientY)?.id ?? null);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetId(null);
    const { clientX, clientY } = e;
    const asset = getDraggedAsset(e);
    if (asset?.kind === "image") {
      placeImage(asset.url, clientX, clientY, asset.name);
      return;
    }
    // Fichier déposé directement depuis l'ordinateur : on l'envoie au serveur.
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    try {
      const uploaded = await api.uploadAsset(file);
      placeImage(uploaded.url, clientX, clientY, file.name);
    } catch (err) {
      // Serveur indisponible : image locale temporaire (non sauvegardée).
      console.warn("Upload impossible, image temporaire", err);
      placeImage(URL.createObjectURL(file), clientX, clientY, file.name);
    }
  };

  const outlined = scene.layers.filter(
    (l) => !l.hidden && (l.id === selectedLayerId || l.id === hoverId || l.id === dropTargetId),
  );

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Zone d'édition"
      className="absolute inset-0 cursor-default touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => setHoverId(null)}
      onDragOver={onDragOver}
      onDragLeave={() => setDropTargetId(null)}
      onDrop={onDrop}
    >
      {outlined.map((l) => {
        const { x, y, width, height, rotation } = l.transform;
        const selected = l.id === selectedLayerId;
        return (
          <div
            key={l.id}
            className={clsx(
              "pointer-events-none absolute",
              l.id === dropTargetId
                ? "outline-2 outline-emerald-400 outline-dashed"
                : selected
                  ? "outline-2 outline-accent"
                  : "outline-1 outline-accent/60",
            )}
            style={{
              left: x * scale,
              top: y * scale,
              width: width * scale,
              height: height * scale,
              transform: `rotate(${rotation}deg)`,
            }}
          >
            {selected ? (
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                {l.name || l.type}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
