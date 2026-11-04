import type { Theme } from "./common";
import type { TextLayer } from "./layers";
import type { Project, Scene } from "./project";

/**
 * Titres d'une scène : les textes dont la taille approche celle du plus grand
 * (un texte seul est un titre). Les autres sont des textes courants.
 */
export function headingLayerIds(scene: Scene): Set<string> {
  const texts = scene.layers.filter((l): l is TextLayer => l.type === "text");
  const max = Math.max(0, ...texts.map((t) => t.fontSize));
  return new Set(texts.filter((t) => t.fontSize >= max * 0.75).map((t) => t.id));
}

/** Couleurs d'un dégradé de fond de n couleurs, prises dans la palette. */
function gradientColors(theme: Theme, n: number): string[] {
  const { background, background2, accent } = theme.colors;
  if (n <= 2) return [background, background2];
  if (n === 3) return [background, accent, background2];
  const cycle = [background, background2, accent];
  return Array.from({ length: n }, (_, i) => cycle[i % cycle.length] as string);
}

/**
 * Applique le thème à une scène, rôle par rôle : fond → couleurs de fond, titres et
 * textes → polices et couleurs du thème, bandeaux/surlignage/formes → accent.
 * Les photos et stickers ne changent pas. Mute la scène.
 */
export function applyThemeToScene(scene: Scene, theme: Theme): void {
  const c = theme.colors;
  const bg = scene.background;
  switch (bg.type) {
    case "color":
      bg.color = c.background;
      break;
    case "gradient":
      bg.colors = gradientColors(theme, bg.colors.length);
      break;
    case "pattern":
      bg.base = c.background;
      bg.ink = c.background2;
      break;
    case "image":
      bg.veil.color = c.background;
      break;
  }

  const headings = headingLayerIds(scene);
  for (const layer of scene.layers) {
    if (layer.type === "text") {
      const heading = headings.has(layer.id);
      layer.fontFamily = heading ? theme.headingFont : theme.bodyFont;
      layer.color = heading ? c.title : c.text;
      layer.gradient.from = c.accent;
      layer.gradient.to = c.title;
      layer.box.color = c.accent;
      layer.textAnimation.highlightColor = c.accent;
    } else if (layer.type === "shape") {
      if (layer.fillMode === "none" || layer.shape === "line") {
        layer.stroke.color = c.accent;
      } else {
        layer.fill = c.accent;
        layer.gradient.colors = layer.gradient.colors.map((_, i) => (i % 2 === 0 ? c.accent : c.background2));
        layer.stroke.color = c.title;
      }
    } else if (layer.type === "image" && layer.border.width > 0) {
      layer.border.color = c.accent;
    }
  }
}

/** Enregistre le thème dans le projet et l'applique à toutes les scènes. Mute le projet. */
export function applyTheme(project: Project, theme: Theme): void {
  project.theme = structuredClone(theme);
  for (const scene of project.scenes) applyThemeToScene(scene, theme);
}
