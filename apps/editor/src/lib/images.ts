import { useEditor } from "../store/editorStore";
import { getImageSize } from "./media";

const aspects = new Map<string, number>();

/** Ratio largeur/hauteur d'une image (mis en cache). */
export async function getImageAspect(url: string): Promise<number | null> {
  const hit = aspects.get(url);
  if (hit) return hit;
  try {
    const { width, height } = await getImageSize(url);
    if (!width || !height) return null;
    aspects.set(url, width / height);
    return width / height;
  } catch {
    return null;
  }
}

/**
 * Met une photo dans un calque image (Smart Drop, clic dans la bibliothèque) :
 * garde la forme, la bordure et les effets ; remet le cadrage à zéro et
 * mémorise le ratio de l'image pour pouvoir la recadrer à la souris.
 */
export function assignImage(layerId: string, url: string) {
  const { updateLayer } = useEditor.getState();
  updateLayer(layerId, (l) => {
    if (l.type !== "image") return;
    l.src = url;
    l.imageAspect = aspects.get(url) ?? null;
    l.crop = { zoom: 1, offsetX: 0, offsetY: 0 };
  });
  if (!aspects.has(url)) {
    void getImageAspect(url).then((aspect) => {
      if (!aspect) return;
      useEditor.getState().updateLayer(layerId, (l) => {
        if (l.type === "image" && l.src === url) l.imageAspect = aspect;
      });
    });
  }
}
