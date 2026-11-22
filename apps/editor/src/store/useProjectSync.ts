import { type Project, ProjectSchema } from "@app/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "../lib/api";
import { setBeforeNavigate } from "../lib/router";
import { local } from "../lib/storage";
import { useEditor } from "./editorStore";

/**
 * Sauvegarde automatique d'un projet ouvert dans l'éditeur :
 *  - chaque modification est copiée dans un brouillon local (localStorage, au plus
 *    toutes les 0,4 s : pendant un déplacement à la souris, on n'écrit pas tout le projet à
 *    chaque mouvement), puis envoyée au serveur après 1 s de calme (5 s max) ;
 *  - en cas d'échec (réseau, serveur arrêté), réessai automatique avec délai
 *    croissant, et au retour du réseau ;
 *  - envoi immédiat quand on quitte l'onglet ou l'éditeur ;
 *  - si l'onglet a été fermé avant l'envoi, le brouillon est restauré à la
 *    réouverture (tant que le projet n'a pas changé ailleurs entre-temps).
 */

const DEBOUNCE_MS = 1000;
/** Écart minimum entre deux écritures du brouillon local. */
const DRAFT_MS = 400;
const MAX_WAIT_MS = 5000;
const RETRY_DELAYS = [2000, 5000, 10_000, 30_000];
/** fetch keepalive (envoi à la fermeture de l'onglet) est limité à 64 Ko. */
const KEEPALIVE_LIMIT = 60_000;

interface Draft {
  project: Project;
  /** Version serveur sur laquelle le brouillon est basé. */
  baseUpdatedAt: string;
}

const draftKey = (id: string) => `montage:draft:${id}`;

function readDraft(id: string): Draft | null {
  const raw = local.get(draftKey(id));
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Draft;
    const parsed = ProjectSchema.safeParse(d.project);
    return parsed.success ? { project: parsed.data, baseUpdatedAt: d.baseUpdatedAt } : null;
  } catch {
    return null;
  }
}

function createSaver(projectId: string, initialServerVersion: string) {
  const { setSaveStatus } = useEditor.getState();
  let serverVersion = initialServerVersion;
  let dirty = false;
  let inFlight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstDirtyAt = 0;
  let attempt = 0;
  let stopped = false;

  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  const writeDraft = (project: Project) => {
    clearTimeout(draftTimer);
    draftTimer = undefined;
    local.set(draftKey(projectId), JSON.stringify({ project, baseUpdatedAt: serverVersion } satisfies Draft));
  };
  /** Brouillon écrit un peu plus tard, avec l'état du moment (une écriture pour une rafale de modifs). */
  const writeDraftSoon = () => {
    if (draftTimer !== undefined) return;
    draftTimer = setTimeout(() => {
      draftTimer = undefined;
      if (dirty) writeDraft(useEditor.getState().project);
    }, DRAFT_MS);
  };
  const clearDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = undefined;
    local.remove(draftKey(projectId));
  };

  const schedule = (delay: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), delay);
  };

  async function send(keepalive: boolean) {
    const project = useEditor.getState().project;
    dirty = false;
    setSaveStatus("saving");
    try {
      const body = JSON.stringify(project);
      const saved = await api.saveProject(project, { keepalive: keepalive && body.length < KEEPALIVE_LIMIT });
      serverVersion = saved.updatedAt;
      attempt = 0;
      if (dirty) {
        writeDraft(useEditor.getState().project); // rebasé sur la nouvelle version serveur
      } else {
        clearDraft();
        setSaveStatus("saved");
      }
    } catch (err) {
      dirty = true;
      if (err instanceof ApiError && err.status === 401) {
        // Session expirée : le brouillon local est gardé, il sera restauré après reconnexion.
        setSaveStatus("error");
        return;
      }
      setSaveStatus(err instanceof ApiError && err.status === 0 ? "offline" : "error");
      if (!stopped) schedule(RETRY_DELAYS[Math.min(attempt++, RETRY_DELAYS.length - 1)] as number);
    }
  }

  /** Envoie maintenant ce qui n'est pas encore enregistré (attend un envoi en cours). */
  async function flush(opts: { keepalive?: boolean } = {}) {
    clearTimeout(timer);
    // Brouillon à jour tout de suite (l'onglet peut se fermer avant la fin de l'envoi).
    if (dirty && draftTimer !== undefined) writeDraft(useEditor.getState().project);
    if (inFlight) await inFlight;
    if (!dirty) return;
    inFlight = send(opts.keepalive ?? false).finally(() => {
      inFlight = null;
    });
    await inFlight;
  }

  function onChange(_project: Project) {
    writeDraftSoon();
    if (!dirty) firstDirtyAt = Date.now();
    dirty = true;
    setSaveStatus("pending");
    // Debounce, mais sans jamais attendre plus de MAX_WAIT_MS pendant une longue édition.
    schedule(Math.max(0, Math.min(DEBOUNCE_MS, firstDirtyAt + MAX_WAIT_MS - Date.now())));
  }

  return {
    onChange,
    flush,
    hasUnsaved: () => dirty || inFlight !== null,
    markDirty: () => onChange(useEditor.getState().project),
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(draftTimer);
    },
  };
}

