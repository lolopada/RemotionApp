import { getProjectDurationInFrames, type MusicTrack } from "@app/schema";
import clsx from "clsx";
import { Check, LoaderCircle, Music2, Pause, Play, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
import { local } from "../../../lib/storage";
import { useEditor } from "../../../store/editorStore";
import { addAssetToTrack } from "./addToTrack";
import { usePreviewAudio } from "./usePreviewAudio";

type Mood = { id: string; label: string };

const PREFS_KEY = "montage:music-prefs";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

interface Prefs {
  mood: string;
  instrumental: boolean;
  fitDuration: boolean;
}

function readPrefs(): Prefs {
  try {
    return { mood: "joyeux", instrumental: true, fitDuration: true, ...JSON.parse(local.get(PREFS_KEY) ?? "{}") };
  } catch {
    return { mood: "joyeux", instrumental: true, fitDuration: true };
  }
}

/**
 * Propositions de musique (Jamendo, licences Creative Commons) : par ambiance ou par
 * recherche, écoute directe, et « Ajouter » qui importe le morceau dans la bibliothèque puis
 * le pose sur la piste audio (avec son crédit).
 */
export function MusicSuggestions({ moods, onImported }: { moods: Mood[]; onImported: () => void }) {
  const [prefs, setPrefs] = useState(readPrefs);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const player = usePreviewAudio();
  // Durée de la vidéo (secondes), pour proposer des morceaux de longueur proche.
  const videoSeconds = useEditor((s) => Math.round(getProjectDurationInFrames(s.project) / s.project.fps));
  const request = useRef(0);

  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      local.set(PREFS_KEY, JSON.stringify(next));
      return next;
    });

  // biome-ignore lint/correctness/useExhaustiveDependencies: nouvelle recherche quand les critères changent (pas à chaque seconde de vidéo ajoutée)
  useEffect(() => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    api
      .searchMusic({
        mood: submitted ? undefined : prefs.mood,
        q: submitted || undefined,
        instrumental: prefs.instrumental,
        forSeconds: prefs.fitDuration ? videoSeconds : undefined,
      })
      .then((r) => {
        if (id !== request.current) return;
        setTracks(r.tracks);
        setNextOffset(r.nextOffset);
      })
      .catch((err) => id === request.current && setError(err instanceof Error ? err.message : "Recherche impossible"))
      .finally(() => id === request.current && setLoading(false));
  }, [prefs.mood, prefs.instrumental, prefs.fitDuration, submitted]);

  const more = async () => {
    if (nextOffset === null) return;
    setLoading(true);
    try {
      const r = await api.searchMusic({
        mood: submitted ? undefined : prefs.mood,
        q: submitted || undefined,
        instrumental: prefs.instrumental,
        forSeconds: prefs.fitDuration ? videoSeconds : undefined,
        offset: nextOffset,
      });
      setTracks((t) => [...t, ...r.tracks.filter((x) => !t.some((y) => y.id === x.id))]);
      setNextOffset(r.nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible");
    } finally {
      setLoading(false);
    }
  };

  const add = async (t: MusicTrack) => {
    setAdding(t.id);
    setError(null);
    try {
      const file = await api.importMusic(t.id);
      await addAssetToTrack(file);
      setAdded((s) => new Set(s).add(t.id));
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ajout impossible");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-2 px-3 pb-3">
      <form
        className="flex items-center gap-1.5 rounded-md bg-canvas px-2 ring-1 ring-line focus-within:ring-accent"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <Search size={13} className="shrink-0 text-ink-faint" />
        <input
          aria-label="Chercher une musique"
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            if (!e.currentTarget.value.trim()) setSubmitted("");
          }}
          placeholder="Piano, guitare, été… puis Entrée"
          className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-faint"
        />
      </form>

      <div className="flex flex-wrap gap-1">
        {moods.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={!submitted && prefs.mood === m.id}
            onClick={() => {
              setQuery("");
              setSubmitted("");
              update({ mood: m.id });
            }}
            className={clsx(
              "rounded-full px-2 py-0.5 text-[11px] transition",
              !submitted && prefs.mood === m.id
                ? "bg-accent text-white"
                : "bg-canvas text-ink-muted ring-1 ring-line hover:text-ink",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            className="accent-accent"
            checked={prefs.instrumental}
            onChange={(e) => update({ instrumental: e.currentTarget.checked })}
          />
          Sans paroles
        </label>
        <label
          className="flex cursor-pointer items-center gap-1"
          title="Seulement les morceaux assez longs pour couvrir toute la vidéo"
        >
          <input
            type="checkbox"
            className="accent-accent"
            checked={prefs.fitDuration}
            onChange={(e) => update({ fitDuration: e.currentTarget.checked })}
          />
          Assez longue ({mmss(videoSeconds)})
        </label>
      </div>

      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}

      <ul aria-label="Musiques proposées" className="space-y-1">
        {tracks.map((t) => {
          const playing = player.playingId === t.id;
          return (
            <li key={t.id} className="relative overflow-hidden rounded-md bg-canvas ring-1 ring-line">
              <div className="flex items-center gap-2 p-1.5">
                <button
                  type="button"
                  onClick={() => player.toggle(t.id, t.previewUrl)}
                  aria-label={playing ? `Pause : ${t.title}` : `Écouter : ${t.title}`}
                  className="group relative size-9 shrink-0 overflow-hidden rounded bg-panel"
                >
                  {t.cover ? (
                    <img src={t.cover} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <Music2 size={14} className="m-auto text-ink-faint" />
                  )}
                  <span
                    className={clsx(
                      "absolute inset-0 flex items-center justify-center bg-black/45 text-white transition",
                      playing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    {player.loadingId === t.id ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : playing ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} />
                    )}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs" title={t.title}>
                    {t.title}
                  </p>
                  <p className="truncate text-[10px] text-ink-faint" title={`${t.artist} · ${t.license.label}`}>
                    {t.artist} · {mmss(t.durationSeconds)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!t.downloadable || adding !== null}
                  onClick={() => void add(t)}
                  title={
                    t.downloadable
                      ? `Ajouter à la piste (${t.license.label})`
                      : "L'artiste n'autorise pas le téléchargement de ce morceau"
                  }
                  aria-label={`Ajouter : ${t.title}`}
                  className={clsx(
                    "flex size-7 shrink-0 items-center justify-center rounded-md transition disabled:opacity-40",
                    added.has(t.id)
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-accent text-white hover:bg-accent-hover",
                  )}
                >
                  {adding === t.id ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : added.has(t.id) ? (
                    <Check size={13} />
                  ) : (
                    <Plus size={14} />
                  )}
                </button>
              </div>
              {playing ? (
                // Barre de lecture : cliquer pour avancer dans le morceau.
                <button
                  type="button"
                  aria-label="Avancer dans le morceau"
                  className="absolute inset-x-0 bottom-0 h-1.5 cursor-pointer bg-line"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    player.seek((e.clientX - r.left) / r.width);
                  }}
                >
                  <span className="block h-full bg-accent" style={{ width: `${player.progress * 100}%` }} />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {loading ? (
        <p className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-ink-faint">
          <LoaderCircle size={12} className="animate-spin" /> Recherche…
        </p>
      ) : tracks.length === 0 && !error ? (
        <p className="py-2 text-center text-[11px] text-ink-faint">
          Rien trouvé. Essaie une autre ambiance{prefs.fitDuration ? " ou décoche « Assez longue »" : ""}.
        </p>
      ) : nextOffset !== null ? (
        <button
          type="button"
          onClick={() => void more()}
          className="w-full rounded-md border border-line py-1.5 text-[11px] text-ink-muted hover:border-accent hover:text-ink"
        >
          Voir plus de morceaux
        </button>
      ) : null}

      <p className="text-[10px] text-ink-faint leading-snug">
        Musiques de{" "}
        <a href="https://www.jamendo.com" target="_blank" rel="noreferrer" className="underline">
          Jamendo
        </a>
        , sous licence Creative Commons. Le crédit de l'artiste est gardé avec le morceau (export, panneau de la
        musique).
      </p>
    </div>
  );
}
