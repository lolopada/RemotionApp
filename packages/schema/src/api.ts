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
  /** Crédit à citer (musique importée depuis Jamendo…), null pour un fichier à soi. */
  credit: string | null;
  /** Page d'origine (fiche du morceau sur Jamendo…). */
  sourceUrl: string | null;
}

/** Licence Creative Commons d'un morceau, lue depuis son adresse (ex. « by-nc-sa 3.0 »). */
export interface MusicLicense {
  /** « by », « by-sa », « by-nc », « by-nc-nd »… ; « » si inconnue. */
  code: string;
  /** « CC BY-NC-SA 3.0 » */
  label: string;
  url: string;
}

/** Morceau proposé par la recherche de musique (Jamendo). */
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  /** Pochette (petite image), « » si absente. */
  cover: string;
  /** Flux d'écoute (MP3), lu directement depuis Jamendo. */
  previewUrl: string;
  /** Fiche du morceau sur Jamendo. */
  pageUrl: string;
  license: MusicLicense;
  /** L'artiste autorise le téléchargement (sinon le morceau ne peut pas être ajouté). */
  downloadable: boolean;
  instrumental: boolean;
  /** Genres et ambiances indiqués par Jamendo. */
  tags: string[];
}

export interface MusicSearchResult {
  tracks: MusicTrack[];
  /** Position de la page suivante, null s'il n'y en a plus. */
  nextOffset: number | null;
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
