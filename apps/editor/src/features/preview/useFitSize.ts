import { useLayoutEffect, useRef, useState } from "react";

/** Taille maximale qui tient dans le conteneur en gardant le ratio de la vidéo. */
export function useFitSize(aspect: number, padding = 24) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(0, el.clientWidth - padding * 2);
      const h = Math.max(0, el.clientHeight - padding * 2);
      const width = Math.min(w, h * aspect);
      setSize({ width: Math.floor(width), height: Math.floor(width / aspect) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, padding]);

  return { ref, ...size };
}