export type SyncState =
  | { status: "loading" }
  | { status: "ready"; restoredDraft: boolean }
  | { status: "notfound" }
  | { status: "error"; message: string };

/**
 * `revision` : changer cette valeur recharge le projet depuis le serveur
 * (après une restauration de version, par exemple).
 * `flush` : envoie tout de suite ce qui n'est pas encore enregistré.
 */
export function useProjectSync(projectId: string, revision = 0) {
  const [state, setState] = useState<SyncState>({ status: "loading" });
  const saverRef = useRef<ReturnType<typeof createSaver> | null>(null);
  const flush = useCallback(() => saverRef.current?.flush() ?? Promise.resolve(), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision sert justement à relancer le chargement
  useEffect(() => {
    let cancelled = false;
    let saver: ReturnType<typeof createSaver> | null = null;
    let unsubscribe = () => {};
    const { loadProject, setSaveStatus } = useEditor.getState();
    setState({ status: "loading" });

    const onHidden = () => {
      if (document.visibilityState === "hidden") void saver?.flush({ keepalive: true });
    };
    const onPageHide = () => void saver?.flush({ keepalive: true });
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saver?.hasUnsaved()) e.preventDefault(); // le navigateur demande confirmation
    };
    const onOnline = () => void saver?.flush();

    (async () => {
      let server: Project;
      try {
        server = await api.getProject(projectId);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setState({ status: "notfound" });
        else setState({ status: "error", message: err instanceof Error ? err.message : "Erreur" });
        return;
      }
      if (cancelled) return;

      // Un brouillon basé sur la version actuelle du serveur = des modifs jamais envoyées.
      const draft = readDraft(projectId);
      const restore = draft !== null && draft.baseUpdatedAt === server.updatedAt;
      if (draft && !restore) local.remove(draftKey(projectId));

      loadProject(restore ? draft.project : server);
      useEditor.temporal.getState().clear(); // le chargement n'est pas annulable
      setSaveStatus("saved");

      saver = createSaver(projectId, server.updatedAt);
      saverRef.current = saver;
      if (restore) saver.markDirty();
      unsubscribe = useEditor.subscribe((s, prev) => {
        if (s.project !== prev.project) saver?.onChange(s.project);
      });
      setBeforeNavigate(() => saver?.flush() ?? Promise.resolve());
      document.addEventListener("visibilitychange", onHidden);
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("beforeunload", onBeforeUnload);
      window.addEventListener("online", onOnline);
      setState({ status: "ready", restoredDraft: restore });
    })();

    return () => {
      cancelled = true;
      saverRef.current = null;
      unsubscribe();
      void saver?.flush();
      saver?.stop();
      setBeforeNavigate(null);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
    };
  }, [projectId, revision]);

  return { state, flush };
}
