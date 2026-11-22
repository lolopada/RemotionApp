import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditor } from "../../../store/editorStore";

/** Crédits des musiques du projet (morceaux Jamendo), prêts à copier dans une description. */
export function useMusicCredits(): string[] {
  return useEditor(useShallow((s) => [...new Set(s.project.audio.map((c) => c.credit).filter(Boolean))]));
}

export function MusicCredits({ credits, compact = false }: { credits: string[]; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (credits.length === 0) return null;
  const text = `Musique :\n${credits.join("\n")}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // presse-papiers refusé : le texte reste sélectionnable
    }
  };
  return (
    <div className="rounded-md border border-line bg-canvas p-2 text-[11px]">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-ink-muted">{compact ? "Crédit" : "Crédits musique à citer"}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-faint hover:bg-panel-hover hover:text-ink"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <ul className="space-y-1 text-ink-faint leading-snug select-text">
        {credits.map((c) => (
          <li key={c} className="break-words">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
