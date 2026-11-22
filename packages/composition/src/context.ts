import { createContext, useContext, useSyncExternalStore } from "react";

export type RenderMode = {
  /**
   * true dans l'éditeur : les cadres photo vides affichent un repère.
   * false à l'export : rien n'est dessiné pour un cadre vide.
   */
  showPlaceholders: boolean;
};

export const RenderModeContext = createContext<RenderMode>({ showPlaceholders: false });

export const useRenderMode = () => useContext(RenderModeContext);

/**
 * Source réellement affichée pour une image. Dans l'éditeur, une copie réduite des photos
 * (calculée dans le navigateur) remplace l'originale : décoder et redessiner une photo de
 * 12 Mpx à chaque image fait ramer l'aperçu. À l'export, aucun fournisseur : l'originale.
 */
export interface ImageSources {
  /** Source à afficher pour `src` (l'originale tant que la copie n'est pas prête). */
  get: (src: string) => string;
  subscribe: (onChange: () => void) => () => void;
}

const ORIGINALS: ImageSources = { get: (src) => src, subscribe: () => () => {} };

export const ImageSourcesContext = createContext<ImageSources>(ORIGINALS);

/** Source à afficher pour une image de la composition (copie réduite dans l'éditeur). */
export function useImageSrc(src: string): string {
  const sources = useContext(ImageSourcesContext);
  return useSyncExternalStore(
    sources.subscribe,
    () => sources.get(src),
    () => src,
  );
}
