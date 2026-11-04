import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const api = process.env.API_URL ?? "http://localhost:3001";

/** Commit git du code construit : MONTAGE_COMMIT (posé par deploy/install.sh), sinon git, sinon « dev ». */
function gitCommit(): string {
  if (process.env.MONTAGE_COMMIT) return process.env.MONTAGE_COMMIT;
  try {
    const run = (cmd: string) =>
      execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    return run("git rev-parse --short HEAD") + (run("git status --porcelain") ? "+modifs" : "");
  } catch {
    return "dev";
  }
}

/**
 * Numéro de version affiché sur le site et renvoyé par /api/health : version du
 * package.json racine + commit + date du build. Écrit aussi dans dist/version.json.
 */
const buildInfo = {
  version: (JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string })
    .version,
  commit: gitCommit(),
  builtAt: new Date().toISOString(),
};

const versionFile = (): Plugin => ({
  name: "montage-version",
  apply: "build",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: `${JSON.stringify(buildInfo, null, 2)}\n` });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile()],
  define: { __BUILD_INFO__: JSON.stringify(buildInfo) },
  // Remotion + Mediabunny pèsent ~400 ko gzip ; l'export est chargé à la demande.
  build: { chunkSizeWarningLimit: 1600 },
  server: {
    port: 5173,
    // En dev, l'API et les médias passent par Vite : même origine qu'en prod.
    proxy: {
      "/api": api,
      "/files": api,
    },
  },
});
