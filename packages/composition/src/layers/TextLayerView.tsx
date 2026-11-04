import type { TextLayer } from "@app/schema";
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { ensureFont, nearestWeight } from "../fonts";
import type { LayerViewProps } from "./types";

const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

/** #rgb / #rrggbb + opacité → rgba(). Les autres formats CSS sont rendus tels quels. */
export function withOpacity(color: string, opacity: number): string {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return color;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/**
 * Casse appliquée en JS plutôt qu'en CSS : le découpage lettre par lettre et
 * le rendu navigateur de l'export voient ainsi exactement le même texte.
 */
export function applyCase(text: string, mode: TextLayer["textTransform"]): string {
  switch (mode) {
    case "uppercase":
      return text.toLocaleUpperCase("fr-FR");
    case "lowercase":
      return text.toLocaleLowerCase("fr-FR");
    case "capitalize":
      return text.replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("fr-FR"));
    default:
      return text;
  }
}

/** Couleur unie ou dégradé (via background-clip: text). */
function fillStyle(layer: TextLayer): CSSProperties {
  if (!layer.gradient.enabled) return { color: layer.color };
  return {
    backgroundImage: `linear-gradient(${layer.gradient.angle}deg, ${layer.gradient.from}, ${layer.gradient.to})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };
}

/**
 * Ombre portée, ou halo (néon) quand les décalages sont à 0.
 * Avec un dégradé, text-shadow passerait par-dessus le remplissage :
 * on utilise alors filter: drop-shadow (non exporté sous Safari).
 */
function shadowStyle(layer: TextLayer): CSSProperties {
  if (!layer.shadow) return {};
  const c = withOpacity(layer.shadowColor, layer.shadowOpacity);
  const b = layer.shadowBlur;
  const glow = layer.shadowX === 0 && layer.shadowY === 0;
  if (layer.gradient.enabled) {
    return {
      filter: glow
        ? `drop-shadow(0 0 ${b / 2}px ${c}) drop-shadow(0 0 ${b}px ${c})`
        : `drop-shadow(${layer.shadowX}px ${layer.shadowY}px ${b / 2}px ${c})`,
    };
  }
  return {
    textShadow: glow ? `0 0 ${b}px ${c}, 0 0 ${b * 2}px ${c}` : `${layer.shadowX}px ${layer.shadowY}px ${b}px ${c}`,
  };
}

export function TextLayerView({ layer }: LayerViewProps<TextLayer>) {
  const italic = layer.fontStyle === "italic";
  ensureFont(layer.fontFamily, layer.fontWeight, italic);
  const frame = useCurrentFrame();

  const text = applyCase(layer.text, layer.textTransform);
  const anim = layer.textAnimation;
  const t = frame - layer.animation.enterDelayInFrames;
  const progress = interpolate(t, [0, anim.durationInFrames], [0, 1], clamp);
  const fill = fillStyle(layer);
  const box = layer.box;

  let content: ReactNode;
  if (anim.kind === "typewriter" || anim.kind === "letters" || anim.kind === "words") {
    content = <SplitText text={text} layer={layer} t={t} frame={frame} fill={fill} />;
  } else if (anim.kind === "highlight") {
    content = <HighlightText text={text} progress={easeOut(progress)} color={anim.highlightColor} fill={fill} />;
  } else {
    content = <span style={fill}>{text}</span>;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: JUSTIFY[layer.align],
        textAlign: layer.align,
        fontFamily: `"${layer.fontFamily}", sans-serif`,
        fontSize: layer.fontSize,
        fontWeight: nearestWeight(layer.fontFamily, layer.fontWeight, italic),
        fontStyle: layer.fontStyle,
        lineHeight: layer.lineHeight,
        letterSpacing: layer.letterSpacing,
        WebkitTextStroke: layer.strokeWidth > 0 ? `${layer.strokeWidth}px ${layer.strokeColor}` : undefined,
        paintOrder: "stroke fill",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
      }}
    >
      <div
        style={{
          display: box.fullWidth ? "block" : "inline-block",
          width: box.fullWidth ? "100%" : undefined,
          maxWidth: "100%",
          boxSizing: "border-box",
          padding: box.enabled ? `${box.paddingY}px ${box.paddingX}px` : undefined,
          backgroundColor: box.enabled ? withOpacity(box.color, box.opacity) : undefined,
          borderRadius: box.enabled ? box.radius : undefined,
        }}
      >
        <div style={shadowStyle(layer)}>{content}</div>
      </div>
    </div>
  );
}

/**
 * Texte découpé pour les animations machine à écrire / lettre par lettre /
 * mot par mot. Chaque mot reste insécable (pas de coupure au milieu d'un mot).
 * Avec un dégradé, chaque unité porte son propre dégradé (d'où l'angle
 * vertical par défaut, qui donne le même rendu qu'un bloc entier).
 */
function SplitText({
  text,
  layer,
  t,
  frame,
  fill,
}: {
  text: string;
  layer: TextLayer;
  t: number;
  frame: number;
  fill: CSSProperties;
}) {
  const { kind, durationInFrames: D } = layer.textAnimation;
  const tokens = text.split(/(\s+)/);
  const charCount = [...text].length;
  const wordCount = tokens.filter((tok) => tok && !/^\s+$/.test(tok)).length;

  // Machine à écrire : nombre de caractères visibles.
  const typed = Math.floor(interpolate(t, [0, D], [0, charCount], clamp));
  const caretOn = t < D + 30 && Math.floor(frame / 15) % 2 === 0;

  const unitDur = Math.min(14, D);
  const appear = (index: number, count: number) => {
    const stagger = count > 1 ? (D - unitDur) / (count - 1) : 0;
    return easeOut(interpolate(t - index * stagger, [0, unitDur], [0, 1], clamp));
  };

  let charIndex = 0;
  let wordIndex = 0;
  return (
    <>
      {tokens.map((tok, ti) => {
        if (!tok) return null;
        if (/^\s+$/.test(tok)) {
          charIndex += [...tok].length;
          // biome-ignore lint/suspicious/noArrayIndexKey: le texte est figé pour ce rendu
          return <span key={ti}>{tok}</span>;
        }
        const w = wordIndex++;
        if (kind === "words") {
          const p = appear(w, wordCount);
          charIndex += [...tok].length;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: le texte est figé pour ce rendu
              key={ti}
              style={{
                ...fill,
                display: "inline-block",
                opacity: p,
                transform: `translateY(${(1 - p) * 0.45}em)`,
              }}
            >
              {tok}
            </span>
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: le texte est figé pour ce rendu
          <span key={ti} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {[...tok].map((ch, ci) => {
              const i = charIndex++;
              if (kind === "typewriter") {
                const showCaret = caretOn && (i === typed - 1 || (typed === 0 && i === 0));
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lettres d'un mot figé
                  <span key={ci} style={{ ...fill, position: "relative", opacity: i < typed ? 1 : 0 }}>
                    {ch}
                    {showCaret ? (
                      <Caret before={typed === 0} color={layer.gradient.enabled ? layer.gradient.to : layer.color} />
                    ) : null}
                  </span>
                );
              }
              const p = appear(i, charCount);
              return (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: lettres d'un mot figé
                  key={ci}
                  style={{
                    ...fill,
                    display: "inline-block",
                    opacity: p,
                    transform: `translateY(${(1 - p) * 0.5}em) scale(${0.7 + 0.3 * p})`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

/**
 * Surligneur qui se dessine mot après mot, de gauche à droite.
 * Chaque mot (avec l'espace qui le suit) porte son propre trait, un simple
 * bloc coloré : le rendu navigateur de l'export ne gère ni le fond d'un texte
 * sur plusieurs lignes, ni background-size sur ce cas.
 */
function HighlightText({
  text,
  progress,
  color,
  fill,
}: {
  text: string;
  progress: number;
  color: string;
  fill: CSSProperties;
}) {
  const segments = text.match(/[^\S\n]+|[^\s]+[^\S\n]*|\n/g) ?? [];
  const words = segments.filter((seg) => /\S/.test(seg)).length;
  let w = 0;
  return (
    <>
      {segments.map((seg, i) => {
        if (!/\S/.test(seg)) {
          // biome-ignore lint/suspicious/noArrayIndexKey: le texte est figé pour ce rendu
          return <span key={i}>{seg}</span>;
        }
        const p = Math.max(0, Math.min(1, progress * words - w++));
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: le texte est figé pour ce rendu
          <span key={i} style={{ display: "inline-block", position: "relative" }}>
            {/* Le trait d'abord : sans z-index, l'ordre du DOM fait passer le texte devant. */}
            <span
              style={{
                position: "absolute",
                left: 0,
                bottom: "0.08em",
                height: "0.42em",
                width: `${p * 100}%`,
                backgroundColor: color,
              }}
            />
            <span style={{ ...fill, position: "relative" }}>{seg}</span>
          </span>
        );
      })}
    </>
  );
}

/** Curseur clignotant de la machine à écrire (n'affecte pas la mise en page). */
function Caret({ before, color }: { before: boolean; color: string }) {
  return (
    <span
      style={{
        position: "absolute",
        top: "0.12em",
        bottom: "0.08em",
        [before ? "left" : "right"]: "-0.08em",
        width: "0.07em",
        backgroundColor: color,
        WebkitTextFillColor: "initial",
      }}
    />
  );
}
