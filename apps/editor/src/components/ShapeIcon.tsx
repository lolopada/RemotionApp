import { shapePath } from "@app/composition";

/** Petite icône d'une forme, dessinée avec le même tracé que le rendu. */
export function ShapeIcon({ shape, size = 20, className }: { shape: string; size?: number; className?: string }) {
  if (shape === "none") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden="true">
        <rect x="2" y="2" width="16" height="16" fill="none" stroke="currentColor" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (shape === "line") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true">
        <path
          d={shapePath(shape, size - 4, size - 4, { x: 2, y: 2 })}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true">
      <path d={shapePath(shape, size - 2, size - 2, { radius: size * 0.22, x: 1, y: 1 })} fill="currentColor" />
    </svg>
  );
}
