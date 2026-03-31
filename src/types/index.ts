// src/types/index.ts

export type JobStatus = "PENDING" | "PRINTING" | "COMPLETED" | "FAILED";

export interface PrintJob {
  id: string;
  spooler_job_id: number | null;
  document_name: string;
  user_name: string;
  printer_name: string;
  status: JobStatus;
  pages: number | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

export interface Printer {
  id: string;
  name: string;
  is_online: boolean;
  location: string | null;
}

export interface PrinterStatus {
  printer_name: string;
  is_online: boolean;
  has_paper: boolean;
  has_toner: boolean;
}

export interface JobStats {
  total: number;
  pending: number;
  printing: number;
  completed: number;
  failed: number;
}

export interface PaginatedJobs {
  jobs: PrintJob[];
  total: number;
  page: number;
  per_page: number;
}

export interface AppSettings {
  poll_interval_secs: number;
  job_timeout_mins: number;
  auto_start_monitor: boolean;
  history_retention_days: number;
  notify_on_failed: boolean;
  notify_on_monitor_error: boolean;
  desktop_notification: boolean;
  items_per_page: number;
  theme: "light" | "dark" | "system";
  language: string;
}
