import type { Scene, SceneTemplate } from "@app/schema";
import { create } from "zustand";
import { api } from "../../lib/api";

interface MyTemplatesState {
  items: SceneTemplate[];
  loaded: boolean;
  error: string | null;
  load(): Promise<void>;
  save(name: string, scene: Scene, format: { width: number; height: number; fps: number }): Promise<SceneTemplate>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * « Mes modèles » : scènes enregistrées dans le compte. Partagé entre l'inspecteur
 * (« Enregistrer comme modèle ») et l'onglet Modèles, qui se met à jour aussitôt.
 */
export const useMyTemplates = create<MyTemplatesState>()((set, get) => ({
  items: [],
  loaded: false,
  error: null,
  load: async () => {
    try {
      set({ items: await api.listTemplates(), loaded: true, error: null });
    } catch {
      set({ loaded: true, error: "Serveur injoignable : tes modèles ne peuvent pas être chargés." });
    }
  },
  save: async (name, scene, format) => {
    const created = await api.createTemplate({ name, scene, ...format });
    set({ items: [created, ...get().items] });
    return created;
  },
  rename: async (id, name) => {
    const updated = await api.renameTemplate(id, name);
    set({ items: get().items.map((t) => (t.id === id ? updated : t)) });
  },
  remove: async (id) => {
    await api.deleteTemplate(id);
    set({ items: get().items.filter((t) => t.id !== id) });
  },
}));
