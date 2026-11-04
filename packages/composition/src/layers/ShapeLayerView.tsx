import type { ShapeLayer } from "@app/schema";
import { useId } from "react";
import { linearGradientVector } from "../effects/gradient";
import { shapePath } from "../effects/shapes";
import { withOpacity } from "./TextLayerView";
import type { LayerViewProps } from "./types";

/**
 * Forme décorative, dessinée en SVG : remplissage uni / dégradé / vide, contour
 * (plein, tirets, points) et ombre portée. Le SVG est rastérisé par le navigateur,
 * ce qui donne le même résultat dans l'aperçu et dans l'export.
 */
export function ShapeLayerView({ layer }: LayerViewProps<ShapeLayer>) {
  const { width, height } = layer.transform;
  const gid = `s${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const isLine = layer.shape === "line";
  const stroked = isLine || layer.stroke.enabled;
  const filled = !isLine && layer.fillMode !== "none";
  const sw = layer.stroke.width;
  // Le contour est centré sur le tracé : on rentre la forme de la moitié de son épaisseur.
  const inset = stroked ? sw / 2 : 0;
  const d = shapePath(layer.shape, Math.max(1, width - inset * 2), Math.max(1, height - inset * 2), {
    radius: layer.radius,
    x: inset,
    y: inset,
  });
  const gradient = layer.fillMode === "gradient";
  const colors = layer.gradient.colors;
  const stops = colors.map((color, i) => ({ color, offset: i / Math.max(1, colors.length - 1) }));
  const ds = layer.dropShadow;

  const dash =
    layer.stroke.style === "dashed"
      ? `${sw * 2} ${sw * 1.4}`
      : layer.stroke.style === "dotted"
        ? `0 ${sw * 2}`
        : undefined;
  const round = layer.stroke.style === "dotted" || isLine;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        // drop-shadow suit la forme (contrairement à box-shadow).
        filter: ds.enabled
          ? `drop-shadow(${ds.x}px ${ds.y}px ${ds.blur / 2}px ${withOpacity(ds.color, ds.opacity)})`
          : undefined,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
        aria-hidden
      >
        {gradient && filled ? (
          <defs>
            <linearGradient
              id={gid}
              gradientUnits="userSpaceOnUse"
              {...linearGradientVector(layer.gradient.angle, width, height)}
            >
              {stops.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          </defs>
        ) : null}
        <path
          d={d}
          fill={filled ? (gradient ? `url(#${gid})` : layer.fill) : "none"}
          stroke={stroked ? layer.stroke.color : "none"}
          strokeWidth={stroked ? sw : 0}
          strokeDasharray={dash}
          strokeLinecap={round ? "round" : "butt"}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
