import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const env = process.env;

/** Toute la configuration passe par des variables d'environnement. */
export const config = {
  /** Racine du dépôt (package.json avec le numéro de version). */
  repoRoot,
  port: Number(env.PORT ?? 3001),
  host: env.HOST ?? "0.0.0.0",
  isProduction: env.NODE_ENV === "production",
  /** Base SQLite + fichiers des utilisateurs. À sauvegarder. */
  dataDir: path.resolve(env.DATA_DIR ?? path.join(repoRoot, "data")),
  /** Build de l'éditeur, servi par ce serveur en production. */
  editorDist: path.resolve(env.EDITOR_DIST ?? path.join(repoRoot, "apps/editor/dist")),
  /** Taille max d'un média importé (photo, musique). */
  maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 200) * 1024 * 1024,
  /** Taille max d'une vidéo exportée envoyée au serveur. */
  maxExportBytes: Number(env.MAX_EXPORT_MB ?? 2048) * 1024 * 1024,
  /** false = plus de création de compte (les comptes existants marchent toujours). */
  allowSignup: (env.ALLOW_SIGNUP ?? "true") !== "false",
  sessionDays: Number(env.SESSION_DAYS ?? 60),
  /** Écart minimum entre deux versions automatiques d'un projet. */
  versionIntervalMs: Number(env.VERSION_INTERVAL_MINUTES ?? 10) * 60_000,
  /** Versions automatiques gardées par projet (les versions nommées sont toujours gardées). */
  maxAutoVersions: Number(env.MAX_AUTO_VERSIONS ?? 50),
};

export type AppConfig = typeof config;
