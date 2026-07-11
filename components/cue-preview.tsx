"use client";

import { useCallback, useState } from "react";

interface CuePreviewProps {
  filename: string;
  content: string;
  timestampsEstimated: boolean;
}

export function CuePreview({
  filename,
  content,
  timestampsEstimated,
}: CuePreviewProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }, [content]);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h2 className="font-medium text-zinc-950 dark:text-zinc-50">
            CUE preview
          </h2>
          <p className="font-mono text-xs text-zinc-500">{filename}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
        >
          {copyState === "copied"
            ? "Copied"
            : copyState === "error"
              ? "Copy failed"
              : "Copy"}
        </button>
      </div>

      <p className="border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
        Live preview from current settings. INDEX positions use tag durations;
        the downloaded CUE is regenerated from decoded audio.
      </p>

      {timestampsEstimated && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          INDEX timestamps are estimated from tag durations. Final values may
          shift slightly after decode and sector packing.
        </p>
      )}

      <pre className="max-h-[420px] overflow-auto bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100">
        {content}
      </pre>
    </section>
  );
}
