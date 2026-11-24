export type ScannerState = "idle" | "scanning" | "rate_limited" | "error";
export type TargetTab = "unshielded" | "expiring";
export type SortOption = "hq_desc" | "hq_asc" | "expires_asc" | "name_asc";

export interface ServerSummary {
  server_id: number;
  status: ScannerState;
  last_success_at: string | null;
  bases_scanned: number;
  error_message: string | null;
}

export interface ServerListResponse {
  servers: ServerSummary[];
}

export interface TargetItem {
  uid: string;
  name: string;
  alliance_tag: string | null;
  hq_level: number;
  x: number;
  y: number;
  is_shielded: boolean;
  shield_expires_at: string | null;
  last_scanned_at: string;
}

export interface TargetListResponse {
  server_id: number;
  tab: TargetTab;
  server_time_utc: string;
  total: number;
  page: number;
  limit: number;
  items: TargetItem[];
}

export interface ScannerStatusResponse {
  server_id: number;
  status: ScannerState;
  last_success_at: string | null;
  last_attempt_at: string;
  bases_scanned: number;
  consecutive_failures: number;
  error_message: string | null;
}

export interface TargetQueryParams {
  server_id: number;
  tab: TargetTab;
  min_hq?: number;
  max_hq?: number;
  alliance_tag?: string;
  search?: string;
  sort_by?: SortOption;
  page?: number;
  limit?: number;
}