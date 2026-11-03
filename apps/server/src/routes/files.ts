import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../auth/middleware";
import { type FileStore, isAcceptedExport, isAcceptedMedia, TooLargeError } from "../storage/fileStore";

/** Médias importés : photos, musiques, vidéos sources. */
export function assetRoutes(store: FileStore, maxUploadBytes: number) {
  return new Hono<AppEnv>()
    .get("/", (c) => {
      const kind = c.req.query("kind");
      const all = ["image", "audio", "video"] as const;
      const kinds = all.filter((k) => !kind || k === kind);
      return c.json(kinds.flatMap((k) => store.list(c.var.user.id, k)));
    })

    .post(
      "/",
      bodyLimit({ maxSize: maxUploadBytes, onError: (c) => c.json({ error: "Fichier trop lourd" }, 413) }),
      async (c) => {
        const file = (await c.req.parseBody()).file;
        if (!(file instanceof File)) return c.json({ error: "Champ 'file' manquant" }, 400);
        if (!isAcceptedMedia(file.type)) return c.json({ error: `Type non accepté : ${file.type || "inconnu"}` }, 415);
        return c.json(await store.saveMedia(c.var.user.id, file), 201);
      },
    )

    .delete("/:id", async (c) =>
      (await store.remove(c.var.user.id, c.req.param("id")))
        ? c.body(null, 204)
        : c.json({ error: "Introuvable" }, 404),
    );
}

const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Vidéos exportées. L'éditeur envoie le MP4 en corps brut (pas de multipart),
 * avec les infos dans l'URL : POST /api/videos?name=…&projectId=…
 */
export function videoRoutes(store: FileStore, maxExportBytes: number) {
  return new Hono<AppEnv>()
    .get("/", (c) => c.json(store.list(c.var.user.id, "export")))

    .post("/", async (c) => {
      const mime = (c.req.header("content-type") ?? "").split(";")[0]?.trim() ?? "";
      if (!isAcceptedExport(mime)) return c.json({ error: "Seuls les MP4 et WebM sont acceptés" }, 415);
      const declared = num(c.req.header("content-length"));
      if (declared !== null && declared > maxExportBytes) return c.json({ error: "Vidéo trop lourde" }, 413);
      const body = c.req.raw.body;
      if (!body) return c.json({ error: "Corps vide" }, 400);
      try {
        const saved = await store.saveExport(c.var.user.id, body, mime, maxExportBytes, {
          name: c.req.query("name") ?? "Vidéo",
          projectId: c.req.query("projectId") ?? null,
          width: num(c.req.query("width")),
          height: num(c.req.query("height")),
          durationSeconds: num(c.req.query("duration")),
        });
        return c.json(saved, 201);
      } catch (err) {
        if (err instanceof TooLargeError) return c.json({ error: "Vidéo trop lourde" }, 413);
        throw err;
      }
    })

    .patch("/:id", bodyLimit({ maxSize: 10_000 }), async (c) => {
      const { name } = (await c.req.json().catch(() => ({}))) as { name?: unknown };
      if (typeof name !== "string" || !name.trim()) return c.json({ error: "Nom invalide" }, 400);
      const file = store.rename(c.var.user.id, c.req.param("id"), name.trim());
      return file ? c.json(file) : c.json({ error: "Introuvable" }, 404);
    })

    .delete("/:id", async (c) =>
      (await store.remove(c.var.user.id, c.req.param("id")))
        ? c.body(null, 204)
        : c.json({ error: "Introuvable" }, 404),
    );
}
