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

/**
 * Version d'un projet dans l'historique.
 *  - auto : instantané pris automatiquement pendant l'édition
 *  - manual : version nommée par l'utilisateur (jamais supprimée automatiquement)
 *  - before-restore : état juste avant une restauration (pour pouvoir l'annuler)
 */
export type ProjectVersionKind = "auto" | "manual" | "before-restore";

export interface ProjectVersion {
  id: string;
  kind: ProjectVersionKind;
  label: string | null;
  name: string;
  sceneCount: number;
  durationInFrames: number;
  fps: number;
  /** Taille du projet (JSON), en octets. */
  size: number;
  createdAt: string;
}

/** Scène enregistrée dans « Mes modèles », avec le format du projet d'où elle vient. */
export interface SceneTemplate {
  id: string;
  name: string;
  scene: Scene;
  width: number;
  height: number;
  fps: number;
  createdAt: string;
}
