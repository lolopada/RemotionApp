import { newId, SceneSchema, type SceneTemplate } from "@app/schema";
import type { Db } from "../db";

/** Nombre maximal de modèles par compte (garde-fou). */
export const MAX_TEMPLATES = 200;

/** « Mes modèles » : scènes réutilisables, propres à chaque compte. */
export function createTemplateStore(db: Db) {
  const q = {
    list: db.prepare(
      "SELECT id, name, data, width, height, fps, created_at FROM scene_templates WHERE user_id = ? ORDER BY created_at DESC",
    ),
    count: db.prepare("SELECT COUNT(*) AS n FROM scene_templates WHERE user_id = ?"),
    insert: db.prepare(
      "INSERT INTO scene_templates (id, user_id, name, data, width, height, fps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    get: db.prepare(
      "SELECT id, name, data, width, height, fps, created_at FROM scene_templates WHERE id = ? AND user_id = ?",
    ),
    rename: db.prepare("UPDATE scene_templates SET name = ? WHERE id = ? AND user_id = ?"),
    remove: db.prepare("DELETE FROM scene_templates WHERE id = ? AND user_id = ?"),
  };

  type Row = { id: string; name: string; data: string; width: number; height: number; fps: number; created_at: string };
  const toTemplate = (r: Row): SceneTemplate => ({
    id: r.id,
    name: r.name,
    // Relu par le schéma : les modèles anciens reçoivent les nouveaux champs par défaut.
    scene: SceneSchema.parse(JSON.parse(r.data)),
    width: r.width,
    height: r.height,
    fps: r.fps,
    createdAt: r.created_at,
  });

  return {
    list: (userId: string) => (q.list.all(userId) as Row[]).map(toTemplate),
    count: (userId: string) => (q.count.get(userId) as { n: number }).n,
    create(userId: string, t: Omit<SceneTemplate, "id" | "createdAt">): SceneTemplate {
      const id = newId();
      const createdAt = new Date().toISOString();
      q.insert.run(id, userId, t.name, JSON.stringify(t.scene), t.width, t.height, t.fps, createdAt);
      return { ...t, id, createdAt };
    },
    rename(userId: string, id: string, name: string): SceneTemplate | null {
      q.rename.run(name, id, userId);
      const row = q.get.get(id, userId) as Row | undefined;
      return row ? toTemplate(row) : null;
    },
    remove: (userId: string, id: string) => Number(q.remove.run(id, userId).changes) > 0,
  };
}
export type TemplateStore = ReturnType<typeof createTemplateStore>;
