import { mkdirSync } from "node:fs";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { createAccounts } from "./auth/accounts";
import { type AppEnv, requireUser, sameOrigin } from "./auth/middleware";
import type { AppConfig } from "./config";
import { openDb } from "./db";
import { authRoutes } from "./routes/auth";
import { assetRoutes, videoRoutes } from "./routes/files";
import { projectRoutes } from "./routes/projects";
import { templateRoutes } from "./routes/templates";
import { createFileStore } from "./storage/fileStore";
import { createProjectStore } from "./storage/projectStore";
import { createTemplateStore } from "./storage/templateStore";
import { createVersionStore } from "./storage/versionStore";

/**
 * Construit l'application (séparé de index.ts pour pouvoir la tester).
 * Le serveur ne fait AUCUN rendu vidéo : il gère les comptes, stocke les
 * projets, les médias et les vidéos exportées.
 */
export function createApp(
  config: Pick<
    AppConfig,
    | "dataDir"
    | "maxUploadBytes"
    | "maxExportBytes"
    | "allowSignup"
    | "sessionDays"
    | "versionIntervalMs"
    | "maxAutoVersions"
  >,
  opts: { log?: boolean } = {},
) {
  const db = openDb(path.join(config.dataDir, "montage.db"));
  const filesDir = path.join(config.dataDir, "files");
  mkdirSync(filesDir, { recursive: true });
  const accounts = createAccounts(db, { sessionDays: config.sessionDays });
  const versions = createVersionStore(db, { intervalMs: config.versionIntervalMs, maxAuto: config.maxAutoVersions });
  const projects = createProjectStore(db, versions);
  const files = createFileStore(db, filesDir);
  const templates = createTemplateStore(db);
  const auth = requireUser(accounts);

  const app = new Hono<AppEnv>();
  if (opts.log) app.use(logger());
  app.use("/api/*", sameOrigin);

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.route("/api/auth", authRoutes(accounts, config));

  app.use("/api/projects/*", auth);
  app.use("/api/assets/*", auth);
  app.use("/api/videos/*", auth);
  app.use("/api/templates/*", auth);
  app.route("/api/projects", projectRoutes(projects, versions));
  app.route("/api/assets", assetRoutes(files, config.maxUploadBytes));
  app.route("/api/videos", videoRoutes(files, config.maxExportBytes));
  app.route("/api/templates", templateRoutes(templates));

  // Fichiers privés : servis uniquement à leur propriétaire (cookie de session).
  // serveStatic gère les requêtes Range (lecture/avance rapide des vidéos).
  app.use(
    "/files/:filename",
    auth,
    async (c, next) => {
      if (files.ownerOf(c.req.param("filename") ?? "") !== c.var.user.id) return c.json({ error: "Introuvable" }, 404);
      await next();
      if (c.res.ok) c.header("Cache-Control", "private, max-age=31536000, immutable");
    },
    serveStatic({
      root: path.relative(process.cwd(), filesDir) || ".",
      rewriteRequestPath: (p) => p.replace(/^\/files/, ""),
    }),
  );

  // Ménage des sessions expirées, une fois par jour.
  const timer = setInterval(() => accounts.purgeExpiredSessions(), 86_400_000);
  timer.unref();

  const close = () => {
    clearInterval(timer);
    db.close();
  };
  return { app, db, close };
}
