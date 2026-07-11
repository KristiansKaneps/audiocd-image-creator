"use client";

interface HelpTooltipProps {
  label: string;
  text: string;
}

export function HelpTooltip({ label, text }: HelpTooltipProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <span
        className="cursor-help rounded-full border border-zinc-300 px-1.5 text-xs leading-4 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
        title={text}
        aria-label={text}
      >
        ?
      </span>
    </span>
  );
}
