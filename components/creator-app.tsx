"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CuePreview } from "@/components/cue-preview";
import { HelpTooltip } from "@/components/help-tooltip";
import { TrackList } from "@/components/track-list";
import { estimateCdImage, estimateTrackOffsetsMs } from "@/lib/cd-estimate";
import { buildCdImage, buildCueSheet, buildDownloadZip } from "@/lib/cd-image";
import {
  formatBytes,
  formatDurationMs,
  formatDurationMsf,
} from "@/lib/format";
import {
  deriveAlbumMeta,
  parseAudioFiles,
  pickDefaultAlbumCover,
  sortTracks,
} from "@/lib/metadata";
import {
  CD_TEXT_ENCODING_HELP,
  DEFAULT_CD_TEXT_ENCODING,
} from "@/lib/cd-text";
import type { AudioTrack, BuildProgress, CdTextEncoding } from "@/lib/types";

const PATH_PREFIX_HELP =
  "Not required when the .cue and .bin stay together. Leave empty if you extract the ZIP and burn as-is. Use a prefix like AUDIOCD/ only when you want recipients to place files in a subfolder.";

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "album"
  );
}

function formatTrackDuration(ms: number | null): string {
  if (ms === null) {
    return "—";
  }

  return formatDurationMs(ms);
}

