import { type AudioClip, framesToSeconds, secondsToFrames } from "@app/schema";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Field, IconButton, NumberInput, Section, Slider, TextInput } from "../../components/ui";
import { useEditor, useProject } from "../../store/editorStore";

export function AudioInspector({ clip }: { clip: AudioClip }) {
  const project = useProject();
  const { updateAudio, removeAudio, selectAudio } = useEditor.getState();
  const update = (fn: (c: AudioClip) => void) => updateAudio(clip.id, fn);
  const sec = (frames: number) => framesToSeconds(frames, project.fps);
  const fr = (seconds: number) => Math.max(0, Math.round(seconds * project.fps));

  return (
    <div>
      <div className="flex items-center gap-1 border-line border-b px-2 py-2">
        <IconButton label="Retour" onClick={() => selectAudio(null)}>
          <ArrowLeft size={15} />
        </IconButton>
        <span className="flex-1 truncate font-medium text-sm">{clip.name || "Musique"}</span>
        <IconButton label="Retirer de la piste" className="hover:text-red-300" onClick={() => removeAudio(clip.id)}>
          <Trash2 size={14} />
        </IconButton>
      </div>
      <Section title="Musique">
        <Field label="Nom">
          <TextInput value={clip.name} onChange={(v) => update((c) => void (c.name = v))} />
        </Field>
        <Field label="Début">
          <NumberInput
            value={sec(clip.startFrame)}
            step={0.5}
            min={0}
            suffix="s"
            onChange={(v) => update((c) => void (c.startFrame = fr(v)))}
          />
        </Field>
        <Field label="Durée">
          <NumberInput
            value={sec(clip.durationInFrames)}
            step={0.5}
            min={0.1}
            suffix="s"
            onChange={(v) => update((c) => void (c.durationInFrames = secondsToFrames(v, project.fps)))}
          />
        </Field>
        <Field label="Couper l'intro">
          <NumberInput
            value={sec(clip.trimStartFrames)}
            step={0.5}
            min={0}
            suffix="s"
            onChange={(v) => update((c) => void (c.trimStartFrames = fr(v)))}
          />
        </Field>
        <Field label="Volume">
          <Slider
            value={clip.volume}
            min={0}
            max={1.5}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update((c) => void (c.volume = v))}
          />
        </Field>
        <Field label="Fondu entrée">
          <NumberInput
            value={sec(clip.fadeInFrames)}
            step={0.5}
            min={0}
            suffix="s"
            onChange={(v) => update((c) => void (c.fadeInFrames = fr(v)))}
          />
        </Field>
        <Field label="Fondu sortie">
          <NumberInput
            value={sec(clip.fadeOutFrames)}
            step={0.5}
            min={0}
            suffix="s"
            onChange={(v) => update((c) => void (c.fadeOutFrames = fr(v)))}
          />
        </Field>
      </Section>
    </div>
  );
}
