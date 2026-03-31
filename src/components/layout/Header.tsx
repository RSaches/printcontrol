// src/components/layout/Header.tsx
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useNotificationStore } from "../../store/notificationStore";
import { Badge } from "../ui/badge";
import { ReportService } from "../../services/report.service";
import { AlertTriangle, Printer, Clock, CheckCircle2, XCircle } from "lucide-react";

const ROUTE_TITLES: Record<string, string> = {
  "/jobs":      "Jobs de Impressão",
  "/printers":  "Impressoras",
  "/reports":   "Relatórios",
  "/settings":  "Configurações",
};

export function Header() {
  const { pathname } = useLocation();
  const { monitorErrors, clearErrors } = useNotificationStore();
  const title = ROUTE_TITLES[pathname] ?? "PrintControl";

  const { data: stats } = useQuery({
    queryKey: ["job-stats"],
    queryFn: () => ReportService.getStats(),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  return (
    <header className="h-12 shrink-0 border-b px-5 flex items-center justify-between bg-background/80 backdrop-blur-sm">
      <h2 className="font-semibold text-[15px] tracking-tight">{title}</h2>

      <div className="flex items-center gap-3">
        {/* Live KPI pills */}
        {stats && (
          <div className="hidden md:flex items-center gap-2 text-[11px]">
            {stats.printing > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--status-printing-bg))] text-[hsl(var(--status-printing-fg))] font-medium">
                <Printer className="w-3 h-3" />
                {stats.printing}
              </span>
            )}
            {stats.pending > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-fg))] font-medium">
                <Clock className="w-3 h-3" />
                {stats.pending}
              </span>
            )}
            {stats.failed > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-fg))] font-medium">
                <XCircle className="w-3 h-3" />
                {stats.failed}
              </span>
            )}
            {stats.completed > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed-fg))] font-medium">
                <CheckCircle2 className="w-3 h-3" />
                {stats.completed}
              </span>
            )}
          </div>
        )}

        {/* Monitor errors */}
        {monitorErrors.length > 0 && (
          <button
            onClick={clearErrors}
            className="flex items-center gap-1.5 outline-none group"
            title="Clique para limpar os erros"
          >
            <Badge
              variant="destructive"
              className="gap-1 text-[11px] cursor-pointer group-hover:opacity-80 transition-opacity"
            >
              <AlertTriangle className="w-3 h-3" />
              {monitorErrors.length} erro{monitorErrors.length > 1 ? "s" : ""}
            </Badge>
          </button>
        )}
      </div>
    </header>
  );
}