export function CreatorApp() {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [pathPrefix, setPathPrefix] = useState("");
  const [imageBasename, setImageBasename] = useState("album");
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumArtist, setAlbumArtist] = useState("");
  const [albumGenre, setAlbumGenre] = useState("");
  const [albumYear, setAlbumYear] = useState("");
  const [albumCoverBlob, setAlbumCoverBlob] = useState<Blob | null>(null);
  const [pregapSeconds, setPregapSeconds] = useState(2);
  const [enableCdText, setEnableCdText] = useState(true);
  const [cdTextEncoding, setCdTextEncoding] = useState<CdTextEncoding>(
    DEFAULT_CD_TEXT_ENCODING,
  );
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [albumCoverUrl, setAlbumCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!albumCoverBlob) {
      setAlbumCoverUrl(null);
      return;
    }

    const url = URL.createObjectURL(albumCoverBlob);
    setAlbumCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [albumCoverBlob]);

  const buildOptions = useMemo(
    () => ({
      pathPrefix,
      imageBasename: imageBasename.trim() || "album",
      pregapSeconds,
      albumTitle: albumTitle.trim() || deriveAlbumMeta(tracks).title,
      albumArtist: albumArtist.trim(),
      enableCdText,
      cdTextEncoding,
      albumCoverBlob,
    }),
    [
      pathPrefix,
      imageBasename,
      pregapSeconds,
      albumTitle,
      albumArtist,
      enableCdText,
      cdTextEncoding,
      albumCoverBlob,
      tracks,
    ],
  );

  const estimate = useMemo(() => {
    if (tracks.length === 0) {
      return null;
    }

    return estimateCdImage(tracks, buildOptions);
  }, [tracks, buildOptions]);

  const cuePreview = useMemo(() => {
    if (tracks.length === 0) {
      return null;
    }

    const { offsetsMs, isComplete } = estimateTrackOffsetsMs(
      tracks,
      pregapSeconds,
    );

    return {
      filename: `${buildOptions.imageBasename}.cue`,
      content: buildCueSheet(
        tracks,
        offsetsMs,
        buildOptions,
        albumGenre.trim(),
        albumYear.trim(),
      ),
      timestampsEstimated: !isComplete,
    };
  }, [tracks, buildOptions, albumGenre, albumYear, pregapSeconds]);

  const applyAlbumDefaults = useCallback((nextTracks: AudioTrack[]) => {
    const album = deriveAlbumMeta(nextTracks);
    setAlbumTitle(album.title);
    setAlbumArtist(album.artist);
    setAlbumGenre(album.genre);
    setAlbumYear(album.year);
    setImageBasename(slugify(album.title));
    setAlbumCoverBlob(pickDefaultAlbumCover(nextTracks));
  }, []);

  const ingestFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      setIsLoadingFiles(true);

      try {
        const parsed = await parseAudioFiles(Array.from(files));
        if (parsed.length === 0) {
          setError("No supported audio files found.");
          return;
        }

        setTracks(parsed);
        applyAlbumDefaults(parsed);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Failed to read audio files.",
        );
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [applyAlbumDefaults],
  );

  const updateTrack = useCallback(
    (
      id: string,
      patch: Partial<Pick<AudioTrack, "title" | "artist" | "composer">>,
    ) => {
      setTracks((current) =>
        current.map((track) =>
          track.id === id ? { ...track, ...patch } : track,
        ),
      );
    },
    [],
  );

  const updateTrackCover = useCallback((id: string, coverBlob: Blob | null) => {
    setTracks((current) =>
      current.map((track) =>
        track.id === id ? { ...track, coverBlob } : track,
      ),
    );
  }, []);

  const removeTrack = useCallback((id: string) => {
    setTracks((current) => current.filter((track) => track.id !== id));
  }, []);

  const handleFolderInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.files) {
      await ingestFiles(event.target.files);
    }
    event.target.value = "";
  };

  const handleFilesInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.files) {
      await ingestFiles(event.target.files);
    }
    event.target.value = "";
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const items = event.dataTransfer.items;
    const collected: File[] = [];

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          collected.push(file);
        }
      }
    }

    if (collected.length > 0) {
      await ingestFiles(collected);
    }
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    setTracks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleBuild = async () => {
    if (tracks.length === 0 || isBuilding) {
      return;
    }

    setError(null);
    setIsBuilding(true);
    setProgress(null);

    try {
      const image = await buildCdImage(
        tracks,
        buildOptions,
        albumGenre.trim(),
        albumYear.trim(),
        setProgress,
      );

      const zipBlob = await buildDownloadZip(image, tracks, setProgress);
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${buildOptions.imageBasename}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to build the CD image.",
      );
    } finally {
      setIsBuilding(false);
      setProgress(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Local-only
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Audio CD Image Creator
        </h1>
        <p className="max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Red Book output at 44.1 kHz / 16-bit stereo with optional CD-Text in
          the CUE sheet. Edit disc and track metadata, trim the track list to
          fit capacity, then download a shareable{" "}
          <code className="font-mono text-sm">.cue</code> +
          <code className="font-mono text-sm">.bin</code> image.
        </p>
      </header>

      <section
        className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 dark:border-zinc-700 dark:bg-zinc-950"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-50">
              Source audio
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              MP3, WAV, FLAC, OGG, AAC/M4A. Drop files here or use the pickers.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950">
              Select folder
              <input
                type="file"
                className="hidden"
                multiple
                onChange={handleFolderInput}
                {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </label>
            <label className="cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 dark:border-zinc-700 dark:text-zinc-50">
              Select files
              <input
                type="file"
                className="hidden"
                multiple
                accept="audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac,.opus"
                onChange={handleFilesInput}
              />
            </label>
          </div>
        </div>
      </section>

      {isLoadingFiles && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Reading metadata...
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {tracks.length > 0 && (
        <>
          {estimate && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
                Projected CD image
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Audio runtime
                  </p>
                  <p className="mt-1 text-lg font-medium">
                    {formatDurationMs(estimate.audioDurationMs)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Total with pregaps
                  </p>
                  <p className="mt-1 text-lg font-medium">
                    {formatDurationMs(estimate.totalDurationMs)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDurationMsf(estimate.totalDurationMs)} MSF
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    BIN size
                  </p>
                  <p className="mt-1 text-lg font-medium">
                    {formatBytes(estimate.binSizeBytes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    ZIP estimate
                  </p>
                  <p className="mt-1 text-lg font-medium">
                    {formatBytes(estimate.zipSizeEstimateBytes)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <CapacityBadge label="74-min CD" fits={estimate.fits74MinCd} />
                <CapacityBadge
                  label="80-min (79:57 Red Book)"
                  fits={estimate.fits80MinCd}
                />
                {enableCdText && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    CD-Text enabled
                  </span>
                )}
              </div>
              {!estimate.fits80MinCd && (
                <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                  Over 80-minute capacity. Remove tracks until the Red Book
                  badge turns green.
                </p>
              )}
              {!estimate.isComplete && (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                  {estimate.missingDurationCount} track(s) have no duration in
                  tags; size/runtime estimates may be low.
                </p>
              )}
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              {albumCoverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={albumCoverUrl}
                  alt="Album cover"
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-800">
                  No cover art
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2">
                <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-center text-sm dark:border-zinc-700">
                  Change cover
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setAlbumCoverBlob(file ?? null);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setAlbumCoverBlob(pickDefaultAlbumCover(tracks))
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm cursor-pointer dark:border-zinc-700"
                >
                  Use first track cover
                </button>
                {albumCoverBlob && (
                  <button
                    type="button"
                    onClick={() => setAlbumCoverBlob(null)}
                    className="text-sm text-zinc-500 underline cursor-pointer"
                  >
                    Remove cover
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Album title
                </span>
                <input
                  value={albumTitle}
                  onChange={(event) => setAlbumTitle(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Album artist
                </span>
                <input
                  value={albumArtist}
                  onChange={(event) => setAlbumArtist(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Genre
                </span>
                <input
                  value={albumGenre}
                  onChange={(event) => setAlbumGenre(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Year
                </span>
                <input
                  value={albumYear}
                  onChange={(event) => setAlbumYear(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  <HelpTooltip
                    label="CUE path prefix"
                    text={PATH_PREFIX_HELP}
                  />
                </span>
                <input
                  value={pathPrefix}
                  onChange={(event) => setPathPrefix(event.target.value)}
                  placeholder="Leave empty if .cue and .bin stay together"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Image basename
                </span>
                <input
                  value={imageBasename}
                  onChange={(event) => setImageBasename(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="space-y-2 text-sm sm:col-span-2">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Pregap per track (seconds)
                </span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={pregapSeconds}
                  onChange={(event) =>
                    setPregapSeconds(Number(event.target.value) || 0)
                  }
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 sm:col-span-2 dark:border-zinc-800">
                <input
                  type="checkbox"
                  checked={enableCdText}
                  onChange={(event) => setEnableCdText(event.target.checked)}
                  className="mt-1"
                />
                <span className="space-y-1 text-sm">
                  <span className="block font-medium text-zinc-800 dark:text-zinc-200">
                    Include CD-Text in CUE sheet
                  </span>
                  <span className="block text-zinc-600 dark:text-zinc-400">
                    Writes disc/track TITLE, PERFORMER, and SONGWRITER fields
                    for cdrdao-compatible burners.
                  </span>
                </span>
              </label>
              {enableCdText && (
                <label className="space-y-2 text-sm sm:col-span-2">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    <HelpTooltip
                      label="CD-Text character set"
                      text="On-disc CD-Text is not Unicode. Latin-1 is the usual choice for Western players. ASCII is stricter. Unicode only affects the CUE file text, not what car stereos display."
                    />
                  </span>
                  <select
                    value={cdTextEncoding}
                    onChange={(event) =>
                      setCdTextEncoding(event.target.value as CdTextEncoding)
                    }
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="latin1">
                      Latin-1 (ISO-8859-1, recommended)
                    </option>
                    <option value="ascii">ASCII only</option>
                    <option value="unicode">Unicode (CUE file only)</option>
                  </select>
                  <span className="block text-xs text-zinc-500">
                    {CD_TEXT_ENCODING_HELP[cdTextEncoding]}
                  </span>
                </label>
              )}
            </div>
          </section>

          <TrackList
            tracks={tracks}
            formatDuration={formatTrackDuration}
            onUpdateTrack={updateTrack}
            onUpdateTrackCover={updateTrackCover}
            onMoveTrack={moveTrack}
            onRemoveTrack={removeTrack}
            onResort={() => setTracks((current) => sortTracks(current))}
          />

          {cuePreview && (
            <CuePreview
              filename={cuePreview.filename}
              content={cuePreview.content}
              timestampsEstimated={cuePreview.timestampsEstimated}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Output: BIN + CUE{enableCdText ? " with CD-Text" : ""}, folder.jpg,
              and per-track covers in covers/.
            </p>
            <button
              type="button"
              onClick={handleBuild}
              disabled={isBuilding || tracks.length === 0}
              className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed cursor-pointer disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
            >
              {isBuilding ? "Building..." : "Create CD image"}
            </button>
          </div>

          {progress && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {progress.message} ({progress.current}/{progress.total})
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CapacityBadge({ label, fits }: { label: string; fits: boolean }) {
  return (
    <span
      className={
        fits
          ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "rounded-full bg-red-100 px-3 py-1 text-red-800 dark:bg-red-950 dark:text-red-200"
      }
    >
      {label}: {fits ? "fits" : "too long"}
    </span>
  );
}
