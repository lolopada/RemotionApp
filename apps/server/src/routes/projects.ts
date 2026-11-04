import { ProjectSchema } from "@app/schema";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../auth/middleware";
import { NotOwnerError, type ProjectStore } from "../storage/projectStore";
import type { VersionStore } from "../storage/versionStore";

const readLabel = async (c: { req: { json: () => Promise<unknown> } }) => {
  const body = (await c.req.json().catch(() => ({}))) as { label?: unknown };
  return typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 120) : null;
};

/** Projets de l'utilisateur connecté (requireUser est appliqué en amont). */
export function projectRoutes(store: ProjectStore, versions: VersionStore) {
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

      // --- Historique des versions
      .get("/:id/versions", (c) => {
        if (!store.get(c.var.user.id, c.req.param("id"))) return c.json({ error: "Projet introuvable" }, 404);
        return c.json(versions.list(c.var.user.id, c.req.param("id")));
      })

      .post("/:id/versions", bodyLimit({ maxSize: 10_000 }), async (c) => {
        const version = store.createVersion(c.var.user.id, c.req.param("id"), await readLabel(c));
        return version ? c.json(version, 201) : c.json({ error: "Projet introuvable" }, 404);
      })

      .get("/:id/versions/:vid", (c) => {
        const project = versions.getProject(c.var.user.id, c.req.param("id"), c.req.param("vid"));
        return project ? c.json(project) : c.json({ error: "Version introuvable" }, 404);
      })

      .patch("/:id/versions/:vid", bodyLimit({ maxSize: 10_000 }), async (c) => {
        const label = await readLabel(c);
        if (!label) return c.json({ error: "Nom manquant" }, 400);
        const version = versions.setLabel(c.var.user.id, c.req.param("id"), c.req.param("vid"), label);
        return version ? c.json(version) : c.json({ error: "Version introuvable" }, 404);
      })

      .delete("/:id/versions/:vid", (c) =>
        versions.remove(c.var.user.id, c.req.param("id"), c.req.param("vid"))
          ? c.body(null, 204)
          : c.json({ error: "Version introuvable" }, 404),
      )

      .post("/:id/versions/:vid/restore", (c) => {
        const project = store.restore(c.var.user.id, c.req.param("id"), c.req.param("vid"));
        return project ? c.json(project) : c.json({ error: "Version introuvable" }, 404);
      })
  );
}
