import {
  getProjectDurationInFrames,
  type Project,
  ProjectSchema,
  type ProjectSummary,
  type Scene,
  SceneSchema,
} from "@app/schema";
import type { Db } from "../db";
import type { VersionStore } from "./versionStore";

export class NotOwnerError extends Error {}

/**
 * Projets en SQLite : le JSON complet dans `data`, plus quelques colonnes
 * calculées pour afficher la liste sans tout relire.
 * Chaque enregistrement peut d'abord garder l'ancien état dans l'historique.
 */
export function createProjectStore(db: Db, versions: VersionStore) {
  const q = {
    list: db.prepare(
      `SELECT id, name, created_at, updated_at, width, height, fps, scene_count, duration_frames, preview_scene
       FROM projects WHERE user_id = ? ORDER BY updated_at DESC`,
    ),
    get: db.prepare("SELECT data FROM projects WHERE id = ? AND user_id = ?"),
    current: db.prepare("SELECT user_id, data FROM projects WHERE id = ?"),
    upsert: db.prepare(
      `INSERT INTO projects (id, user_id, name, data, width, height, fps, scene_count, duration_frames, preview_scene, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, data = excluded.data, width = excluded.width, height = excluded.height,
         fps = excluded.fps, scene_count = excluded.scene_count, duration_frames = excluded.duration_frames,
         preview_scene = excluded.preview_scene, updated_at = excluded.updated_at
       WHERE projects.user_id = excluded.user_id`,
    ),
    remove: db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?"),
  };

  type Row = {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    width: number;
    height: number;
    fps: number;
    scene_count: number;
    duration_frames: number;
    preview_scene: string | null;
  };

  function write(userId: string, p: Project) {
    q.upsert.run(
      p.id,
      userId,
      p.name,
      JSON.stringify(p),
      p.width,
      p.height,
      p.fps,
      p.scenes.length,
      getProjectDurationInFrames(p),
      p.scenes[0] ? JSON.stringify(p.scenes[0]) : null,
      p.createdAt,
      p.updatedAt,
    );
  }

  /** Vignette : repasse par le schéma, sinon un ancien projet n'a pas les champs ajoutés depuis. */
  const readPreview = (json: string | null): Scene | null => {
    if (!json) return null;
    const parsed = SceneSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  };

  return {
    list(userId: string): ProjectSummary[] {
      return (q.list.all(userId) as Row[]).map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        width: r.width,
        height: r.height,
        fps: r.fps,
        sceneCount: r.scene_count,
        durationInFrames: r.duration_frames,
        previewScene: readPreview(r.preview_scene),
      }));
    },

    get(userId: string, id: string): Project | null {
      const row = q.get.get(id, userId) as { data: string } | undefined;
      if (!row) return null;
      // Repasse par le schéma : applique les valeurs par défaut des champs ajoutés depuis.
      const parsed = ProjectSchema.safeParse(JSON.parse(row.data));
      return parsed.success ? parsed.data : null;
    },

    /** Crée ou met à jour. Refuse d'écraser le projet d'un autre utilisateur. */
    save(userId: string, project: Project): Project {
      const current = q.current.get(project.id) as { user_id: string; data: string } | undefined;
      if (current && current.user_id !== userId) throw new NotOwnerError();
      const now = new Date().toISOString();
      const saved: Project = { ...project, updatedAt: now, createdAt: current ? project.createdAt : now };

      db.exec("BEGIN");
      try {
        if (current) {
          const previous = ProjectSchema.safeParse(JSON.parse(current.data));
          if (previous.success) versions.autoSnapshot(previous.data);
        }
        write(userId, saved);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      return saved;
    },

    /** Crée une version nommée de l'état actuel du projet. */
    createVersion(userId: string, id: string, label: string | null) {
      const project = this.get(userId, id);
      return project ? versions.create(project, "manual", label) : null;
    },

    /**
     * Remet le projet dans l'état d'une version. L'état actuel est d'abord
     * gardé (« avant restauration ») : une restauration s'annule comme une autre.
     */
    restore(userId: string, id: string, versionId: string): Project | null {
      const current = this.get(userId, id);
      const target = versions.getProject(userId, id, versionId);
      if (!current || !target) return null;
      const restored: Project = { ...target, id, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
      db.exec("BEGIN");
      try {
        versions.create(current, "before-restore", null);
        write(userId, restored);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      return restored;
    },

    remove(userId: string, id: string): boolean {
      return Number(q.remove.run(id, userId).changes) > 0;
    },
  };
}

export type ProjectStore = ReturnType<typeof createProjectStore>;
