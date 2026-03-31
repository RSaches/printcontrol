// src/store/notificationStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface MonitorError {
  id: string;
  message: string;
  timestamp: string;
}

interface NotificationStore {
  monitorErrors: MonitorError[];
  addMonitorError: (message: string) => void;
  clearErrors: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set) => ({
      monitorErrors: [],

      addMonitorError: (message) =>
        set((state) => ({
          monitorErrors: [
            ...state.monitorErrors.slice(-49), // mantém últimos 50
            {
              id: crypto.randomUUID(),
              message,
              timestamp: new Date().toISOString(),
            },
          ],
        })),

      clearErrors: () => set({ monitorErrors: [] }),
    }),
    { name: "NotificationStore" }
  )
);
