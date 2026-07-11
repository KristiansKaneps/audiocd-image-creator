import { CDDA_FRAMES_PER_SECOND } from "./constants";

/** Above this (seconds), tag duration is likely ms mislabeled as seconds. */
const MISLABELED_MS_THRESHOLD_SEC = 3 * 3600;

/** Max plausible single-track length for a CD (80 minutes). */
const MAX_TRACK_SECONDS = 80 * 60;

export function durationMsToSectorCount(durationMs: number): number {
  return Math.ceil((durationMs / 1000) * CDDA_FRAMES_PER_SECOND);
}

export function sectorsToMs(sectorCount: number): number {
  return (sectorCount / CDDA_FRAMES_PER_SECOND) * 1000;
}

export function parseDurationMs(durationSeconds: number | undefined): number | null {
  if (
    durationSeconds === undefined ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  let seconds = durationSeconds;

  while (seconds > MISLABELED_MS_THRESHOLD_SEC) {
    seconds /= 1000;
    if (seconds < 1) {
      return null;
    }
  }

  if (seconds > MAX_TRACK_SECONDS) {
    return null;
  }

  return Math.round(seconds * 1000);
}

export function msToCueTimestamp(ms: number): string {
  const totalFrames = Math.max(
    0,
    Math.round((ms / 1000) * CDDA_FRAMES_PER_SECOND),
  );
  const frames = totalFrames % CDDA_FRAMES_PER_SECOND;
  const totalSeconds = Math.floor(totalFrames / CDDA_FRAMES_PER_SECOND);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

export async function probeDurationMs(file: File): Promise<number | null> {
  const audioContext = new AudioContext();

  try {
    const buffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(buffer.slice(0));
    const ms = Math.round(decoded.duration * 1000);

    if (ms <= 0 || ms > MAX_TRACK_SECONDS * 1000) {
      return null;
    }

    return ms;
  } catch {
    return null;
  } finally {
    await audioContext.close();
  }
}

export function pcmLengthToDurationMs(pcmLength: number): number {
  const sampleRate = 44100;
  const channels = 2;
  const frameCount = pcmLength / channels;
  return Math.round((frameCount / sampleRate) * 1000);
}
