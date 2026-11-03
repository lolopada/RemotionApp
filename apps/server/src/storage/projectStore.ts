import { getProjectDurationInFrames, type Project, ProjectSchema, type ProjectSummary } from "@app/schema";
import type { Db } from "../db";

export class NotOwnerError extends Error {}

/**
 * Projets en SQLite : le JSON complet dans `data`, plus quelques colonnes
 * calculées pour afficher la liste sans tout relire.
 */
export function createProjectStore(db: Db) {
  const q = {
    list: db.prepare(
      `SELECT id, name, created_at, updated_at, width, height, fps, scene_count, duration_frames, preview_scene
       FROM projects WHERE user_id = ? ORDER BY updated_at DESC`,
    ),
    get: db.prepare("SELECT data FROM projects WHERE id = ? AND user_id = ?"),
    owner: db.prepare("SELECT user_id FROM projects WHERE id = ?"),
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
        previewScene: r.preview_scene ? JSON.parse(r.preview_scene) : null,
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
      const owner = q.owner.get(project.id) as { user_id: string } | undefined;
      if (owner && owner.user_id !== userId) throw new NotOwnerError();
      const now = new Date().toISOString();
      const saved: Project = { ...project, updatedAt: now, createdAt: owner ? project.createdAt : now };
      q.upsert.run(
        saved.id,
        userId,
        saved.name,
        JSON.stringify(saved),
        saved.width,
        saved.height,
        saved.fps,
        saved.scenes.length,
        getProjectDurationInFrames(saved),
        saved.scenes[0] ? JSON.stringify(saved.scenes[0]) : null,
        saved.createdAt,
        saved.updatedAt,
      );
      return saved;
    },

    remove(userId: string, id: string): boolean {
      return Number(q.remove.run(id, userId).changes) > 0;
    },
  };
}

export type ProjectStore = ReturnType<typeof createProjectStore>;
