import { parseBlob } from "music-metadata";

import { parseDurationMs, probeDurationMs } from "./duration";
import type { AlbumMeta, AudioTrack } from "./types";

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".flac",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".opus",
  ".wma",
]);

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) {
    return true;
  }

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

function pickYear(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    const match = value.trim().match(/\d{4}/);
    return match?.[0] ?? "";
  }

  return "";
}

function pickGenre(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }

  return "";
}

export async function parseAudioFile(file: File): Promise<AudioTrack> {
  const metadata = await parseBlob(file);
  const common = metadata.common;
  const format = metadata.format;

  const title =
    common.title?.trim() ||
    file.name.replace(/\.[^.]+$/, "").trim() ||
    "Untitled";
  const artist = common.artist?.trim() || common.albumartist?.trim() || "";
  const album = common.album?.trim() || "";
  const composer = common.composer?.[0]?.trim() || "";
  const genre = pickGenre(common.genre);
  const year = pickYear(common.year ?? common.date);
  let durationMs = parseDurationMs(format.duration);

  if (durationMs === null) {
    durationMs = await probeDurationMs(file);
  }

  const coverPicture = common.picture?.[0];
  const coverBlob = coverPicture
    ? new Blob([Uint8Array.from(coverPicture.data)], {
        type: coverPicture.format,
      })
    : null;

  return {
    id: crypto.randomUUID(),
    file,
    title,
    artist,
    album,
    composer,
    genre,
    year,
    durationMs,
    coverBlob,
  };
}

export async function parseAudioFiles(files: File[]): Promise<AudioTrack[]> {
  const audioFiles = files.filter(isAudioFile);
  const tracks = await Promise.all(audioFiles.map(parseAudioFile));
  return sortTracks(tracks);
}

export function sortTracks(tracks: AudioTrack[]): AudioTrack[] {
  return [...tracks].sort((a, b) =>
    a.file.name.localeCompare(b.file.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export function deriveAlbumMeta(tracks: AudioTrack[]): AlbumMeta {
  const albumCounts = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const yearCounts = new Map<string, number>();
  let coverBlob: Blob | null = null;

  for (const track of tracks) {
    if (track.album) {
      albumCounts.set(track.album, (albumCounts.get(track.album) ?? 0) + 1);
    }

    const performer = track.artist || track.album;
    if (performer) {
      artistCounts.set(performer, (artistCounts.get(performer) ?? 0) + 1);
    }

    if (track.genre) {
      genreCounts.set(track.genre, (genreCounts.get(track.genre) ?? 0) + 1);
    }

    if (track.year) {
      yearCounts.set(track.year, (yearCounts.get(track.year) ?? 0) + 1);
    }

    if (!coverBlob && track.coverBlob) {
      coverBlob = track.coverBlob;
    }
  }

  const pickMostCommon = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const album = pickMostCommon(albumCounts) || "Album";
  const artist = pickMostCommon(artistCounts);
  const genre = pickMostCommon(genreCounts);
  const year = pickMostCommon(yearCounts);

  return { title: album, artist, genre, year, coverBlob };
}

export function pickDefaultAlbumCover(tracks: AudioTrack[]): Blob | null {
  return tracks.find((track) => track.coverBlob)?.coverBlob ?? null;
}
