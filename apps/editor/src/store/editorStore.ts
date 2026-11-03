import {
  type AudioClip,
  duplicateScene as cloneScene,
  createScene,
  type Layer,
  newId,
  type Project,
  type Scene,
} from "@app/schema";
import { temporal } from "zundo";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

/** pending = modifs pas encore envoyées ; error/offline = réessai automatique en cours. */
export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "offline";

interface EditorState {
  project: Project;
  selectedSceneId: string;
  selectedLayerId: string | null;
  selectedAudioId: string | null;
  saveStatus: SaveStatus;
}

interface EditorActions {
  loadProject(project: Project): void;
  renameProject(name: string): void;
  setSaveStatus(status: SaveStatus): void;

  selectScene(id: string): void;
  selectLayer(id: string | null): void;
  selectAudio(id: string | null): void;

  addScene(scene?: Scene, afterId?: string): void;
  duplicateScene(id: string): void;
  removeScene(id: string): void;
  moveScene(id: string, toIndex: number): void;
  updateScene(id: string, recipe: (scene: Scene) => void): void;

  addLayer(layer: Layer, sceneId?: string): void;
  updateLayer(id: string, recipe: (layer: Layer) => void): void;
  removeLayer(id: string): void;
  duplicateLayer(id: string): void;
  /** +1 = vers l'avant, -1 = vers l'arrière. */
  moveLayer(id: string, direction: 1 | -1): void;

  addAudio(clip: AudioClip): void;
  updateAudio(id: string, recipe: (clip: AudioClip) => void): void;
  removeAudio(id: string): void;
}

export type EditorStore = EditorState & EditorActions;

function findLayer(project: Project, layerId: string) {
  for (const scene of project.scenes) {
    const index = scene.layers.findIndex((l) => l.id === layerId);
    if (index >= 0) return { scene, index, layer: scene.layers[index] as Layer };
  }
  return null;
}

/** Limite l'historique : une rafale de modifs (glisser, slider) = une seule étape d'annulation. */
function leadingThrottle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0;
  return (...args: A) => {
    const now = Date.now();
    if (now - last > ms) fn(...args);
    last = now;
  };
}

const placeholderProject = (): Project => ({
  version: 1,
  id: "loading",
  name: "",
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [createScene()],
  audio: [],
  createdAt: "",
  updatedAt: "",
});

