"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import type { ScannerStatusResponse } from "@/types/lws";

interface ScannerStatusBannerProps {
  status: ScannerStatusResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export function ScannerStatusBanner({
  status,
  isLoading,
  onRefresh,
}: ScannerStatusBannerProps) {
  if (!status) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs text-zinc-400">
        <span>Scanner status unavailable</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    );
  }

  const isWarning = status.status === "rate_limited" || status.status === "error";
  const isScanning = status.status === "scanning";

  const containerStyle = isWarning
    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : "border-zinc-800 bg-zinc-900/60 text-zinc-300";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs ${containerStyle}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 font-medium uppercase tracking-wider">
          {isWarning ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          ) : isScanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-300" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {status.status.replace("_", " ")}
        </span>

        <span className="text-zinc-500">|</span>

        <span>
          Last scan:{" "}
          <strong className="font-mono text-zinc-100">
            {formatRelativeTime(status.last_success_at)}
          </strong>
        </span>

        <span className="text-zinc-500">|</span>

        <span>
          Bases:{" "}
          <strong className="font-mono text-zinc-100">
            {status.bases_scanned}
          </strong>
        </span>

        {status.error_message && (
          <>
            <span className="text-zinc-500">|</span>
            <span className="text-amber-300">{status.error_message}</span>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </div>
  );
}