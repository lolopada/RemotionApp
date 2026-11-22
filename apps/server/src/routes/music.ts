import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "../auth/middleware";
import { creditFor, type Jamendo, MOODS, MusicError } from "../music/jamendo";
import { type FileStore, TooLargeError } from "../storage/fileStore";

/**
 * Propositions de musique (Jamendo) :
 *  GET  /api/music/status          → { enabled, moods }
 *  GET  /api/music/search?mood=&q=&instrumental=1&forSeconds=&offset=
 *  POST /api/music/import { trackId } → fichier audio ajouté à la bibliothèque (avec crédit)
 */
export function musicRoutes(jamendo: Jamendo, files: FileStore, maxUploadBytes: number) {
  const fail = (err: unknown) => {
    if (err instanceof MusicError) return { body: { error: err.message }, status: err.status };
    throw err;
  };

  return new Hono<AppEnv>()
    .get("/status", (c) =>
      c.json({
        enabled: jamendo.enabled,
        moods: Object.entries(MOODS).map(([id, m]) => ({ id, label: m.label })),
      }),
    )

    .get("/search", async (c) => {
      const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);
      try {
        const result = await jamendo.search({
          mood: c.req.query("mood") || undefined,
          q: c.req.query("q") || undefined,
          instrumental: c.req.query("instrumental") === "1",
          forSeconds: num(c.req.query("forSeconds")),
          offset: num(c.req.query("offset")),
        });
        // Les recherches changent peu : le navigateur peut les garder quelques minutes.
        c.header("Cache-Control", "private, max-age=300");
        return c.json(result);
      } catch (err) {
        const { body, status } = fail(err);
        return c.json(body, status);
      }
    })

    .post("/import", bodyLimit({ maxSize: 10_000 }), async (c) => {
      const { trackId } = (await c.req.json().catch(() => ({}))) as { trackId?: unknown };
      if (typeof trackId !== "string" && typeof trackId !== "number") {
        return c.json({ error: "Morceau manquant" }, 400);
      }
      const id = String(trackId);
      const userId = c.var.user.id;
      // Déjà dans la bibliothèque : on le réutilise.
      const existing = files.findBySource(userId, `jamendo:${id}`);
      if (existing) return c.json(existing);
      try {
        const { track, downloadUrl } = await jamendo.track(id);
        if (!track.downloadable || !downloadUrl) {
          return c.json({ error: "L'artiste n'autorise pas le téléchargement de ce morceau" }, 403);
        }
        const res = await jamendo.download(downloadUrl);
        const declared = Number(res.headers.get("content-length"));
        if (declared > maxUploadBytes) return c.json({ error: "Morceau trop lourd" }, 413);
        const file = await files.saveDownloaded(
          userId,
          res.body as ReadableStream<Uint8Array>,
          "audio/mpeg",
          maxUploadBytes,
          {
            name: `${track.title} – ${track.artist}`,
            durationSeconds: track.durationSeconds || null,
            sourceKey: `jamendo:${track.id}`,
            sourceUrl: track.pageUrl,
            credit: creditFor(track),
          },
        );
        return c.json(file, 201);
      } catch (err) {
        if (err instanceof TooLargeError) return c.json({ error: "Morceau trop lourd" }, 413);
        const { body, status } = fail(err);
        return c.json(body, status);
      }
    });
}
