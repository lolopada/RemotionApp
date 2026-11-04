import { readFileSync } from "node:fs";
import path from "node:path";

/** Version du code en ligne (cf. apps/editor/vite.config.ts, qui écrit dist/version.json). */
export interface BuildInfo {
  version: string;
  /** Commit git court (« +modifs » si le dépôt avait des changements non validés), ou « dev ». */
  commit: string;
  /** Date du build (ISO), null hors build. */
  builtAt: string | null;
}

/**
 * Lit le version.json du build de l'éditeur ; à défaut (développement, pas de build),
 * la version du package.json racine avec le commit « dev ».
 */
export function readBuildInfo(editorDist: string, repoRoot: string): BuildInfo {
  try {
    const info = JSON.parse(readFileSync(path.join(editorDist, "version.json"), "utf8")) as Partial<BuildInfo>;
    if (typeof info.version === "string" && typeof info.commit === "string") {
      return { version: info.version, commit: info.commit, builtAt: info.builtAt ?? null };
    }
  } catch {
    // pas de build : on retombe sur le package.json
  }
  let version = "0.0.0";
  try {
    version =
      (JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as { version?: string }).version ??
      version;
  } catch {
    // dépôt incomplet
  }
  return { version, commit: "dev", builtAt: null };
}
