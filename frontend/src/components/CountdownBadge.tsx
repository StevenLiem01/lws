"use client";

import {
  formatCountdown,
  getRemainingSeconds,
  getShieldUrgency,
} from "@/lib/time";

interface CountdownBadgeProps {
  expiresAt: string | null;
  nowMs: number;
  clockOffsetMs: number;
}

export function CountdownBadge({
  expiresAt,
  nowMs,
  clockOffsetMs,
}: CountdownBadgeProps) {
  const remaining = getRemainingSeconds(expiresAt, nowMs, clockOffsetMs);
  const urgency = getShieldUrgency(remaining);
  const label = formatCountdown(remaining);

  const styleMap = {
    expired: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
    critical: "border-red-500/40 bg-red-500/15 text-red-400",
    warning: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    normal: "border-zinc-700 bg-zinc-900 text-zinc-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs font-medium tabular-nums ${styleMap[urgency]}`}
    >
      {label}
    </span>
  );
}