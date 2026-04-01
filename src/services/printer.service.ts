// src/services/printer.service.ts
import { invoke } from "@tauri-apps/api/core";
import { parseAppError } from "../utils/errors";
import type { Printer, PrinterHealthScore } from "../types";

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (raw) {
    throw parseAppError(raw);
  }
}

export const PrinterService = {
  getAll: () => tauriInvoke<Printer[]>("get_printers"),
  getHealthScores: () => tauriInvoke<PrinterHealthScore[]>("get_printer_health_scores"),
};
