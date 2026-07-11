export const CDDA_SECTOR_SIZE = 2352;
export const CDDA_FRAMES_PER_SECOND = 75;
export const CDDA_SAMPLES_PER_SECTOR = CDDA_SECTOR_SIZE / 4;
export const CDDA_SAMPLE_RATE = 44100;
export const CDDA_BITS_PER_SAMPLE = 16;
export const CDDA_CHANNELS = 2;

/** Red Book maximum program area on a standard 80-minute disc (79:57.74). */
export const STANDARD_80MIN_CD_MS = msfToMs(79, 57, 74);

/** Typical 74-minute disc capacity. */
export const STANDARD_74MIN_CD_MS = 74 * 60 * 1000;

/** Common marketing label for 700 MiB media (~80 minutes). */
export const STANDARD_80MIN_LABEL_MS = 80 * 60 * 1000;

export const CD_TEXT_MAX_LENGTH = 80;

export function msfToMs(minutes: number, seconds: number, frames: number): number {
  return Math.round(
    ((minutes * 60 + seconds) * CDDA_FRAMES_PER_SECOND + frames) *
      (1000 / CDDA_FRAMES_PER_SECOND),
  );
}

export function msToMsf(ms: number): { minutes: number; seconds: number; frames: number } {
  const totalFrames = Math.max(
    0,
    Math.round((ms / 1000) * CDDA_FRAMES_PER_SECOND),
  );
  const frames = totalFrames % CDDA_FRAMES_PER_SECOND;
  const totalSeconds = Math.floor(totalFrames / CDDA_FRAMES_PER_SECOND);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  return { minutes, seconds, frames };
}