export const useEditor = create<EditorStore>()(
  temporal(
    immer((set) => {
      const initial = placeholderProject();
      return {
        project: initial,
        selectedSceneId: initial.scenes[0]?.id ?? "",
        selectedLayerId: null,
        selectedAudioId: null,
        saveStatus: "idle",

        loadProject: (project) =>
          set((s) => {
            s.project = project;
            s.selectedSceneId = project.scenes[0]?.id ?? "";
            s.selectedLayerId = null;
            s.selectedAudioId = null;
          }),
        renameProject: (name) =>
          set((s) => {
            s.project.name = name;
          }),
        setSaveStatus: (status) =>
          set((s) => {
            s.saveStatus = status;
          }),

        selectScene: (id) =>
          set((s) => {
            if (s.selectedSceneId !== id) s.selectedLayerId = null;
            s.selectedSceneId = id;
            s.selectedAudioId = null;
          }),
        selectLayer: (id) =>
          set((s) => {
            s.selectedLayerId = id;
            s.selectedAudioId = null;
            if (id) {
              const hit = findLayer(s.project, id);
              if (hit) s.selectedSceneId = hit.scene.id;
            }
          }),
        selectAudio: (id) =>
          set((s) => {
            s.selectedAudioId = id;
            if (id) s.selectedLayerId = null;
          }),

        addScene: (scene, afterId) =>
          set((s) => {
            const newScene = scene ?? createScene();
            const after = afterId ?? s.selectedSceneId;
            const index = s.project.scenes.findIndex((sc) => sc.id === after);
            s.project.scenes.splice(index >= 0 ? index + 1 : s.project.scenes.length, 0, newScene);
            s.selectedSceneId = newScene.id;
            s.selectedLayerId = null;
          }),
        duplicateScene: (id) =>
          set((s) => {
            const index = s.project.scenes.findIndex((sc) => sc.id === id);
            const scene = s.project.scenes[index];
            if (!scene) return;
            const copy = cloneScene(JSON.parse(JSON.stringify(scene)) as Scene);
            s.project.scenes.splice(index + 1, 0, copy);
            s.selectedSceneId = copy.id;
            s.selectedLayerId = null;
          }),
        removeScene: (id) =>
          set((s) => {
            if (s.project.scenes.length <= 1) return; // toujours au moins une scène
            const index = s.project.scenes.findIndex((sc) => sc.id === id);
            if (index < 0) return;
            s.project.scenes.splice(index, 1);
            if (s.selectedSceneId === id) {
              s.selectedSceneId = (s.project.scenes[Math.max(0, index - 1)] as Scene).id;
              s.selectedLayerId = null;
            }
          }),
        moveScene: (id, toIndex) =>
          set((s) => {
            const from = s.project.scenes.findIndex((sc) => sc.id === id);
            if (from < 0) return;
            const [scene] = s.project.scenes.splice(from, 1);
            if (!scene) return;
            const to = Math.max(0, Math.min(toIndex, s.project.scenes.length));
            s.project.scenes.splice(to, 0, scene);
          }),
        updateScene: (id, recipe) =>
          set((s) => {
            const scene = s.project.scenes.find((sc) => sc.id === id);
            if (scene) recipe(scene);
          }),

        addLayer: (layer, sceneId) =>
          set((s) => {
            const scene = s.project.scenes.find((sc) => sc.id === (sceneId ?? s.selectedSceneId));
            if (!scene) return;
            scene.layers.push(layer);
            s.selectedSceneId = scene.id;
            s.selectedLayerId = layer.id;
            s.selectedAudioId = null;
          }),
        updateLayer: (id, recipe) =>
          set((s) => {
            const hit = findLayer(s.project, id);
            if (hit) recipe(hit.layer);
          }),
        removeLayer: (id) =>
          set((s) => {
            const hit = findLayer(s.project, id);
            if (!hit) return;
            hit.scene.layers.splice(hit.index, 1);
            if (s.selectedLayerId === id) s.selectedLayerId = null;
          }),
        duplicateLayer: (id) =>
          set((s) => {
            const hit = findLayer(s.project, id);
            if (!hit) return;
            const copy = JSON.parse(JSON.stringify(hit.layer)) as Layer;
            copy.id = newId();
            copy.transform.x += 40;
            copy.transform.y += 40;
            hit.scene.layers.splice(hit.index + 1, 0, copy);
            s.selectedLayerId = copy.id;
          }),
        moveLayer: (id, direction) =>
          set((s) => {
            const hit = findLayer(s.project, id);
            if (!hit) return;
            const to = hit.index + direction;
            if (to < 0 || to >= hit.scene.layers.length) return;
            const [layer] = hit.scene.layers.splice(hit.index, 1);
            if (layer) hit.scene.layers.splice(to, 0, layer);
          }),

        addAudio: (clip) =>
          set((s) => {
            s.project.audio.push(clip);
            s.selectedAudioId = clip.id;
            s.selectedLayerId = null;
          }),
        updateAudio: (id, recipe) =>
          set((s) => {
            const clip = s.project.audio.find((c) => c.id === id);
            if (clip) recipe(clip);
          }),
        removeAudio: (id) =>
          set((s) => {
            s.project.audio = s.project.audio.filter((c) => c.id !== id);
            if (s.selectedAudioId === id) s.selectedAudioId = null;
          }),
      };
    }),
    {
      // Seul le projet est annulable (pas la sélection ni l'état de sauvegarde).
      partialize: (state) => ({ project: state.project }),
      equality: (a, b) => a.project === b.project,
      limit: 100,
      handleSet: (handleSet) => leadingThrottle(handleSet, 400),
    },
  ),
);

/** Annuler / rétablir (Ctrl+Z / Ctrl+Maj+Z). */
export const useHistory = () => useEditor.temporal.getState();

// Sélecteurs pratiques
export const useProject = () => useEditor((s) => s.project);
export const useSelectedScene = () =>
  useEditor((s) => s.project.scenes.find((sc) => sc.id === s.selectedSceneId) ?? s.project.scenes[0]);
export const useSelectedLayer = () =>
  useEditor((s) => {
    if (!s.selectedLayerId) return null;
    return findLayer(s.project, s.selectedLayerId)?.layer ?? null;
  });
