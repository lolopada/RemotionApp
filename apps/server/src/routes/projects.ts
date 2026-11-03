import { ProjectSchema } from "@app/schema";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../auth/middleware";
import { NotOwnerError, type ProjectStore } from "../storage/projectStore";

/** Projets de l'utilisateur connecté (requireUser est appliqué en amont). */
export function projectRoutes(store: ProjectStore) {
  return (
    new Hono<AppEnv>()
      .get("/", (c) => c.json(store.list(c.var.user.id)))

      .get("/:id", (c) => {
        const project = store.get(c.var.user.id, c.req.param("id"));
        return project ? c.json(project) : c.json({ error: "Projet introuvable" }, 404);
      })

      // PUT = création ou mise à jour (l'id est choisi côté client).
      .put("/:id", bodyLimit({ maxSize: 20 * 1024 * 1024 }), async (c) => {
        const parsed = ProjectSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) {
          return c.json({ error: "Projet invalide", issues: parsed.error.issues.slice(0, 20) }, 400);
        }
        if (parsed.data.id !== c.req.param("id")) {
          return c.json({ error: "L'id du corps ne correspond pas à l'URL" }, 400);
        }
        try {
          return c.json(store.save(c.var.user.id, parsed.data));
        } catch (err) {
          if (err instanceof NotOwnerError) return c.json({ error: "Projet introuvable" }, 404);
          throw err;
        }
      })

      .delete("/:id", (c) =>
        store.remove(c.var.user.id, c.req.param("id"))
          ? c.body(null, 204)
          : c.json({ error: "Projet introuvable" }, 404),
      )
  );
}
