import type {
  ScannerStatusResponse,
  ServerListResponse,
  TargetListResponse,
  TargetQueryParams,
} from "@/types/lws";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Abaikan jika body bukan JSON
    }
    throw new ApiError(res.status, detail);
  }

  return (await res.json()) as T;
}

export function fetchServers(signal?: AbortSignal): Promise<ServerListResponse> {
  return requestJson<ServerListResponse>("/api/servers", signal);
}

export function fetchTargets(
  params: TargetQueryParams,
  signal?: AbortSignal
): Promise<TargetListResponse> {
  const query = new URLSearchParams({
    server_id: String(params.server_id),
    tab: params.tab,
  });

  if (params.min_hq !== undefined) query.set("min_hq", String(params.min_hq));
  if (params.max_hq !== undefined) query.set("max_hq", String(params.max_hq));
  if (params.alliance_tag?.trim()) {
    query.set("alliance_tag", params.alliance_tag.trim());
  }
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.sort_by) query.set("sort_by", params.sort_by);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  return requestJson<TargetListResponse>(`/api/targets?${query.toString()}`, signal);
}

export function fetchScannerStatus(
  serverId: number,
  signal?: AbortSignal
): Promise<ScannerStatusResponse> {
  return requestJson<ScannerStatusResponse>(
    `/api/scanner/status/${serverId}`,
    signal
  );
}