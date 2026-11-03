import { useSyncExternalStore } from "react";

/**
 * Routeur minimal (pas de dépendance) :
 *   /          → mes projets
 *   /videos    → mes vidéos
 *   /p/:id     → éditeur
 */
export type Route = { name: "home" } | { name: "videos" } | { name: "editor"; projectId: string };

export function parseRoute(pathname: string): Route {
  const editor = pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/);
  if (editor?.[1]) return { name: "editor", projectId: editor[1] };
  if (pathname.startsWith("/videos")) return { name: "videos" };
  return { name: "home" };
}

const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};
window.addEventListener("popstate", notify);

/** Permet de bloquer une navigation (ex. : attendre la fin de la sauvegarde). */
let beforeNavigate: (() => Promise<void>) | null = null;
export const setBeforeNavigate = (fn: (() => Promise<void>) | null) => {
  beforeNavigate = fn;
};

export async function navigate(path: string) {
  if (path === window.location.pathname) return;
  if (beforeNavigate) await beforeNavigate();
  window.history.pushState(null, "", path);
  notify();
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => window.location.pathname,
  );
  return parseRoute(pathname);
}
