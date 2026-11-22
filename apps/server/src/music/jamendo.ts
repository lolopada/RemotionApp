import type { MusicLicense, MusicSearchResult, MusicTrack } from "@app/schema";

/**
 * Propositions de musique via l'API Jamendo (morceaux sous licence Creative Commons).
 * https://developer.jamendo.com/v3.0/tracks — usage gratuit non commercial, clé « client_id »
 * à créer sur https://devportal.jamendo.com (variable JAMENDO_CLIENT_ID).
 *
 * Le serveur fait l'intermédiaire : la clé reste côté serveur, les recherches sont mises en
 * cache quelques minutes, et l'import télécharge le MP3 dans la bibliothèque de l'utilisateur
 * (même origine que le site : l'aperçu ET l'export le lisent comme une musique importée).
 */

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Ambiances proposées dans l'éditeur → étiquettes Jamendo (combinées en « OU »). */
export const MOODS: Record<string, { label: string; tags: string[] }> = {
  joyeux: { label: "Joyeux", tags: ["happy", "uplifting", "positive", "fun"] },
  calme: { label: "Calme", tags: ["calm", "relaxing", "peaceful", "ambient"] },
  emouvant: { label: "Émouvant", tags: ["emotional", "sad", "melancholic", "piano"] },
  epique: { label: "Épique", tags: ["epic", "cinematic", "soundtrack", "orchestral"] },
  energique: { label: "Énergique", tags: ["energetic", "upbeat", "dance", "electronic"] },
  romantique: { label: "Romantique", tags: ["romantic", "love", "acoustic"] },
  voyage: { label: "Voyage", tags: ["travel", "summer", "adventure", "world"] },
  chill: { label: "Chill / lo-fi", tags: ["lofi", "chill", "chillout", "lounge"] },
  fete: { label: "Fête", tags: ["party", "funk", "disco", "groove"] },
  retro: { label: "Rétro", tags: ["retro", "80s", "synthwave", "vintage"] },
};

export interface MusicQuery {
  mood?: string;
  /** Recherche libre (titre, artiste, genre…). */
  q?: string;
  instrumental?: boolean;
  /**
   * Durée de la vidéo (secondes) : morceaux assez longs pour la couvrir, sans être démesurés
   * (jusqu'à 3 fois la vidéo, et au moins 4 minutes de plus).
   */
  forSeconds?: number;
  offset?: number;
}

export const PAGE_SIZE = 20;
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 300;

export class MusicError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 502 | 503,
  ) {
    super(message);
  }
}

/** « http://creativecommons.org/licenses/by-nc-sa/3.0/ » → CC BY-NC-SA 3.0 */
export function parseLicense(url: string): MusicLicense {
  const m = /licenses\/([a-z-]+)\/(\d+(?:\.\d+)?)/i.exec(url ?? "");
  if (/publicdomain\/zero/i.test(url ?? "")) return { code: "cc0", label: "CC0 (domaine public)", url };
  if (!m) return { code: "", label: "Licence Creative Commons", url: url ?? "" };
  const code = (m[1] as string).toLowerCase();
  return { code, label: `CC ${code.toUpperCase()} ${m[2]}`, url };
}

