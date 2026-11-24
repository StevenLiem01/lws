"use client";

import { useState } from "react";
import { Check, Copy, ShieldOff } from "lucide-react";
import { CountdownBadge } from "@/components/CountdownBadge";
import type { TargetItem, TargetTab } from "@/types/lws";

interface TargetTableProps {
  items: TargetItem[];
  tab: TargetTab;
  isLoading: boolean;
  nowMs: number;
  clockOffsetMs: number;
}

export function TargetTable({
  items,
  tab,
  isLoading,
  nowMs,
  clockOffsetMs,
}: TargetTableProps) {
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const handleCopy = async (item: TargetItem) => {
    const coords = `${item.x}:${item.y}`;
    try {
      await navigator.clipboard.writeText(coords);
      setCopiedUid(item.uid);
      window.setTimeout(() => {
        setCopiedUid((prev) => (prev === item.uid ? null : prev));
      }, 1500);
    } catch {
      // Clipboard API mungkin diblokir di konteks non-HTTPS selain localhost
    }
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-10 text-center text-xs text-zinc-400">
        Loading targets...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-10 text-center text-xs text-zinc-400">
        No targets match the current filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60 text-[11px] uppercase tracking-wider text-zinc-400">
            <th className="px-4 py-3 font-medium">Commander</th>
            <th className="px-4 py-3 font-medium">Alliance</th>
            <th className="px-4 py-3 font-medium">HQ</th>
            <th className="px-4 py-3 font-medium">Coordinates</th>
            <th className="px-4 py-3 font-medium">
              {tab === "expiring" ? "Shield Remaining" : "Status"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {items.map((item) => {
            const isCopied = copiedUid === item.uid;
            return (
              <tr
                key={item.uid}
                className="transition-colors hover:bg-zinc-900/50"
              >
                <td className="px-4 py-3 font-medium text-zinc-100">
                  {item.name}
                </td>
                <td className="px-4 py-3">
                  {item.alliance_tag ? (
                    <span className="inline-flex rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
                      [{item.alliance_tag}]
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold text-zinc-100">
                    Lv.{item.hq_level}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(item)}
                    className="inline-flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
                    title="Copy coordinates"
                  >
                    <span>
                      X:{item.x} Y:{item.y}
                    </span>
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {tab === "expiring" ? (
                    <CountdownBadge
                      expiresAt={item.shield_expires_at}
                      nowMs={nowMs}
                      clockOffsetMs={clockOffsetMs}
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                      <ShieldOff className="h-3 w-3 text-zinc-500" />
                      Unshielded
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}