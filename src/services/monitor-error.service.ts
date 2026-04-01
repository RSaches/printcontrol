// src/services/monitor-error.service.ts
import { invoke } from "@tauri-apps/api/core";
import { parseAppError } from "../utils/errors";

export interface MonitorErrorEntry {
  id: number;
  message: string;
  occurred_at: string;
}

export interface PaginatedErrors {
  errors: MonitorErrorEntry[];
  total: number;
  page: number;
  per_page: number;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (raw) {
    throw parseAppError(raw);
  }
}

export const MonitorErrorService = {
  getPaginated: (page: number, perPage: number) =>
    tauriInvoke<PaginatedErrors>("get_monitor_errors", { page, perPage }),

  clearAll: () =>
    tauriInvoke<number>("clear_monitor_errors"),
};
