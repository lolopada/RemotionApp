import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Base SQLite intégrée à Node (node:sqlite) : aucune dépendance, un seul
 * fichier `data/montage.db` à sauvegarder.
 */
export type Db = DatabaseSync;

/** Migrations successives. Ne jamais modifier une migration déjà livrée : en ajouter une. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE projects (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    data            TEXT NOT NULL,
    width           INTEGER NOT NULL,
    height          INTEGER NOT NULL,
    fps             INTEGER NOT NULL,
    scene_count     INTEGER NOT NULL,
    duration_frames INTEGER NOT NULL,
    preview_scene   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );
  CREATE INDEX projects_user ON projects(user_id, updated_at DESC);

  -- Médias importés (image/audio/video) et vidéos exportées (export).
  CREATE TABLE files (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL,
    name             TEXT NOT NULL,
    mime             TEXT NOT NULL,
    size             INTEGER NOT NULL,
    filename         TEXT NOT NULL UNIQUE,
    project_id       TEXT,
    width            INTEGER,
    height           INTEGER,
    duration_seconds REAL,
    created_at       TEXT NOT NULL
  );
  CREATE INDEX files_user ON files(user_id, kind, created_at DESC);
  `,
  // 2 — Historique des versions des projets.
  `
  CREATE TABLE project_versions (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,      -- auto | manual | before-restore
    label           TEXT,
    name            TEXT NOT NULL,
    scene_count     INTEGER NOT NULL,
    duration_frames INTEGER NOT NULL,
    fps             INTEGER NOT NULL,
    hash            TEXT NOT NULL,      -- empreinte du contenu (évite les doublons)
    data            BLOB NOT NULL,      -- JSON du projet compressé (gzip)
    size            INTEGER NOT NULL,   -- taille du JSON non compressé
    created_at      TEXT NOT NULL
  );
  CREATE INDEX project_versions_project ON project_versions(project_id, created_at DESC);
  `,
  // 3 — « Mes modèles » : scènes enregistrées par l'utilisateur pour les réutiliser.
  `
  CREATE TABLE scene_templates (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    data       TEXT NOT NULL,      -- JSON de la scène
    width      INTEGER NOT NULL,   -- format et cadence du projet d'origine
    height     INTEGER NOT NULL,
    fps        INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX scene_templates_user ON scene_templates(user_id, created_at DESC);
  `,
];

export function openDb(file: string): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v] as string);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return db;
}
