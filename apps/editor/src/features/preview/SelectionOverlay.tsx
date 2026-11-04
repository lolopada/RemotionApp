import { createImageLayer, type Layer, type Scene } from "@app/schema";
import clsx from "clsx";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { assignImage, getImageAspect } from "../../lib/images";
import { useEditor } from "../../store/editorStore";
import { CropOverlay } from "./CropOverlay";
import { ASSET_DRAG_TYPE, getDraggedAsset } from "./dnd";
import { hitTestLayers } from "./hitTest";
import {
  type Box,
  boxCenter,
  HANDLES,
  type HandleDir,
  resizeBox,
  resizeCursor,
  rotationFromPointer,
  snapMove,
} from "./transformMath";

interface Drag {
  layerId: string;
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
}

/** Redimensionnement ou rotation en cours, depuis une poignée. */
interface Gesture {
  kind: "resize" | "rotate";
  layerId: string;
  start: Box;
  startFontSize: number | null;
  dir: HandleDir;
}

/** Distance d'aimantation, en pixels écran. */
const SNAP_PX = 6;

/**
 * Calque transparent posé sur le <Player> : sélection au clic, déplacement
 * à la souris (aimanté au centre et aux bords, Alt pour désactiver), poignées de
 * redimensionnement et de rotation sur le calque sélectionné, et « Smart Drop »
 * (déposer une photo sur un cadre la remplace en gardant le masque).
 */
