"use client";

import { useEffect, useState } from "react";

import type { AudioTrack } from "@/lib/types";

interface TrackListProps {
  tracks: AudioTrack[];
  onUpdateTrack: (
    id: string,
    patch: Partial<Pick<AudioTrack, "title" | "artist" | "composer">>,
  ) => void;
  onUpdateTrackCover: (id: string, coverBlob: Blob | null) => void;
  onMoveTrack: (index: number, direction: -1 | 1) => void;
  onRemoveTrack: (id: string) => void;
  onResort: () => void;
  formatDuration: (ms: number | null) => string;
}

export function TrackList({
  tracks,
  onUpdateTrack,
  onUpdateTrackCover,
  onMoveTrack,
  onRemoveTrack,
  onResort,
  formatDuration,
}: TrackListProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
          Tracks ({tracks.length})
        </h2>
        <button
          type="button"
          onClick={onResort}
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400 cursor-pointer"
        >
          Re-sort by filename
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Cover</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Artist</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                formatDuration={formatDuration}
                onUpdateTrack={onUpdateTrack}
                onUpdateTrackCover={onUpdateTrackCover}
                onMoveTrack={onMoveTrack}
                onRemoveTrack={onRemoveTrack}
                canMoveUp={index > 0}
                canMoveDown={index < tracks.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface TrackRowProps {
  track: AudioTrack;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  formatDuration: (ms: number | null) => string;
  onUpdateTrack: TrackListProps["onUpdateTrack"];
  onUpdateTrackCover: TrackListProps["onUpdateTrackCover"];
  onMoveTrack: TrackListProps["onMoveTrack"];
  onRemoveTrack: TrackListProps["onRemoveTrack"];
}

function TrackRow({
  track,
  index,
  canMoveUp,
  canMoveDown,
  formatDuration,
  onUpdateTrack,
  onUpdateTrackCover,
  onMoveTrack,
  onRemoveTrack,
}: TrackRowProps) {
  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-800">
      <td className="px-4 py-3 align-top">
        <div className="font-medium">{index + 1}</div>
      </td>
      <td className="px-4 py-3 align-top">
        <TrackCover
          coverBlob={track.coverBlob}
          onUpdateTrackCover={onUpdateTrackCover}
          trackId={track.id}
        />
      </td>
      <td className="min-w-[180px] px-4 py-3 align-top">
        <input
          value={track.title}
          onChange={(event) =>
            onUpdateTrack(track.id, { title: event.target.value })
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </td>
      <td className="min-w-[160px] px-4 py-3 align-top">
        <input
          value={track.artist}
          onChange={(event) =>
            onUpdateTrack(track.id, { artist: event.target.value })
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </td>
      <td className="px-4 py-3 align-top">
        {formatDuration(track.durationMs)}
      </td>
      <td className="max-w-[180px] truncate px-4 py-3 align-top font-mono text-xs text-zinc-500">
        {track.file.name}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMoveTrack(index, -1)}
            className="rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed cursor-pointer dark:border-zinc-700"
          >
            Up
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMoveTrack(index, 1)}
            className="rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed cursor-pointer dark:border-zinc-700"
          >
            Down
          </button>
          <button
            type="button"
            onClick={() => onRemoveTrack(track.id)}
            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 cursor-pointer dark:border-red-900 dark:text-red-300"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

function TrackCover({
  coverBlob,
  trackId,
  onUpdateTrackCover,
}: {
  coverBlob: Blob | null;
  trackId: string;
  onUpdateTrackCover: TrackListProps["onUpdateTrackCover"];
}) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!coverBlob) {
      setCoverUrl(null);
      return;
    }

    const url = URL.createObjectURL(coverBlob);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverBlob]);

  return (
    <div className="flex w-16 flex-col gap-2">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className="aspect-square w-16 rounded-md object-cover"
        />
      ) : (
        <div className="flex aspect-square w-16 items-center justify-center rounded-md bg-zinc-100 text-[10px] text-zinc-500 dark:bg-zinc-800">
          none
        </div>
      )}
      <label className="cursor-pointer text-[10px] text-zinc-600 underline dark:text-zinc-400">
        Change
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            onUpdateTrackCover(trackId, file ?? null);
            event.target.value = "";
          }}
        />
      </label>
      {coverBlob && (
        <button
          type="button"
          className="text-left text-[10px] text-zinc-500 underline cursor-pointer"
          onClick={() => onUpdateTrackCover(trackId, null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
