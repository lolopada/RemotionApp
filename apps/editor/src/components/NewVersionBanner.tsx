import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { formatBuild, useNewVersionAvailable } from "../lib/version";

/**
 * Prévient quand une autre version est en ligne que celle chargée dans l'onglet
 * (mise à jour installée pendant que la page était ouverte, ou page gardée en cache).
 * `beforeReload` : enregistrer le projet ouvert avant de recharger.
 */
export function NewVersionBanner({
  beforeReload,
  compact = false,
}: {
  beforeReload?: () => Promise<unknown>;
  compact?: boolean;
}) {
  const server = useNewVersionAvailable();
  const [busy, setBusy] = useState(false);
  if (!server) return null;

  const reload = async () => {
    setBusy(true);
    try {
      await beforeReload?.();
    } finally {
      window.location.reload();
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void reload()}
        disabled={busy}
        title={`En ligne : ${formatBuild(server)}`}
        className="flex h-7 items-center gap-1.5 rounded-md bg-amber-500/15 px-2 text-amber-200 text-xs transition hover:bg-amber-500/25"
      >
        <RefreshCw size={12} className={busy ? "animate-spin" : undefined} /> Nouvelle version
      </button>
    );
  }
  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500/15 px-4 py-1.5 text-amber-100 text-xs">
      <span>
        Une nouvelle version est en ligne (<span className="tabular-nums">{formatBuild(server)}</span>).
      </span>
      <button
        type="button"
        onClick={() => void reload()}
        disabled={busy}
        className="flex items-center gap-1 rounded bg-amber-500/25 px-2 py-0.5 font-medium hover:bg-amber-500/40"
      >
        <RefreshCw size={12} className={busy ? "animate-spin" : undefined} /> Recharger
      </button>
    </div>
  );
}
