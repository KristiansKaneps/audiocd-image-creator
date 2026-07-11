import {
  CDDA_FRAMES_PER_SECOND,
  CDDA_SECTOR_SIZE,
  STANDARD_74MIN_CD_MS,
  STANDARD_80MIN_CD_MS,
  STANDARD_80MIN_LABEL_MS,
} from "./constants";
import { durationMsToSectorCount, sectorsToMs } from "./duration";
import type { AudioTrack, BuildOptions, CdImageEstimate } from "./types";

function pregapSectorCount(pregapSeconds: number): number {
  return Math.round(pregapSeconds * CDDA_FRAMES_PER_SECOND);
}

export function estimateTrackOffsetsMs(
  tracks: AudioTrack[],
  pregapSeconds: number,
): { offsetsMs: number[]; isComplete: boolean } {
  const offsetsMs: number[] = [];
  let currentMs = 0;
  let isComplete = true;

  for (const track of tracks) {
    offsetsMs.push(currentMs);

    if (pregapSeconds > 0) {
      currentMs += pregapSeconds * 1000;
    }

    if (track.durationMs === null) {
      isComplete = false;
      continue;
    }

    const sectors = durationMsToSectorCount(track.durationMs);
    currentMs += sectorsToMs(sectors);
  }

  return { offsetsMs, isComplete };
}

export function estimateCdImage(
  tracks: AudioTrack[],
  options: Pick<BuildOptions, "pregapSeconds" | "enableCdText" | "albumTitle" | "albumArtist" | "imageBasename" | "pathPrefix">,
): CdImageEstimate {
  const tracksWithDuration = tracks.filter((track) => track.durationMs !== null);
  const missingDurationCount = tracks.length - tracksWithDuration.length;

  const audioDurationMs = tracksWithDuration.reduce(
    (sum, track) => sum + (track.durationMs ?? 0),
    0,
  );
  const pregapDurationMs =
    options.pregapSeconds > 0
      ? tracks.length * options.pregapSeconds * 1000
      : 0;
  const totalDurationMs = audioDurationMs + pregapDurationMs;

  let sectorCount = 0;
  for (const track of tracksWithDuration) {
    if (options.pregapSeconds > 0) {
      sectorCount += pregapSectorCount(options.pregapSeconds);
    }
    sectorCount += durationMsToSectorCount(track.durationMs ?? 0);
  }

  const binSizeBytes = sectorCount * CDDA_SECTOR_SIZE;
  const coverSizeBytes =
    tracks.find((track) => track.coverBlob)?.coverBlob?.size ?? 0;

  const cueSizeBytes = estimateCueSize(tracks, options);
  const zipSizeEstimateBytes = Math.round(
    binSizeBytes + cueSizeBytes + coverSizeBytes + binSizeBytes * 0.001 + 256,
  );

  return {
    trackCount: tracks.length,
    missingDurationCount,
    audioDurationMs,
    pregapDurationMs,
    totalDurationMs,
    binSizeBytes,
    cueSizeBytes,
    coverSizeBytes,
    zipSizeEstimateBytes,
    fits74MinCd: totalDurationMs <= STANDARD_74MIN_CD_MS,
    fits80MinCd: totalDurationMs <= STANDARD_80MIN_CD_MS,
    fits80MinLabel: totalDurationMs <= STANDARD_80MIN_LABEL_MS,
    isComplete: missingDurationCount === 0,
  };
}

function estimateCueSize(
  tracks: AudioTrack[],
  options: Pick<
    BuildOptions,
    "enableCdText" | "albumTitle" | "albumArtist" | "imageBasename" | "pathPrefix"
  >,
): number {
  const lines: string[] = [];

  if (options.enableCdText) {
    lines.push("CD_TEXT");
    lines.push(`PERFORMER "${options.albumArtist}"`);
    lines.push(`TITLE "${options.albumTitle}"`);
  }

  lines.push(`FILE "${options.pathPrefix}${options.imageBasename}.bin" BINARY`);

  for (const track of tracks) {
    lines.push("  TRACK 01 AUDIO");
    if (options.enableCdText) {
      lines.push(`    TITLE "${track.title}"`);
      lines.push(`    PERFORMER "${track.artist}"`);
    }
    lines.push("    INDEX 01 00:00:00");
  }

  return lines.join("\r\n").length + 32;
}
