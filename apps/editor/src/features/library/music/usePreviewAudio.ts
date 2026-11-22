import { useEffect, useRef, useState } from "react";

/**
 * Écoute d'un morceau proposé : un seul lecteur pour toute la liste (lancer un morceau arrête
 * le précédent), arrêté quand on quitte l'onglet. Lu directement depuis Jamendo.
 */
export function usePreviewAudio() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    a.volume = 0.8;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => setPlayingId(null);
    const onPlaying = () => setLoadingId(null);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("playing", onPlaying);
    audio.current = a;
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("playing", onPlaying);
      audio.current = null;
    };
  }, []);

  const toggle = (id: string, url: string) => {
    const a = audio.current;
    if (!a) return;
    if (playingId === id) {
      a.pause();
      setPlayingId(null);
      return;
    }
    a.pause();
    a.src = url;
    setProgress(0);
    setPlayingId(id);
    setLoadingId(id);
    a.play().catch(() => {
      setPlayingId(null);
      setLoadingId(null);
    });
  };

  const stop = () => {
    audio.current?.pause();
    setPlayingId(null);
  };

  /** Avance dans le morceau en cours (0–1). */
  const seek = (ratio: number) => {
    const a = audio.current;
    if (a?.duration) a.currentTime = ratio * a.duration;
  };

  return { playingId, loadingId, progress, toggle, stop, seek };
}
