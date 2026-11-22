import type { Background } from "@app/schema";
import { useId, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Img } from "remotion";
import { useImageSrc } from "../context";
import { linearGradientVector } from "./gradient";

/**
 * Fonds de scène.
 *
 * L'export navigateur (@remotion/web-renderer) ne sait dessiner que des dégradés
 * CSS simples (radial uniquement centré, pas de couches multiples, `background-size`
 * peu fiable). Les dégradés et les motifs sont donc dessinés en SVG : le navigateur
 * rastérise lui-même le SVG, ce qui donne exactement le même rendu à l'aperçu et à l'export.
 * Le grain passe par un <canvas> généré une fois (bruit pseudo-aléatoire à graine fixe).
 */

type Gradient = Extract<Background, { type: "gradient" }>;
type Pattern = Extract<Background, { type: "pattern" }>;
type ImageBg = Extract<Background, { type: "image" }>;

const svgStyle = { position: "absolute", inset: 0, display: "block" } as const;

/** Les ids de useId contiennent des « : », que `url(#…)` n'aime pas. */
const useSvgId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

const round = (n: number) => Math.round(n * 100) / 100;

/** Position des couleurs, avec un léger balancement des couleurs du milieu quand c'est animé. */
function stopPositions(count: number, t: number, animated: boolean): number[] {
  return Array.from({ length: count }, (_, i) => {
    const base = i / (count - 1);
    if (!animated || i === 0 || i === count - 1) return base;
    return base + 0.07 * Math.sin(t * 0.9 + i * 1.7);
  });
}

function GradientSvg({ bg, width, height, t }: { bg: Gradient; width: number; height: number; t: number }) {
  const id = useSvgId("g");
  const animated = bg.motion.enabled;
  const pos = stopPositions(bg.colors.length, t, animated);
  const stops = bg.colors.map((color, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: la position dans la liste est l'identité d'une couleur
    <stop key={i} offset={round(pos[i] ?? 0)} stopColor={color} />
  ));

  let gradient: React.ReactNode;
  if (bg.kind === "radial") {
    const cx = (bg.centerX + (animated ? 0.1 * Math.sin(t * 0.6) : 0)) * width;
    const cy = (bg.centerY + (animated ? 0.1 * Math.cos(t * 0.45 + 1) : 0)) * height;
    const r = bg.radius * (Math.hypot(width, height) / 2) * (animated ? 1 + 0.08 * Math.sin(t * 0.7) : 1);
    gradient = (
      <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={round(cx)} cy={round(cy)} r={round(r)}>
        {stops}
      </radialGradient>
    );
  } else {
    // Animé : les couleurs glissent le long de l'axe ; « reflect » évite tout bord uni.
    const angle = bg.angle + (animated ? 14 * Math.sin(t * 0.55) : 0);
    const shift = animated ? 0.18 * Math.sin(t * 0.8 + 1) : 0;
    gradient = (
      <linearGradient
        id={id}
        gradientUnits="userSpaceOnUse"
        spreadMethod={animated ? "reflect" : "pad"}
        {...linearGradientVector(angle, width, height, shift)}
      >
        {stops}
      </linearGradient>
    );
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={svgStyle}
      aria-hidden
    >
      <defs>{gradient}</defs>
      <rect width={width} height={height} fill={`url(#${id})`} />
    </svg>
  );
}

function PatternSvg({ bg, width, height, t }: { bg: Pattern; width: number; height: number; t: number }) {
  const id = useSvgId("p");
  const s = bg.size;
  const drift = bg.motion.enabled ? t * s * 0.35 : 0;

  let tile: { w: number; h: number; content: React.ReactNode };
  switch (bg.pattern) {
    case "dots": {
      // Pois en quinconce : un au centre de la tuile, et les quatre coins (qui se rejoignent).
      const r = bg.thickness * s * 0.3;
      tile = {
        w: s,
        h: s,
        content: (
          <>
            <circle cx={s / 2} cy={s / 2} r={r} fill={bg.ink} />
            <circle cx={0} cy={0} r={r} fill={bg.ink} />
            <circle cx={s} cy={0} r={r} fill={bg.ink} />
            <circle cx={0} cy={s} r={r} fill={bg.ink} />
            <circle cx={s} cy={s} r={r} fill={bg.ink} />
          </>
        ),
      };
      break;
    }
    case "stripes":
      tile = { w: s, h: s, content: <rect width={bg.thickness * s} height={s} fill={bg.ink} /> };
      break;
    case "checks":
      tile = {
        w: s * 2,
        h: s * 2,
        content: (
          <>
            <rect width={s} height={s} fill={bg.ink} />
            <rect x={s} y={s} width={s} height={s} fill={bg.ink} />
          </>
        ),
      };
      break;
    case "grid": {
      const lw = Math.max(1, bg.thickness * s * 0.25);
      tile = {
        w: s,
        h: s,
        content: (
          <>
            <rect width={s} height={lw} fill={bg.ink} />
            <rect width={lw} height={s} fill={bg.ink} />
          </>
        ),
      };
      break;
    }
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={svgStyle}
      aria-hidden
    >
      <defs>
        <pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={tile.w}
          height={tile.h}
          patternTransform={`rotate(${bg.angle}) translate(${round(drift)} ${round(drift * 0.5)})`}
        >
          {tile.content}
        </pattern>
      </defs>
      <rect width={width} height={height} fill={bg.base} />
      <rect width={width} height={height} fill={`url(#${id})`} />
    </svg>
  );
}

