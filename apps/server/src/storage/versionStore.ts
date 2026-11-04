import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  getProjectDurationInFrames,
  newId,
  type Project,
  ProjectSchema,
  type ProjectVersion,
  type ProjectVersionKind,
} from "@app/schema";
import type { Db } from "../db";

export interface VersionPolicy {
  /** Écart minimum entre deux versions automatiques. */
  intervalMs: number;
  /** Nombre de versions automatiques gardées par projet. */
  maxAuto: number;
}

type Row = {
  id: string;
  kind: ProjectVersionKind;
  label: string | null;
  name: string;
  scene_count: number;
  duration_frames: number;
  fps: number;
  size: number;
  created_at: string;
};

/** Empreinte du contenu, sans les dates (qui changent à chaque enregistrement). */
export function contentHash(project: Project): string {
  const { updatedAt: _u, createdAt: _c, ...content } = project;
  return createHash("sha1").update(JSON.stringify(content)).digest("hex");
}

/**
 * Historique des versions. Le contenu est stocké compressé (≈ 10× plus petit).
 * La propriété est toujours vérifiée via la table projects (user_id).
 */
export function createVersionStore(db: Db, policy: VersionPolicy) {
  const cols = "v.id, v.kind, v.label, v.name, v.scene_count, v.duration_frames, v.fps, v.size, v.created_at";
  const q = {
    insert: db.prepare(
      `INSERT INTO project_versions (id, project_id, kind, label, name, scene_count, duration_frames, fps, hash, data, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    latest: db.prepare(
      "SELECT created_at, hash FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
    ),
    list: db.prepare(
      `SELECT ${cols} FROM project_versions v JOIN projects p ON p.id = v.project_id
       WHERE v.project_id = ? AND p.user_id = ? ORDER BY v.created_at DESC`,
    ),
    get: db.prepare(
      `SELECT v.data FROM project_versions v JOIN projects p ON p.id = v.project_id
       WHERE v.id = ? AND v.project_id = ? AND p.user_id = ?`,
    ),
    one: db.prepare(
      `SELECT ${cols} FROM project_versions v JOIN projects p ON p.id = v.project_id
       WHERE v.id = ? AND v.project_id = ? AND p.user_id = ?`,
    ),
    label: db.prepare(
      `UPDATE project_versions SET label = ?, kind = 'manual'
       WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE id = ? AND user_id = ?)`,
    ),
    remove: db.prepare(
      `DELETE FROM project_versions
       WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE id = ? AND user_id = ?)`,
    ),
    prune: db.prepare(
      `DELETE FROM project_versions WHERE project_id = ? AND kind != 'manual' AND id NOT IN (
         SELECT id FROM project_versions WHERE project_id = ? AND kind != 'manual'
         ORDER BY created_at DESC LIMIT ?
       )`,
    ),
  };

  const toVersion = (r: Row): ProjectVersion => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    name: r.name,
    sceneCount: r.scene_count,
    durationInFrames: r.duration_frames,
    fps: r.fps,
    size: r.size,
    createdAt: r.created_at,
  });

  function insert(project: Project, kind: ProjectVersionKind, label: string | null, createdAt: string) {
    const json = JSON.stringify(project);
    const row: Row = {
      id: newId(),
      kind,
      label,
      name: project.name,
      scene_count: project.scenes.length,
      duration_frames: getProjectDurationInFrames(project),
      fps: project.fps,
      size: Buffer.byteLength(json),
      created_at: createdAt,
    };
    q.insert.run(
      row.id,
      project.id,
      kind,
      label,
      row.name,
      row.scene_count,
      row.duration_frames,
      row.fps,
      contentHash(project),
      gzipSync(json),
      row.size,
      createdAt,
    );
    q.prune.run(project.id, project.id, policy.maxAuto);
    return toVersion(row);
  }

  return {
    /**
     * Appelé juste AVANT d'écraser un projet avec une nouvelle version : garde
     * l'ancien état si la dernière version date d'assez longtemps. On capture
     * ainsi la fin de chaque séance d'édition, et un point régulier pendant
     * les longues séances.
     */
    autoSnapshot(previous: Project, now = Date.now()) {
      const latest = q.latest.get(previous.id) as { created_at: string; hash: string } | undefined;
      if (latest) {
        if (now - Date.parse(latest.created_at) < policy.intervalMs) return;
        if (latest.hash === contentHash(previous)) return; // rien n'a changé depuis
      }
      insert(previous, "auto", null, previous.updatedAt);
    },

    /** Version nommée (ou « avant restauration ») de l'état donné, datée de maintenant. */
    create(project: Project, kind: ProjectVersionKind, label: string | null) {
      return insert(project, kind, label, new Date().toISOString());
    },

    list: (userId: string, projectId: string) => (q.list.all(projectId, userId) as Row[]).map(toVersion),

    getProject(userId: string, projectId: string, versionId: string): Project | null {
      const row = q.get.get(versionId, projectId, userId) as { data: Uint8Array } | undefined;
      if (!row) return null;
      const parsed = ProjectSchema.safeParse(JSON.parse(gunzipSync(row.data).toString("utf8")));
      return parsed.success ? parsed.data : null;
    },

    /** Nommer une version la rend « manuelle » : elle n'est plus supprimée automatiquement. */
    setLabel(userId: string, projectId: string, versionId: string, label: string): ProjectVersion | null {
      q.label.run(label, versionId, projectId, userId);
      const row = q.one.get(versionId, projectId, userId) as Row | undefined;
      return row ? toVersion(row) : null;
    },

    remove: (userId: string, projectId: string, versionId: string) =>
      Number(q.remove.run(versionId, projectId, userId).changes) > 0,
  };
}

export type VersionStore = ReturnType<typeof createVersionStore>;
