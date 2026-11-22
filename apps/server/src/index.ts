import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app";
import { readBuildInfo } from "./buildInfo";
import { config } from "./config";

const buildInfo = readBuildInfo(config.editorDist, config.repoRoot);
const { app } = createApp(config, { log: true, buildInfo });

// En production, ce même serveur sert l'éditeur (même origine : pas de CORS,
// le cookie de session suit, et les images ne « salissent » pas le canvas à l'export).
if (config.isProduction && existsSync(config.editorDist)) {
  // Cache : les fichiers de /assets ont un nom qui change à chaque build (cache long) ;
  // la page et version.json sont revalidés à chaque visite, pour charger tout de suite
  // la nouvelle version après une mise à jour.
  app.use("/*", async (c, next) => {
    await next();
    if (!c.res.ok || c.req.path.startsWith("/api/") || c.req.path.startsWith("/files/")) return;
    c.header("Cache-Control", c.req.path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
  });
  app.use("/*", serveStatic({ root: path.relative(process.cwd(), config.editorDist) || "." }));
  const indexHtml = await readFile(path.join(config.editorDist, "index.html"), "utf8");
  app.get("*", (c) => c.html(indexHtml)); // routes de l'éditeur (/p/…)
}

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(
    `Montage v${buildInfo.version} (${buildInfo.commit}) prêt sur http://localhost:${info.port} (données : ${config.dataDir})`,
  );
  if (!config.allowSignup) console.log("Inscriptions fermées (ALLOW_SIGNUP=false).");
  console.log(
    config.jamendoClientId
      ? "Propositions de musique Jamendo : activées."
      : "Propositions de musique Jamendo : désactivées (JAMENDO_CLIENT_ID absent).",
  );
});
