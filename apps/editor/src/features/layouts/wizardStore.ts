import { create } from "zustand";

/** Fenêtre « Nouvelle page » (après une scène) ou « Changer de mise en page » (d'une scène). */
export type WizardRequest = { mode: "new"; afterId?: string } | { mode: "relayout"; sceneId: string };

export const useLayoutWizard = create<{
  request: WizardRequest | null;
  open: (request: WizardRequest) => void;
  close: () => void;
}>()((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));