export function SelectionOverlay({ scene, scale }: { scene: Scene; scale: number }) {
  const selectedLayerId = useEditor((s) => s.selectedLayerId);
  const cropLayerId = useEditor((s) => s.cropLayerId);
  const { selectLayer, updateLayer, addLayer, setCropLayer } = useEditor.getState();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ axis: "x" | "y"; at: number }[]>([]);
  const [badge, setBadge] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const gesture = useRef<Gesture | null>(null);
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
    let dx = (e.clientX - d.pointerX) / scale;
    let dy = (e.clientY - d.pointerY) / scale;
    const layer = scene.layers.find((l) => l.id === d.layerId);
    if (layer && !e.altKey) {
      const { width, height } = useEditor.getState().project;
      const t = layer.transform;
      const snap = snapMove(
        { x: d.startX + dx, y: d.startY + dy, width: t.width, height: t.height, rotation: t.rotation },
        { width, height },
        SNAP_PX / scale,
      );
      dx += snap.dx;
      dy += snap.dy;
      setGuides(snap.guides);
    } else {
      setGuides([]);
    }
    updateLayer(d.layerId, (l) => {
      l.transform.x = Math.round(d.startX + dx);
      l.transform.y = Math.round(d.startY + dy);
    });
  };

  const endDrag = () => {
    drag.current = null;
    setGuides([]);
  };

  // --- Poignées : redimensionner et tourner ---
  const startGesture = (e: React.PointerEvent, layer: Layer, kind: Gesture["kind"], dir: HandleDir) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = layer.transform;
    gesture.current = {
      kind,
      layerId: layer.id,
      start: { x: t.x, y: t.y, width: t.width, height: t.height, rotation: t.rotation },
      startFontSize: layer.type === "text" ? layer.fontSize : null,
      dir,
    };
  };

  const moveGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    e.stopPropagation();
    const p = toComp(e.clientX, e.clientY);
    if (g.kind === "rotate") {
      const angle = rotationFromPointer(boxCenter(g.start), p.x, p.y, e.shiftKey ? 15 : 0);
      updateLayer(g.layerId, (l) => void (l.transform.rotation = angle));
      setBadge(`${Math.round(angle)}°`);
      return;
    }
    const isCorner = g.dir.hx !== 0 && g.dir.hy !== 0;
    const r = resizeBox(g.start, g.dir, p.x, p.y, { keepRatio: isCorner && !e.shiftKey, fromCenter: e.altKey });
    const scaleText = g.startFontSize !== null && isCorner && !e.shiftKey;
    updateLayer(g.layerId, (l) => {
      l.transform.x = Math.round(r.x);
      l.transform.y = Math.round(r.y);
      l.transform.width = Math.round(r.width);
      l.transform.height = Math.round(r.height);
      if (scaleText && l.type === "text" && g.startFontSize !== null) {
        l.fontSize = Math.max(4, Math.round(g.startFontSize * r.scale));
      }
    });
    setBadge(`${Math.round(r.width)} × ${Math.round(r.height)}`);
  };

  const endGesture = (e: React.PointerEvent) => {
    if (!gesture.current) return;
    e.stopPropagation();
    gesture.current = null;
    setBadge(null);
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
      assignImage(target.id, url);
      selectLayer(target.id);
      return;
    }
    const p = toComp(clientX, clientY);
    const size = 480;
    const layer = createImageLayer({
      name,
      src: url,
      transform: { x: Math.round(p.x - size / 2), y: Math.round(p.y - size / 2), width: size, height: size },
    });
    addLayer(layer);
    assignImage(layer.id, url); // mémorise le ratio de l'image
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

  const cropLayer = scene.layers.find((l) => l.id === cropLayerId);
  if (cropLayer?.type === "image") return <CropOverlay layer={cropLayer} scale={scale} />;

  /** Double-clic sur une photo : recadrage à la souris. */
  const onDoubleClick = (e: React.MouseEvent) => {
    const layer = imageLayerAt(e.clientX, e.clientY);
    if (layer?.type !== "image" || !layer.src) return;
    drag.current = null;
    setCropLayer(layer.id);
    if (!layer.imageAspect)
      void getImageAspect(layer.src).then(
        (a) =>
          a &&
          updateLayer(layer.id, (l) => {
            if (l.type === "image") l.imageAspect = a;
          }),
      );
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
      onDoubleClick={onDoubleClick}
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
            {selected && !l.locked && l.id !== dropTargetId ? (
              <Handles layer={l} scale={scale} onStart={startGesture} onMove={moveGesture} onEnd={endGesture} />
            ) : null}
          </div>
        );
      })}
      {guides.map((g) => (
        <div
          key={`${g.axis}${g.at}`}
          className="pointer-events-none absolute bg-fuchsia-500"
          style={
            g.axis === "x"
              ? { left: g.at * scale - 0.5, top: 0, bottom: 0, width: 1 }
              : { top: g.at * scale - 0.5, left: 0, right: 0, height: 1 }
          }
        />
      ))}
      {badge ? (
        <span className="pointer-events-none absolute top-2 left-2 rounded bg-black/75 px-2 py-1 font-medium text-[11px] text-white tabular-nums">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

interface HandlesProps {
  layer: Layer;
  scale: number;
  onStart: (e: React.PointerEvent, layer: Layer, kind: Gesture["kind"], dir: HandleDir) => void;
  onMove: (e: React.PointerEvent) => void;
  onEnd: (e: React.PointerEvent) => void;
}

/** Huit poignées de redimensionnement et une poignée de rotation, dans le repère (tourné) du calque. */
function Handles({ layer, scale, onStart, onMove, onEnd }: HandlesProps) {
  const { width, height, rotation } = layer.transform;
  const common = { onPointerMove: onMove, onPointerUp: onEnd, onPointerCancel: onEnd };
  // Sur un petit calque, les poignées du milieu se superposeraient aux coins.
  const visible = HANDLES.filter((h) => !((h.hx === 0 && width * scale < 36) || (h.hy === 0 && height * scale < 36)));
  return (
    <>
      {visible.map((h) => (
        <div
          key={`${h.hx},${h.hy}`}
          data-handle={`${h.hx},${h.hy}`}
          className="pointer-events-auto absolute size-2.5 rounded-[2px] border border-accent bg-white shadow-sm"
          style={{
            left: `${(h.hx + 1) * 50}%`,
            top: `${(h.hy + 1) * 50}%`,
            transform: "translate(-50%, -50%)",
            cursor: resizeCursor(h, rotation),
          }}
          onPointerDown={(e) => onStart(e, layer, "resize", h)}
          {...common}
        />
      ))}
      <div className="pointer-events-none absolute top-0 left-1/2 h-6 w-px -translate-x-1/2 -translate-y-full bg-accent" />
      <div
        data-handle="rotate"
        title="Tourner (Maj : par pas de 15°)"
        className="pointer-events-auto absolute top-0 left-1/2 size-3.5 cursor-grab rounded-full border border-accent bg-white shadow-sm active:cursor-grabbing"
        style={{ transform: "translate(-50%, calc(-100% - 22px))" }}
        onPointerDown={(e) => onStart(e, layer, "rotate", { hx: 0, hy: -1 })}
        {...common}
      />
    </>
  );
}
