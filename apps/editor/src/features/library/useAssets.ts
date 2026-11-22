import type { StoredFile } from "@app/schema";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";

/** Médias du compte (photos, musiques ou vidéos), avec envoi et suppression. */
export function useAssets(kind: "image" | "audio" | "video") {
  const [assets, setAssets] = useState<StoredFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setAssets(await api.listAssets(kind));
      setError(null);
    } catch {
      setError("Serveur injoignable : les médias ne peuvent pas être chargés.");
    }
  }, [kind]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = async (files: File[]) => {
    setUploading(true);
    setError(null);
    const added: StoredFile[] = [];
    try {
      for (const file of files) added.push(await api.uploadAsset(file));
      await refresh(); // la liste du serveur fait foi (évite les doublons)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setUploading(false);
    }
    return added;
  };

  const remove = async (id: string) => {
    await api.deleteAsset(id).catch((err) => setError(err instanceof Error ? err.message : "Suppression impossible"));
    await refresh();
  };

  return { assets, error, uploading, upload, remove, refresh };
}
