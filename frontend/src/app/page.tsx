"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Radar, ShieldAlert, ShieldOff } from "lucide-react";
import { FilterBar, type FilterState } from "@/components/FilterBar";
import { ScannerStatusBanner } from "@/components/ScannerStatusBanner";
import { TargetTable } from "@/components/TargetTable";
import { fetchScannerStatus, fetchServers, fetchTargets } from "@/lib/api";
import type {
  ScannerStatusResponse,
  ServerSummary,
  TargetItem,
  TargetTab,
} from "@/types/lws";

const DEFAULT_LIMIT = 50;

function getDefaultFilters(tab: TargetTab): FilterState {
  return {
    search: "",
    allianceTag: "",
    minHq: "",
    maxHq: "",
    sortBy: tab === "expiring" ? "expires_asc" : "hq_desc",
  };
}

export default function HomePage() {
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [serverId, setServerId] = useState<number>(1349);
  const [tab, setTab] = useState<TargetTab>("unshielded");
  const [filters, setFilters] = useState<FilterState>(() =>
    getDefaultFilters("unshielded")
  );
  const [debouncedFilters, setDebouncedFilters] = useState<FilterState>(filters);
  const [page, setPage] = useState<number>(1);

  const [items, setItems] = useState<TargetItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [scannerStatus, setScannerStatus] =
    useState<ScannerStatusResponse | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [nowMs, setNowMs] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [filters]);

  // Ambil daftar server yang tersedia saat mount
  useEffect(() => {
    const controller = new AbortController();
    fetchServers(controller.signal)
      .then((res) => {
        setServers(res.servers);
        if (res.servers.length > 0) {
          setServerId((prev) =>
            res.servers.some((s) => s.server_id === prev)
              ? prev
              : res.servers[0].server_id
          );
        }
      })
      .catch(() => {
        // Fallback tetap pakai serverId default (1349)
      });
    return () => controller.abort();
  }, []);

  // Ambil targets + scanner status setiap kali parameter berubah
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);

    const minHqNum = debouncedFilters.minHq
      ? Number(debouncedFilters.minHq)
      : undefined;
    const maxHqNum = debouncedFilters.maxHq
      ? Number(debouncedFilters.maxHq)
      : undefined;

    Promise.all([
      fetchTargets(
        {
          server_id: serverId,
          tab,
          search: debouncedFilters.search || undefined,
          alliance_tag: debouncedFilters.allianceTag || undefined,
          min_hq: Number.isFinite(minHqNum) ? minHqNum : undefined,
          max_hq: Number.isFinite(maxHqNum) ? maxHqNum : undefined,
          sort_by: debouncedFilters.sortBy,
          page,
          limit: DEFAULT_LIMIT,
        },
        controller.signal
      ),
      fetchScannerStatus(serverId, controller.signal).catch(() => null),
    ])
      .then(([targetsRes, statusRes]) => {
        setItems(targetsRes.items);
        setTotal(targetsRes.total);
        setScannerStatus(statusRes);

        const serverMs = Date.parse(targetsRes.server_time_utc);
        if (!Number.isNaN(serverMs)) {
          setClockOffsetMs(serverMs - Date.now());
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to load targets"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [serverId, tab, debouncedFilters, page, refreshTick]);

  const handleTabChange = (nextTab: TargetTab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      sortBy: nextTab === "expiring" ? "expires_asc" : "hq_desc",
    }));
  };

  const handleResetFilters = () => {
    setFilters(getDefaultFilters(tab));
    setPage(1);
  };

  const handleManualRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_LIMIT));
  const startIndex = total === 0 ? 0 : (page - 1) * DEFAULT_LIMIT + 1;
  const endIndex = Math.min(page * DEFAULT_LIMIT, total);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
            <Radar className="h-4 w-4 text-zinc-200" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              LWS Intel Dashboard
            </h1>
            <p className="text-xs text-zinc-500">
              Last War: Survival — Unshielded &amp; Shield Expiring Tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="server-select" className="text-xs text-zinc-400">
            Server
          </label>
          <select
            id="server-select"
            value={serverId}
            onChange={(e) => {
              setServerId(Number(e.target.value));
              setPage(1);
            }}
            className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            {servers.length > 0 ? (
              servers.map((s) => (
                <option key={s.server_id} value={s.server_id}>
                  #{s.server_id}
                </option>
              ))
            ) : (
              <option value={serverId}>#{serverId}</option>
            )}
          </select>
        </div>
      </header>

      {/* Scanner Status */}
      <ScannerStatusBanner
        status={scannerStatus}
        isLoading={isLoading}
        onRefresh={handleManualRefresh}
      />

      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-zinc-800">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleTabChange("unshielded")}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition ${tab === "unshielded"
              ? "border-zinc-100 text-zinc-100"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
          >
            <ShieldOff className="h-3.5 w-3.5" />
            Unshielded
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("expiring")}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium transition ${tab === "expiring"
              ? "border-zinc-100 text-zinc-100"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Shield Expiring
          </button>
        </div>

        <span className="font-mono text-xs text-zinc-500">
          {total} {total === 1 ? "target" : "targets"}
        </span>
      </div>

      {/* Filters */}
      <FilterBar
        tab={tab}
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* API Error Banner */}
      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <strong>Connection error:</strong> {errorMessage}. Pastikan FastAPI
          backend sedang berjalan di{" "}
          <span className="font-mono">http://localhost:8000</span>.
        </div>
      )}

      {/* Target Table */}
      <TargetTable
        items={items}
        tab={tab}
        isLoading={isLoading}
        nowMs={nowMs}
        clockOffsetMs={clockOffsetMs}
      />

      {/* Pagination */}
      <footer className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-400">
        <span className="font-mono">
          Showing {startIndex}–{endIndex} of {total}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <span className="font-mono text-zinc-300">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </main>
  );
}