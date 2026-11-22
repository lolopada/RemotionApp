import { useCallback, useEffect, useRef } from "react";

/**
 * Regroupe des mises à jour fréquentes (mouvements de souris) en une seule par image affichée.
 * Une souris envoie souvent 120 à 1 000 événements par seconde : sans ça, chaque événement
 * modifierait le projet et redessinerait l'aperçu, bien plus souvent que l'écran ne s'affiche.
 *
 * `schedule(job)` garde le dernier travail demandé et le lance à la prochaine image ;
 * `flush()` le lance tout de suite (à appeler en fin de geste, pour ne rien perdre).
 */
export function useRafBatch() {
  const frame = useRef<number | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const flush = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const job = pending.current;
    pending.current = null;
    job?.();
  }, []);

  const schedule = useCallback(
    (job: () => void) => {
      pending.current = job;
      if (frame.current === null) frame.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(() => () => flush(), [flush]);
  return { schedule, flush };
}