/** Voile coloré sur une photo : plein, dégradé depuis un bord, ou vignette. */
function VeilSvg({ veil, width, height }: { veil: ImageBg["veil"]; width: number; height: number }) {
  const id = useSvgId("v");
  let gradient: React.ReactNode = null;
  if (veil.mode === "bottom" || veil.mode === "top") {
    const [y1, y2] = veil.mode === "bottom" ? [1, 0] : [0, 1];
    gradient = (
      <linearGradient id={id} x1="0" y1={y1} x2="0" y2={y2}>
        <stop offset="0" stopColor={veil.color} stopOpacity={veil.opacity} />
        <stop offset="1" stopColor={veil.color} stopOpacity={0} />
      </linearGradient>
    );
  } else if (veil.mode === "vignette") {
    gradient = (
      <radialGradient id={id} cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.3" stopColor={veil.color} stopOpacity={0} />
        <stop offset="1" stopColor={veil.color} stopOpacity={veil.opacity} />
      </radialGradient>
    );
  }
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={svgStyle}
      aria-hidden
    >
      {gradient ? <defs>{gradient}</defs> : null}
      <rect
        width={width}
        height={height}
        fill={gradient ? `url(#${id})` : veil.color}
        fillOpacity={gradient ? 1 : veil.opacity}
      />
    </svg>
  );
}

// ───────────────────────── grain ─────────────────────────

const noiseCache = new Map<string, ImageData>();

/** Bruit noir/blanc à transparence aléatoire, identique à chaque image (graine fixe). */
function getNoise(ctx: CanvasRenderingContext2D, w: number, h: number): ImageData {
  const key = `${w}x${h}`;
  const hit = noiseCache.get(key);
  if (hit) return hit;
  const data = ctx.createImageData(w, h);
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = rand() < 0.5 ? 0 : 255;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = Math.floor(rand() * 255);
  }
  if (noiseCache.size > 6) noiseCache.clear();
  noiseCache.set(key, data);
  return data;
}

/** Le grain est dessiné à demi-résolution puis étiré : un grain plus doux et plus léger. */
function GrainCanvas({ width, height, strength }: { width: number; height: number; strength: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = Math.max(16, Math.round(width / 2));
  const h = Math.max(16, Math.round(height / 2));
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) ctx.putImageData(getNoise(ctx, w, h), 0, 0);
  }, [w, h]);
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: strength * 0.55 }}
    />
  );
}

// ───────────────────────── assemblage ─────────────────────────

export interface BackgroundGraphicProps {
  background: Background;
  /** Dimensions du dessin (composition, ou une miniature plus petite). */
  width: number;
  height: number;
  /** Image courante de la scène et cadence, pour les fonds animés. */
  frame?: number;
  fps?: number;
  durationInFrames?: number;
}

/** Le fond seul, sans dépendre du contexte Remotion (utilisé aussi pour les miniatures). */
/** Photo de fond (copie réduite dans l'éditeur, originale à l'export). */
function BackgroundImg({ src, style }: { src: string; style: React.CSSProperties }) {
  return <Img src={useImageSrc(src)} style={style} />;
}

export function BackgroundGraphic({
  background,
  width,
  height,
  frame = 0,
  fps = 30,
  durationInFrames = 1,
}: BackgroundGraphicProps) {
  const speed = background.type === "color" ? 1 : background.motion.speed;
  const t = (frame / fps) * speed;

  let base: React.ReactNode;
  switch (background.type) {
    case "color":
      base = <AbsoluteFill style={{ backgroundColor: background.color }} />;
      break;
    case "gradient":
      base = <GradientSvg bg={background} width={width} height={height} t={t} />;
      break;
    case "pattern":
      base = <PatternSvg bg={background} width={width} height={height} t={t} />;
      break;
    case "image": {
      // Zoom lent : de 100 % à ~110 % sur la durée de la scène.
      const progress = Math.min(1, frame / Math.max(1, durationInFrames));
      const zoom = background.motion.enabled ? 1 + 0.1 * background.motion.speed * progress : 1;
      // Agrandi un peu quand flouté pour masquer les bords transparents.
      const scale = (background.blur > 0 ? 1.08 : 1) * zoom;
      base = (
        <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
          {background.src ? (
            <BackgroundImg
              src={background.src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: background.blur > 0 ? `blur(${background.blur}px)` : undefined,
                transform: scale !== 1 ? `scale(${round(scale)})` : undefined,
              }}
            />
          ) : null}
          {background.veil.enabled ? <VeilSvg veil={background.veil} width={width} height={height} /> : null}
        </AbsoluteFill>
      );
      break;
    }
  }

  return (
    <AbsoluteFill>
      {base}
      {background.grain > 0 ? <GrainCanvas width={width} height={height} strength={background.grain} /> : null}
    </AbsoluteFill>
  );
}
