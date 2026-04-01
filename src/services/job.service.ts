// src/services/job.service.ts
import { invoke } from "@tauri-apps/api/core";
import { parseAppError } from "../utils/errors";
import type { JobStats, PaginatedJobs, PrintJob } from "../types";

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (raw) {
    throw parseAppError(raw);
  }
}

export const JobService = {
  getAll: () => tauriInvoke<PrintJob[]>("get_jobs"),

  getPaginated: (
    page: number,
    perPage: number,
    status?: string,
    search?: string,
    dateFrom?: string | null,
    dateTo?: string | null,
  ) =>
    tauriInvoke<PaginatedJobs>("get_jobs_paginated", {
      page,
      perPage,
      status: status && status !== "all" ? status : null,
      search: search?.trim() || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    }),

  getByPeriod: (from: string, to: string) =>
    tauriInvoke<PrintJob[]>("get_jobs_by_period", { from, to }),

  getStats: () => tauriInvoke<JobStats>("get_job_stats"),
};
