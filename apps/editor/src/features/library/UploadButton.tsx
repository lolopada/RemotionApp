import { LoaderCircle, Upload } from "lucide-react";
import { useRef } from "react";

export function UploadButton({
  accept,
  label,
  uploading,
  onFiles,
}: {
  accept: string;
  label: string;
  uploading: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={uploading}
        onClick={() => input.current?.click()}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-accent font-medium text-sm text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
        {uploading ? "Envoi…" : label}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          // Copie : vider l'input juste après viderait aussi la FileList.
          const files = Array.from(e.currentTarget.files ?? []);
          if (files.length) onFiles(files);
          e.currentTarget.value = "";
        }}
      />
    </>
  );
}
