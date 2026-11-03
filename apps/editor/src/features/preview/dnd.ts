/** Type MIME interne pour glisser un média de la bibliothèque vers l'aperçu. */
export const ASSET_DRAG_TYPE = "application/x-montage-asset";

export interface DraggedAsset {
  url: string;
  kind: "image" | "audio" | "video";
  name: string;
}

export function setDraggedAsset(e: React.DragEvent, asset: DraggedAsset) {
  e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(asset));
  e.dataTransfer.effectAllowed = "copy";
}

export function getDraggedAsset(e: React.DragEvent): DraggedAsset | null {
  const raw = e.dataTransfer.getData(ASSET_DRAG_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraggedAsset;
  } catch {
    return null;
  }
}
