// src/utils/format.ts
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(isoString: string): string {
  try {
    return format(parseISO(isoString), "dd/MM/yyyy HH:mm:ss", {
      locale: ptBR,
    });
  } catch {
    return isoString;
  }
}

export function formatDateShort(isoString: string): string {
  try {
    return format(parseISO(isoString), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return isoString;
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function formatPages(pages: number | null): string {
  if (pages === null) return "—";
  return `${pages} ${pages === 1 ? "página" : "páginas"}`;
}
