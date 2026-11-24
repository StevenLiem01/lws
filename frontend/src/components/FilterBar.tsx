"use client";

import { RotateCcw, Search } from "lucide-react";
import type { SortOption, TargetTab } from "@/types/lws";

export interface FilterState {
  search: string;
  allianceTag: string;
  minHq: string;
  maxHq: string;
  sortBy: SortOption;
}

interface FilterBarProps {
  tab: TargetTab;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}

export function FilterBar({ tab, filters, onChange, onReset }: FilterBarProps) {
  const update = (patch: Partial<FilterState>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 sm:grid-cols-2 lg:grid-cols-12">
      <div className="relative lg:col-span-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search commander or alliance..."
          className="w-full rounded border border-zinc-800 bg-zinc-950 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
      </div>

      <div className="lg:col-span-2">
        <input
          type="text"
          value={filters.allianceTag}
          onChange={(e) => update({ allianceTag: e.target.value })}
          placeholder="Alliance tag (e.g. FRY)"
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:col-span-2">
        <input
          type="number"
          min={1}
          max={40}
          value={filters.minHq}
          onChange={(e) => update({ minHq: e.target.value })}
          placeholder="Min HQ"
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
        <input
          type="number"
          min={1}
          max={40}
          value={filters.maxHq}
          onChange={(e) => update({ maxHq: e.target.value })}
          placeholder="Max HQ"
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
      </div>

      <div className="lg:col-span-3">
        <select
          value={filters.sortBy}
          onChange={(e) => update({ sortBy: e.target.value as SortOption })}
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
        >
          {tab === "expiring" && (
            <option value="expires_asc">Sort: Expiring Soonest</option>
          )}
          <option value="hq_desc">Sort: HQ Highest</option>
          <option value="hq_asc">Sort: HQ Lowest</option>
          <option value="name_asc">Sort: Name A–Z</option>
        </select>
      </div>

      <div className="lg:col-span-1">
        <button
          type="button"
          onClick={onReset}
          title="Reset filters"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="lg:hidden">Reset</span>
        </button>
      </div>
    </div>
  );
}