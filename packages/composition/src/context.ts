import { createContext, useContext } from "react";

export type RenderMode = {
  /**
   * true dans l'éditeur : les cadres photo vides affichent un repère.
   * false à l'export : rien n'est dessiné pour un cadre vide.
   */
  showPlaceholders: boolean;
};

export const RenderModeContext = createContext<RenderMode>({ showPlaceholders: false });

export const useRenderMode = () => useContext(RenderModeContext);
