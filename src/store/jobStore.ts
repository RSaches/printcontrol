// src/store/jobStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { JobStatus } from "../types";

export interface JobFilters {
  status: JobStatus | "all";
  search: string;
  dateRange: [Date | null, Date | null];
}

interface JobStore {
  filters: JobFilters;
  page: number;
  selectedIds: Set<string>;
  setFilter: <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => void;
  setPage: (page: number) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  resetFilters: () => void;
}

const defaultFilters: JobFilters = {
  status: "all",
  search: "",
  dateRange: [null, null],
};

export const useJobStore = create<JobStore>()(
  devtools(
    (set) => ({
      filters: defaultFilters,
      page: 1,
      selectedIds: new Set(),

      setFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value },
          // Volta para página 1 sempre que o filtro muda
          page: 1,
        })),

      setPage: (page) => set({ page }),

      toggleSelection: (id) =>
        set((state) => {
          const next = new Set(state.selectedIds);
          next.has(id) ? next.delete(id) : next.add(id);
          return { selectedIds: next };
        }),

      clearSelection: () => set({ selectedIds: new Set() }),
      resetFilters: () => set({ filters: defaultFilters, page: 1 }),
    }),
    { name: "JobStore" }
  )
);
