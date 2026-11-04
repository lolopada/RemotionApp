/**
 * Axe d'un dégradé linéaire en SVG (userSpaceOnUse) avec la même convention que CSS :
 * 0° = vers le haut, 90° = vers la droite ; la longueur est celle de la ligne de dégradé CSS
 * (les coins ont exactement la première et la dernière couleur).
 */
export function linearGradientVector(angleDeg: number, width: number, height: number, shift = 0) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(width * dx) + Math.abs(height * dy);
  const mx = width / 2 + dx * shift * len;
  const my = height / 2 + dy * shift * len;
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    x1: r(mx - (dx * len) / 2),
    y1: r(my - (dy * len) / 2),
    x2: r(mx + (dx * len) / 2),
    y2: r(my + (dy * len) / 2),
  };
}
