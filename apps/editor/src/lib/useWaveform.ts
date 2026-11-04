import { useEffect, useState } from "react";
import { loadWaveform, type Waveform } from "./waveform";

/** undefined = en cours de calcul, null = illisible (pas de son, codec inconnu), sinon la forme d'onde. */
export function useWaveform(src: string | null): Waveform | null | undefined {
  const [state, setState] = useState<{ src: string; wave: Waveform | null } | undefined>();
  useEffect(() => {
    if (!src) return;
    let alive = true;
    void loadWaveform(src).then((wave) => alive && setState({ src, wave }));
    return () => {
      alive = false;
    };
  }, [src]);
  if (!src) return null;
  return state?.src === src ? state.wave : undefined;
}
