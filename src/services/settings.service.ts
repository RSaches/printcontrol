// src/services/settings.service.ts
import { invoke } from "@tauri-apps/api/core";
import { AppSettings } from "../types";

export const settingsService = {
  getAll: (): Promise<AppSettings> => invoke("get_settings"),

  update: (key: string, value: string): Promise<void> =>
    invoke("update_setting", { key, value }),

  reset: (): Promise<AppSettings> => invoke("reset_settings"),

  clearHistory: (days: number): Promise<number> =>
    invoke("clear_history", { days }),

  getDbPath: (): Promise<string> => invoke("get_db_path"),
};
