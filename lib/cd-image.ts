import JSZip from "jszip";

import {
  CDDA_CHANNELS,
  CDDA_FRAMES_PER_SECOND,
  CDDA_SAMPLE_RATE,
  CDDA_SECTOR_SIZE,
  CDDA_SAMPLES_PER_SECTOR,
} from "./constants";
import { formatCdTextValue } from "./cd-text";
import { decodeFileToCdPcm } from "./decode-audio";
import { msToCueTimestamp, sectorsToMs } from "./duration";
import type { AudioTrack, BuildOptions, BuildProgress } from "./types";

export { msToCueTimestamp } from "./duration";

export interface BuiltCdImage {
  cue: string;
  bin: Uint8Array;
  coverBlob: Blob | null;
  binFilename: string;
  cueFilename: string;
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function escapeCueValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

function pcmToSectors(pcm: Int16Array): Uint8Array {
  const frameCount = pcm.length / CDDA_CHANNELS;
  const sectorCount = Math.ceil(frameCount / CDDA_SAMPLES_PER_SECTOR);
  const output = new Uint8Array(sectorCount * CDDA_SECTOR_SIZE);

  for (let sector = 0; sector < sectorCount; sector++) {
    const sectorOffset = sector * CDDA_SECTOR_SIZE;

    for (let sample = 0; sample < CDDA_SAMPLES_PER_SECTOR; sample++) {
      const frameIndex = sector * CDDA_SAMPLES_PER_SECTOR + sample;
      const byteIndex = sectorOffset + sample * 4;

      if (frameIndex * 2 + 1 < pcm.length) {
        const left = pcm[frameIndex * 2];
        const right = pcm[frameIndex * 2 + 1];
        const view = new DataView(output.buffer, byteIndex, 4);
        view.setInt16(0, left, true);
        view.setInt16(2, right, true);
      }
    }
  }

  return output;
}

function createSilenceSectors(seconds: number): Uint8Array {
  const sectorCount = Math.round(seconds * CDDA_FRAMES_PER_SECOND);
  return new Uint8Array(sectorCount * CDDA_SECTOR_SIZE);
}

function concatSectors(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function appendDiscCdTextLine(
  lines: string[],
  command: string,
  value: string,
  encoding: BuildOptions["cdTextEncoding"],
) {
  const normalized = formatCdTextValue(value, encoding);
  if (normalized) {
    lines.push(`${command} "${escapeCueValue(normalized)}"`);
  }
}

function appendTrackCdTextLine(
  lines: string[],
  command: string,
  value: string,
  encoding: BuildOptions["cdTextEncoding"],
) {
  const normalized = formatCdTextValue(value, encoding);
  if (normalized) {
    lines.push(`    ${command} "${escapeCueValue(normalized)}"`);
  }
}

export function buildCueSheet(
  tracks: AudioTrack[],
  trackOffsetsMs: number[],
  options: BuildOptions,
  albumGenre: string,
  albumYear: string,
): string {
  const prefix = normalizePrefix(options.pathPrefix);
  const binFilename = `${options.imageBasename}.bin`;
  const fileReference = `${prefix}${binFilename}`.replace(/\\/g, "/");
  const lines: string[] = [];

  if (options.enableCdText) {
    const { cdTextEncoding } = options;
    lines.push("CD_TEXT");
    appendDiscCdTextLine(lines, "PERFORMER", options.albumArtist, cdTextEncoding);
    appendDiscCdTextLine(lines, "TITLE", options.albumTitle, cdTextEncoding);

    const albumComposer = tracks.find((track) => track.composer)?.composer ?? "";
    appendDiscCdTextLine(lines, "SONGWRITER", albumComposer, cdTextEncoding);

    if (albumGenre) {
      lines.push(
        `REM GENRE ${escapeCueValue(formatCdTextValue(albumGenre, cdTextEncoding))}`,
      );
    }

    if (albumYear) {
      lines.push(
        `REM DATE ${escapeCueValue(formatCdTextValue(albumYear, cdTextEncoding))}`,
      );
    }

    lines.push("");
  }

  lines.push(`FILE "${escapeCueValue(fileReference)}" BINARY`);

  tracks.forEach((track, index) => {
    lines.push(`  TRACK ${String(index + 1).padStart(2, "0")} AUDIO`);

    if (options.enableCdText) {
      appendTrackCdTextLine(
        lines,
        "TITLE",
        track.title,
        options.cdTextEncoding,
      );

      const performer = track.artist || options.albumArtist;
      appendTrackCdTextLine(
        lines,
        "PERFORMER",
        performer,
        options.cdTextEncoding,
      );

      if (track.composer) {
        appendTrackCdTextLine(
          lines,
          "SONGWRITER",
          track.composer,
          options.cdTextEncoding,
        );
      }
    }

    if (options.pregapSeconds > 0) {
      lines.push(`    INDEX 00 ${msToCueTimestamp(trackOffsetsMs[index])}`);
      lines.push(
        `    INDEX 01 ${msToCueTimestamp(trackOffsetsMs[index] + options.pregapSeconds * 1000)}`,
      );
    } else {
      lines.push(`    INDEX 01 ${msToCueTimestamp(trackOffsetsMs[index])}`);
    }
  });

  return `${lines.join("\r\n")}\r\n`;
}

export async function buildCdImage(
  tracks: AudioTrack[],
  options: BuildOptions,
  albumGenre: string,
  albumYear: string,
  onProgress?: (progress: BuildProgress) => void,
): Promise<BuiltCdImage> {
  const binFilename = `${options.imageBasename}.bin`;
  const cueFilename = `${options.imageBasename}.cue`;
  const pregapSectors =
    options.pregapSeconds > 0
      ? createSilenceSectors(options.pregapSeconds)
      : null;

  const pcmTracks: Int16Array[] = [];
  for (let index = 0; index < tracks.length; index++) {
    onProgress?.({
      phase: "decoding",
      current: index + 1,
      total: tracks.length,
      message: `Decoding ${tracks[index].file.name}`,
    });
    pcmTracks.push(await decodeFileToCdPcm(tracks[index].file));
  }

  onProgress?.({
    phase: "packing",
    current: 0,
    total: tracks.length,
    message: "Packing CD sectors",
  });

  const sectorChunks: Uint8Array[] = [];
  const trackOffsetsMs: number[] = [];
  let currentMs = 0;

  pcmTracks.forEach((pcm, index) => {
    trackOffsetsMs.push(currentMs);

    if (pregapSectors) {
      sectorChunks.push(pregapSectors);
      currentMs += options.pregapSeconds * 1000;
    }

    const trackSectors = pcmToSectors(pcm);
    sectorChunks.push(trackSectors);
    currentMs += sectorsToMs(trackSectors.length / CDDA_SECTOR_SIZE);

    onProgress?.({
      phase: "packing",
      current: index + 1,
      total: tracks.length,
      message: `Packed track ${index + 1}`,
    });
  });

  const bin = concatSectors(sectorChunks);
  const cue = buildCueSheet(
    tracks,
    trackOffsetsMs,
    options,
    albumGenre,
    albumYear,
  );
  const coverBlob = options.albumCoverBlob;

  return {
    cue,
    bin,
    coverBlob,
    binFilename,
    cueFilename,
  };
}

function coverExtension(blob: Blob): string {
  if (blob.type === "image/png") {
    return "png";
  }

  if (blob.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

export async function buildDownloadZip(
  image: BuiltCdImage,
  tracks: AudioTrack[],
  onProgress?: (progress: BuildProgress) => void,
): Promise<Blob> {
  onProgress?.({
    phase: "zipping",
    current: 0,
    total: 1,
    message: "Creating download archive",
  });

  const zip = new JSZip();
  zip.file(image.cueFilename, image.cue);
  zip.file(image.binFilename, image.bin);

  if (image.coverBlob) {
    zip.file("folder.jpg", image.coverBlob);
  }

  tracks.forEach((track, index) => {
    if (!track.coverBlob) {
      return;
    }

    const trackNo = String(index + 1).padStart(2, "0");
    const ext = coverExtension(track.coverBlob);
    zip.file(`covers/${trackNo}.${ext}`, track.coverBlob);
  });

  return zip.generateAsync({ type: "blob" });
}
