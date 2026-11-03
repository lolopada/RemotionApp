import type { Scene } from "./project";

/** Types échangés entre l'éditeur et le serveur. */

export interface User {
  id: string;
  username: string;
  createdAt: string;
}

/** Résumé d'un projet pour la page « Mes projets ». */
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  fps: number;
  sceneCount: number;
  durationInFrames: number;
  /** Première scène, pour afficher une vignette. */
  previewScene: Scene | null;
}

/** image / audio / video = médias importés ; export = vidéo exportée depuis l'éditeur. */
export type FileKind = "image" | "audio" | "video" | "export";

export interface StoredFile {
  id: string;
  kind: FileKind;
  name: string;
  mime: string;
  size: number;
  /** URL privée (cookie de session requis). */
  url: string;
  projectId: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: string;
}
