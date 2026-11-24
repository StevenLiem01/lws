export type ShieldUrgency = "expired" | "critical" | "warning" | "normal";

export function getRemainingSeconds(
  expiresAtIso: string | null,
  nowMs: number,
  clockOffsetMs = 0
): number {
  if (!expiresAtIso) return 0;
  const targetMs = Date.parse(expiresAtIso);
  if (Number.isNaN(targetMs)) return 0;
  const syncedNowMs = nowMs + clockOffsetMs;
  return Math.max(0, Math.floor((targetMs - syncedNowMs) / 1000));
}

export function getShieldUrgency(remainingSeconds: number): ShieldUrgency {
  if (remainingSeconds <= 0) return "expired";
  if (remainingSeconds < 15 * 60) return "critical"; // < 15 menit (merah)
  if (remainingSeconds < 60 * 60) return "warning"; // < 1 jam (kuning/amber)
  return "normal"; // >= 1 jam (netral)
}

export function formatCountdown(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "EXPIRED";

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never";
  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) return "Unknown";

  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}