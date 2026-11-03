import type { AudioClip } from "@app/schema";
import { Audio } from "@remotion/media";
import { Sequence } from "remotion";

/** Volume d'un clip à la frame f (relative au début du clip), avec fondus. */
export function clipVolumeAt(clip: AudioClip, f: number): number {
  const d = clip.durationInFrames;
  const fadeIn = clip.fadeInFrames > 0 ? f / clip.fadeInFrames : 1;
  const fadeOut = clip.fadeOutFrames > 0 ? (d - f) / clip.fadeOutFrames : 1;
  return clip.volume * Math.max(0, Math.min(1, fadeIn, fadeOut));
}

/** Piste audio globale : les clips sont posés sur la timeline complète. */
export function AudioTrack({ clips }: { clips: AudioClip[] }) {
  return (
    <>
      {clips.map((clip) => (
        <Sequence key={clip.id} from={clip.startFrame} durationInFrames={clip.durationInFrames} layout="none">
          <Audio src={clip.src} trimBefore={clip.trimStartFrames} volume={(f) => clipVolumeAt(clip, f)} />
        </Sequence>
      ))}
    </>
  );
}
