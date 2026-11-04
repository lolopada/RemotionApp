import { SceneSchema } from "@app/schema";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../auth/middleware";
import { MAX_TEMPLATES, type TemplateStore } from "../storage/templateStore";

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Valide le corps d'un nouveau modèle (la scène passe par le schéma commun). */
function parseNewTemplate(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  const scene = SceneSchema.safeParse(b.scene);
  if (!name || !scene.success) return null;
  if (!isInt(b.width, 16, 3840) || !isInt(b.height, 16, 3840) || !isInt(b.fps, 1, 60)) return null;
  return { name, scene: scene.data, width: b.width, height: b.height, fps: b.fps };
}

/** « Mes modèles » de l'utilisateur connecté (requireUser est appliqué en amont). */
export function templateRoutes(store: TemplateStore) {
  return new Hono<AppEnv>()
    .get("/", (c) => c.json(store.list(c.var.user.id)))

    .post("/", bodyLimit({ maxSize: 2 * 1024 * 1024 }), async (c) => {
      const parsed = parseNewTemplate(await c.req.json().catch(() => null));
      if (!parsed) return c.json({ error: "Modèle invalide" }, 400);
      if (store.count(c.var.user.id) >= MAX_TEMPLATES) {
        return c.json({ error: `Limite de ${MAX_TEMPLATES} modèles atteinte` }, 409);
      }
      return c.json(store.create(c.var.user.id, parsed), 201);
    })

    .patch("/:id", bodyLimit({ maxSize: 10_000 }), async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { name?: unknown };
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      if (!name) return c.json({ error: "Nom manquant" }, 400);
      const t = store.rename(c.var.user.id, c.req.param("id"), name);
      return t ? c.json(t) : c.json({ error: "Modèle introuvable" }, 404);
    })

    .delete("/:id", (c) =>
      store.remove(c.var.user.id, c.req.param("id")) ? c.body(null, 204) : c.json({ error: "Modèle introuvable" }, 404),
    );
}
