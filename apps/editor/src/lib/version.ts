import { useEffect, useState } from "react";

/** Version de ce build de l'éditeur (injectée par vite.config.ts). */
export interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string | null;
}

declare const __BUILD_INFO__: BuildInfo | undefined;

export const BUILD: BuildInfo =
  typeof __BUILD_INFO__ !== "undefined" ? __BUILD_INFO__ : { version: "0.0.0", commit: "dev", builtAt: null };

/** « v1.0.0 · a1b2c3d · 04/11/2026 19:30 » */
export function formatBuild(b: BuildInfo): string {
  const date = b.builtAt
    ? new Date(b.builtAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : null;
  return [`v${b.version}`, b.commit, date].filter(Boolean).join(" · ");
}

/** Deux builds différents ? (même commit reconstruit = même version, pas d'alerte) */
export const isSameBuild = (a: BuildInfo, b: BuildInfo) => a.version === b.version && a.commit === b.commit;

/**
 * Version en ligne sur le serveur, relue au retour sur l'onglet et toutes les 5 minutes.
 * Sert à proposer de recharger quand une mise à jour a été installée pendant que la page
 * était ouverte (ou quand le navigateur a gardé l'ancienne page en cache).
 */
export function useServerBuild(): BuildInfo | null {
  const [server, setServer] = useState<BuildInfo | null>(null);
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = (await res.json()) as Partial<BuildInfo>;
        if (!stop && typeof json.version === "string" && typeof json.commit === "string") {
          setServer({ version: json.version, commit: json.commit, builtAt: json.builtAt ?? null });
        }
      } catch {
        // hors ligne : on réessaiera
      }
    };
    void check();
    const timer = setInterval(() => void check(), 5 * 60_000);
    const onFocus = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  return server;
}

/** Une autre version que celle de cette page est en ligne (le serveur de dev « dev » est ignoré). */
export function useNewVersionAvailable(): BuildInfo | null {
  const server = useServerBuild();
  if (!server || server.commit === "dev" || BUILD.commit === "dev") return null;
  return isSameBuild(server, BUILD) ? null : server;
}
