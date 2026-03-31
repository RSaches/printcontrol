// src/store/settingsStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { AppSettings } from "../types";
import { settingsService } from "../services/settings.service";

interface SettingsStore {
  settings: AppSettings | null;
  loading: boolean;
  fetch: () => Promise<void>;
  update: (key: keyof AppSettings, value: string) => Promise<void>;
  reset: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set) => ({
      settings: null,
      loading: false,

      fetch: async () => {
        set({ loading: true });
        try {
          const settings = await settingsService.getAll();
          set({ settings });
        } finally {
          set({ loading: false });
        }
      },

      update: async (key, value) => {
        await settingsService.update(key as string, value);
        set((state) => ({
          settings: state.settings
            ? { ...state.settings, [key]: value }
            : state.settings,
        }));
      },

      reset: async () => {
        const settings = await settingsService.reset();
        set({ settings });
      },
    }),
    { name: "SettingsStore" }
  )
);
