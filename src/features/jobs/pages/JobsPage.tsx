// src/features/jobs/pages/JobsPage.tsx
import { useJobEvents, useJobs } from "../hooks/useJobs";
import { JobsTable } from "../components/JobsTable";
import { useJobStore } from "../../../store/jobStore";
import { useSettingsStore } from "../../../store/settingsStore";
import { useQuery } from "@tanstack/react-query";
import { ReportService } from "../../../services/report.service";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Printer,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  X,
} from "lucide-react";
import type { JobStatus } from "../../../types";

const STATUS_OPTIONS: { value: JobStatus | "all"; label: string }[] = [
  { value: "all",       label: "Todos os status" },
  { value: "PENDING",   label: "Pendente"         },
  { value: "PRINTING",  label: "Imprimindo"       },
  { value: "COMPLETED", label: "Concluído"        },
  { value: "FAILED",    label: "Falhou"           },
];

const KPI_CONFIG = [
  { key: "printing"  as const, label: "Imprimindo",  icon: Printer,      gradient: "var(--gradient-blue)",   fg: "var(--status-printing-fg)" },
  { key: "pending"   as const, label: "Pendentes",   icon: Clock,        gradient: "var(--gradient-amber)",  fg: "var(--status-pending-fg)" },
  { key: "completed" as const, label: "Concluídos",  icon: CheckCircle2, gradient: "var(--gradient-green)",  fg: "var(--status-completed-fg)" },
  { key: "failed"    as const, label: "Falhas",      icon: XCircle,      gradient: "var(--gradient-red)",    fg: "var(--status-failed-fg)" },
];

export function JobsPage() {
  const { filters, page, setFilter, setPage } = useJobStore();
  const { settings } = useSettingsStore();
  const perPage = settings?.items_per_page ?? 20;

  const dateFrom = filters.dateRange[0]
    ? filters.dateRange[0].toISOString().slice(0, 10)
    : null;
  const dateTo = filters.dateRange[1]
    ? filters.dateRange[1].toISOString().slice(0, 10)
    : null;

  const { data, isLoading } = useJobs({
    page,
    perPage,
    status: filters.status,
    search: filters.search,
    dateFrom,
    dateTo,
  });

  const { data: stats } = useQuery({
    queryKey: ["job-stats"],
    queryFn: () => ReportService.getStats(),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  useJobEvents();

  const jobs      = data?.jobs ?? [];
  const total     = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end   = Math.min(page * perPage, total);

  return (
    <div className="p-5 space-y-5 page-enter">
      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KPI_CONFIG.map(({ key, label, icon: Icon, gradient, fg }) => (
            <div
              key={key}
              className="kpi-card"
              style={{ background: gradient }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: `hsl(${fg})` }}>
                    {stats[key]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `hsl(${fg} / 0.12)` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: `hsl(${fg})` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Jobs de Impressão</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total === 0
              ? "Nenhum resultado"
              : `${start}–${end} de ${total} resultado${total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Documento, usuário ou impressora..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="h-9 pl-8 text-xs rounded-lg"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(v) => setFilter("status", v as JobStatus | "all")}
        >
          <SelectTrigger className="h-9 w-44 text-xs rounded-lg">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro de período */}
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={dateFrom ?? ""}
            onChange={(e) =>
              setFilter("dateRange", [
                e.target.value ? new Date(e.target.value + "T00:00:00") : null,
                filters.dateRange[1],
              ])
            }
            className="h-9 w-36 text-xs rounded-lg"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={dateTo ?? ""}
            onChange={(e) =>
              setFilter("dateRange", [
                filters.dateRange[0],
                e.target.value ? new Date(e.target.value + "T00:00:00") : null,
              ])
            }
            className="h-9 w-36 text-xs rounded-lg"
          />
          {(filters.dateRange[0] || filters.dateRange[1]) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setFilter("dateRange", [null, null])}
              title="Limpar período"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <JobsTable data={jobs} isLoading={isLoading} />

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
