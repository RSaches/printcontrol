// src/services/report.service.ts
import { invoke } from "@tauri-apps/api/core";
import { parseAppError } from "../utils/errors";
import type { JobStats, PrintJob } from "../types";

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (raw) {
    throw parseAppError(raw);
  }
}

export const ReportService = {
  getStats: () => tauriInvoke<JobStats>("get_job_stats"),

  getByPeriod: (from: string, to: string) =>
    tauriInvoke<PrintJob[]>("get_jobs_by_period", { from, to }),
};
