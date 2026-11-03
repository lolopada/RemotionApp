import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app";
import { config } from "./config";

const { app } = createApp(config, { log: true });

// En production, ce même serveur sert l'éditeur (même origine : pas de CORS,
// le cookie de session suit, et les images ne « salissent » pas le canvas à l'export).
if (config.isProduction && existsSync(config.editorDist)) {
  app.use("/*", serveStatic({ root: path.relative(process.cwd(), config.editorDist) || "." }));
  const indexHtml = await readFile(path.join(config.editorDist, "index.html"), "utf8");
  app.get("*", (c) => c.html(indexHtml)); // routes de l'éditeur (/p/…)
}

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`Serveur prêt sur http://localhost:${info.port} (données : ${config.dataDir})`);
  if (!config.allowSignup) console.log("Inscriptions fermées (ALLOW_SIGNUP=false).");
});
