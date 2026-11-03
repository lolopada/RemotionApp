import type { Layer } from "@app/schema";

export interface SectionProps<T extends Layer> {
  layer: T;
  /** Modifie le calque (brouillon immer : on peut muter directement). */
  update: (fn: (layer: T) => void) => void;
}