/** Crédit à citer : « Titre » par Artiste (Jamendo, CC BY 3.0) – adresse */
export function creditFor(t: Pick<MusicTrack, "title" | "artist" | "license" | "pageUrl">): string {
  return `« ${t.title} » par ${t.artist} (Jamendo, ${t.license.label}) – ${t.pageUrl}`;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
/** Jamendo renvoie parfois des adresses en http : on passe en https (page servie en https). */
const https = (url: string) => url.replace(/^http:\/\/((?:[\w-]+\.)*jamendo\.com)/, "https://$1");

/** Un résultat de l'API Jamendo → morceau (champs absents tolérés). */
export function mapTrack(raw: Record<string, unknown>): MusicTrack | null {
  const id = str(raw.id);
  const previewUrl = str(raw.audio);
  if (!id || !previewUrl) return null;
  const info = (raw.musicinfo ?? {}) as { vocalinstrumental?: string; tags?: Record<string, unknown> };
  const tags = Object.values(info.tags ?? {})
    .flatMap((v) => (Array.isArray(v) ? v : []))
    .filter((v): v is string => typeof v === "string")
    .slice(0, 8);
  const cover = str(raw.album_image) || str(raw.image);
  return {
    id,
    title: str(raw.name) || "Sans titre",
    artist: str(raw.artist_name) || "Artiste inconnu",
    durationSeconds: Number(raw.duration) || 0,
    cover: cover ? https(cover) : "",
    previewUrl: https(previewUrl),
    pageUrl: https(str(raw.shareurl) || `https://www.jamendo.com/track/${id}`),
    license: parseLicense(str(raw.license_ccurl)),
    downloadable: raw.audiodownload_allowed !== false && str(raw.audiodownload) !== "",
    instrumental: info.vocalinstrumental === "instrumental",
    tags,
  };
}

interface Options {
  clientId: string;
  baseUrl?: string;
  fetch?: Fetch;
  /** Horloge (tests). */
  now?: () => number;
}

export function createJamendo(opts: Options) {
  const base = (opts.baseUrl ?? "https://api.jamendo.com/v3.0").replace(/\/$/, "");
  const doFetch: Fetch = opts.fetch ?? ((input, init) => fetch(input, init));
  const now = opts.now ?? Date.now;
  const cache = new Map<string, { at: number; value: unknown }>();

  async function call(path: string, params: Record<string, string>) {
    if (!opts.clientId) throw new MusicError("Propositions de musique non configurées", 503);
    const qs = new URLSearchParams({ client_id: opts.clientId, format: "json", ...params });
    const url = `${base}${path}?${qs}`;
    const hit = cache.get(url);
    if (hit && now() - hit.at < CACHE_MS) return hit.value as Record<string, unknown>[];
    let res: Response;
    try {
      res = await doFetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new MusicError("Jamendo ne répond pas", 502);
    }
    if (!res.ok) throw new MusicError(`Jamendo a répondu ${res.status}`, 502);
    const body = (await res.json().catch(() => null)) as {
      headers?: { status?: string; code?: number; error_message?: string };
      results?: unknown;
    } | null;
    if (!body || body.headers?.status === "failed" || !Array.isArray(body.results)) {
      const why = body?.headers?.error_message || "réponse illisible";
      // Code 5 = client_id invalide.
      throw new MusicError(`Jamendo : ${why}`, body?.headers?.code === 5 ? 503 : 502);
    }
    const results = body.results as Record<string, unknown>[];
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(url, { at: now(), value: results });
    return results;
  }

  const common = {
    include: "musicinfo licenses",
    audioformat: "mp32",
    audiodlformat: "mp32",
    imagesize: "100",
  };

  return {
    enabled: Boolean(opts.clientId),

    async search(query: MusicQuery): Promise<MusicSearchResult> {
      const offset = Math.max(0, Math.floor(query.offset ?? 0));
      const params: Record<string, string> = { ...common, limit: String(PAGE_SIZE), offset: String(offset) };
      const mood = query.mood ? MOODS[query.mood] : undefined;
      if (query.mood && !mood) throw new MusicError("Ambiance inconnue", 400);
      const q = query.q?.trim().slice(0, 100);
      if (q) {
        params.search = q;
        params.boost = "popularity_total";
      } else {
        // Sans recherche : les morceaux les plus écoutés de l'ambiance (qualité plus sûre).
        params.order = "popularity_total";
      }
      // Listes séparées par des espaces (encodés « + » dans l'adresse, comme l'attend Jamendo).
      if (mood) params.fuzzytags = mood.tags.join(" ");
      if (query.instrumental) params.vocalinstrumental = "instrumental";
      if (query.forSeconds && query.forSeconds > 0) {
        const min = Math.max(10, Math.round(query.forSeconds));
        params.durationbetween = `${min}_${Math.max(min * 3, min + 240)}`;
      }
      const raw = await call("/tracks/", params);
      const tracks = raw.map(mapTrack).filter((t): t is MusicTrack => t !== null);
      return { tracks, nextOffset: raw.length >= PAGE_SIZE ? offset + PAGE_SIZE : null };
    },

    /** Fiche d'un morceau + adresse de téléchargement (jamais fournie par le navigateur). */
    async track(id: string): Promise<{ track: MusicTrack; downloadUrl: string }> {
      if (!/^\d{1,12}$/.test(id)) throw new MusicError("Morceau inconnu", 404);
      const [raw] = await call("/tracks/", { ...common, id });
      const track = raw ? mapTrack(raw) : null;
      if (!raw || !track) throw new MusicError("Morceau introuvable sur Jamendo", 404);
      return { track, downloadUrl: https(str(raw.audiodownload)) };
    },

    /** Télécharge le MP3 (adresse donnée par Jamendo, jamais par l'utilisateur). */
    async download(url: string): Promise<Response> {
      const host = new URL(url).hostname;
      if (!/(^|\.)jamendo\.com$/.test(host) && !host.endsWith(new URL(base).hostname)) {
        throw new MusicError("Adresse de téléchargement inattendue", 502);
      }
      let res: Response;
      try {
        res = await doFetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
      } catch {
        throw new MusicError("Téléchargement impossible depuis Jamendo", 502);
      }
      if (!res.ok || !res.body) throw new MusicError(`Téléchargement refusé par Jamendo (${res.status})`, 502);
      return res;
    },
  };
}

export type Jamendo = ReturnType<typeof createJamendo>;
