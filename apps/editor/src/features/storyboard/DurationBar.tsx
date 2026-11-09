import type { DurationScope } from "@app/schema";
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { useEditor, useProject } from "../../store/editorStore";

const inputClass =
  "h-6 w-14 rounded border border-line bg-canvas px-1.5 text-right text-[11px] text-ink tabular-nums outline-none focus:border-accent";

/**
 * « Durée par page » : une seule valeur en secondes appliquée à toutes les pages (ou sans la
 * première et la dernière, ou à la sélection Ctrl/Maj + clic). Peut aussi devenir la durée
 * des nouvelles pages. Chaque page reste réglable à la main ensuite.
 */
export function DurationBar() {
  const project = useProject();
  const selectedCount = useEditor((s) => 1 + s.extraSceneIds.filter((id) => id !== s.selectedSceneId).length);
  const [text, setText] = useState(String(project.defaultSceneSeconds ?? 3));
  const [scope, setScope] = useState<DurationScope>("all");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Quand un autre projet s'ouvre, on reprend son réglage.
  // biome-ignore lint/correctness/useExhaustiveDependencies: seulement au changement de projet
  useEffect(() => {
    setText(String(project.defaultSceneSeconds ?? 3));
    setRemember(true);
    setMessage(null);
  }, [project.id]);

  const seconds = Number(text.replace(",", "."));
  const valid = Number.isFinite(seconds) && seconds >= 0.5 && seconds <= 120;
  const noTarget = scope === "inner" && project.scenes.length <= 2;

  const apply = () => {
    if (!valid) return;
    const { changed, keptLonger } = useEditor.getState().setScenesDuration(seconds, scope, remember);
    const parts = [`${changed} page${changed > 1 ? "s" : ""} modifiée${changed > 1 ? "s" : ""}`];
    if (keptLonger > 0) {
      parts.push(`${keptLonger} gardée${keptLonger > 1 ? "s" : ""} plus longue${keptLonger > 1 ? "s" : ""} (vidéo)`);
    }
    setMessage(parts.join(" · "));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-1.5 text-[11px] text-ink-muted">
      <Timer size={12} className="text-ink-faint" />
      <span>Durée par page</span>
      <input
        aria-label="Durée par page en secondes"
        className={inputClass}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.currentTarget.value);
          setMessage(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && apply()}
      />
      <span>s</span>
      <select
        aria-label="Pages concernées"
        className="h-6 rounded border border-line bg-canvas px-1 text-[11px] text-ink outline-none focus:border-accent"
        value={scope}
        onChange={(e) => {
          setScope(e.currentTarget.value as DurationScope);
          setMessage(null);
        }}
      >
        <option value="all">Toutes les pages</option>
        <option value="inner">Toutes sauf la 1re et la dernière</option>
        <option value="selected">
          {selectedCount > 1 ? `Les ${selectedCount} pages sélectionnées` : "La page sélectionnée"}
        </option>
      </select>
      <button
        type="button"
        onClick={apply}
        disabled={!valid || noTarget}
        title={noTarget ? "Il faut au moins 3 pages" : undefined}
        className="h-6 rounded bg-accent-soft px-2 text-ink transition hover:bg-accent hover:text-white disabled:opacity-40 disabled:hover:bg-accent-soft disabled:hover:text-ink"
      >
        Appliquer
      </button>
      <label className="flex cursor-pointer items-center gap-1 text-ink-faint">
        <input
          type="checkbox"
          className="accent-accent"
          checked={remember}
          onChange={(e) => setRemember(e.currentTarget.checked)}
        />
        Aussi pour les nouvelles pages
      </label>
      {message ? (
        <span role="status" className="text-accent">
          {message}
        </span>
      ) : selectedCount > 1 ? null : (
        <span className="text-ink-faint">Ctrl/Maj + clic sur les vignettes pour en choisir plusieurs</span>
      )}
    </div>
  );
}
