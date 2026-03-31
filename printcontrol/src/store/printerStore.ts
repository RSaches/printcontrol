// src/store/printerStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface PrinterStore {
  selectedPrinter: string | null;
  setSelectedPrinter: (name: string | null) => void;
}

export const usePrinterStore = create<PrinterStore>()(
  devtools(
    (set) => ({
      selectedPrinter: null,
      setSelectedPrinter: (name) => set({ selectedPrinter: name }),
    }),
    { name: "PrinterStore" }
  )
);
