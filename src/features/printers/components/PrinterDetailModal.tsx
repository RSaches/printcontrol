// src/features/printers/components/PrinterDetailModal.tsx
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  ResponsiveContainer,
} from "recharts";
import {
  Printer,
  MapPin,
  FileText,
  User,
  Calendar,
  Layers,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { format as fmtDate, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { PrinterService } from "../../../services/printer.service";
import { JobService } from "../../../services/job.service";
import { StatusBadge } from "../../../components/shared/StatusBadge";
import { cn } from "../../../utils/cn";
import type { Printer as PrinterType, PrinterHealthScore } from "../../../types";

// ─── Paleta de cores para formatos ─────────────────────────────────────────
const FORMAT_COLORS = [
  "hsl(221, 83%, 53%)",   // azul  – A4
  "hsl(142, 72%, 35%)",   // verde – A3
  "hsl(280, 65%, 52%)",   // roxo  – A5
  "hsl(38, 92%, 50%)",    // âmbar – Carta
  "hsl(0, 78%, 55%)",     // vermelho – Ofício
  "hsl(190, 70%, 44%)",   // ciano
  "hsl(320, 65%, 52%)",   // rosa
  "hsl(160, 60%, 40%)",   // esmeralda
];

function getColor(index: number): string {
  return FORMAT_COLORS[index % FORMAT_COLORS.length];
}

// ─── Tooltip customizado para gráficos ─────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-xs space-y-1">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold tabular-nums text-foreground">
            {p.value.toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI card pequeno ───────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
        <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide leading-none">
          {label}
        </p>
        <p className="text-lg font-bold tabular-nums leading-tight mt-0.5">
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </p>
      </div>
    </div>
  );
}

// ─── Legenda customizada do pie ─────────────────────────────────────────────
function PieLegend({
  data,
}: {
  data: { format: string; total_pages: number; job_count: number }[];
}) {
  const total = data.reduce((s, d) => s + d.total_pages, 0);
  return (
    <div className="space-y-1.5 mt-2">
      {data.map((d, i) => {
        const pct = total > 0 ? ((d.total_pages / total) * 100).toFixed(1) : "0";
        return (
          <div key={d.format} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: getColor(i) }}
            />
            <span className="flex-1 truncate text-foreground">{d.format}</span>
            <span className="tabular-nums text-muted-foreground">{pct}%</span>
            <span className="tabular-nums font-semibold w-14 text-right">
              {d.total_pages.toLocaleString("pt-BR")} fls
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface PrinterDetailModalProps {
  printer: PrinterType;
  healthScore: PrinterHealthScore | null;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Componente principal ───────────────────────────────────────────────────
export function PrinterDetailModal({
  printer,
  healthScore: hs,
  isOpen,
  onClose,
}: PrinterDetailModalProps) {
  const enabled = isOpen;

  // Estatísticas por formato de papel
  const { data: formatStats = [], isLoading: loadingStats } = useQuery({
    queryKey: ["printer-format-stats", printer.name],
    queryFn: () => PrinterService.getFormatStats(printer.name),
    enabled,
    staleTime: 60_000,
  });

  // Histórico de jobs (últimos 50, ordenados por data desc)
  const { data: jobsResult, isLoading: loadingJobs } = useQuery({
    queryKey: ["printer-jobs", printer.name],
    queryFn: () => JobService.getPaginated(1, 50, undefined, undefined, printer.name),
    enabled,
    staleTime: 30_000,
  });
  const jobs = jobsResult?.jobs ?? [];

  // Totais derivados dos format stats
  const totalJobs = formatStats.reduce((s, f) => s + f.job_count, 0);
  const totalPages = formatStats.reduce((s, f) => s + f.total_pages, 0);
  const hs30 = hs ?? {
    score: null, grade: "—", total_30d: 0, completed_30d: 0, failed_30d: 0, active_jobs: 0,
  };

  // Dados para o gráfico de barras (horizontal, top 8 formatos por folhas)
  const barData = formatStats.slice(0, 8).map((f, i) => ({
    name: f.format,
    Folhas: f.total_pages,
    Jobs: f.job_count,
    color: getColor(i),
  }));

  // Dados para o pie (por páginas)
  const pieData = formatStats.slice(0, 8).map((f, i) => ({
    name: f.format,
    value: f.total_pages,
    color: getColor(i),
  }));

  const hasData = formatStats.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl w-full max-h-[92vh] overflow-y-auto p-0 gap-0"
      >
        {/* ── Cabeçalho ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/30">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                printer.is_online
                  ? "bg-[hsl(var(--status-completed-bg))]"
                  : "bg-muted"
              )}
            >
              <Printer
                className={cn(
                  "w-6 h-6",
                  printer.is_online
                    ? "text-[hsl(var(--status-completed-fg))]"
                    : "text-muted-foreground"
                )}
                strokeWidth={1.75}
              />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold leading-tight truncate">
                {printer.name}
              </DialogTitle>
              {printer.location && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {printer.location}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                    printer.is_online
                      ? "bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed-fg))] border-emerald-200/40"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      printer.is_online
                        ? "bg-[hsl(var(--status-completed))] animate-pulse"
                        : "bg-muted-foreground"
                    )}
                  />
                  {printer.is_online ? "Online" : "Offline"}
                </span>
                {hs && hs.score !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    Saúde:{" "}
                    <span className="font-semibold text-foreground">
                      {hs.grade} ({hs.score}/100)
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon={Layers}
              label="Total de Jobs"
              value={totalJobs || hs30.total_30d}
              colorClass="bg-blue-500/10 text-blue-500"
            />
            <KpiCard
              icon={FileText}
              label="Folhas Impressas"
              value={totalPages}
              colorClass="bg-purple-500/10 text-purple-500"
            />
            <KpiCard
              icon={CheckCircle2}
              label="Concluídos (30d)"
              value={hs30.completed_30d}
              colorClass="bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed-fg))]"
            />
            <KpiCard
              icon={XCircle}
              label="Falhas (30d)"
              value={hs30.failed_30d}
              colorClass="bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-fg))]"
            />
          </div>

          {/* ── Gráficos de formato de papel ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Consumo por Formato de Papel</h3>
            </div>

            {loadingStats && (
              <div className="h-48 rounded-xl bg-muted/30 animate-pulse" />
            )}

            {!loadingStats && !hasData && (
              <div className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed bg-muted/10 text-sm text-muted-foreground gap-1">
                <Layers className="w-6 h-6 opacity-30" />
                <span>Sem dados de formato disponíveis</span>
                <span className="text-xs opacity-60">
                  O formato é preenchido pelo driver da impressora
                </span>
              </div>
            )}

            {!loadingStats && hasData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Donut — distribuição de páginas por formato */}
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Distribuição de Folhas (%)
                  </p>
                  <div className="flex gap-4 items-start">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={entry.name} fill={getColor(i)} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 min-w-0">
                      <PieLegend data={formatStats.slice(0, 8)} />
                    </div>
                  </div>
                </div>

                {/* Barras horizontais — folhas por formato */}
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Folhas por Formato
                  </p>
                  <ResponsiveContainer width="100%" height={Math.max(120, barData.length * 32)}>
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v) =>
                          v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                        }
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={64}
                        tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                      />
                      <Bar dataKey="Folhas" radius={[0, 4, 4, 0]}>
                        {barData.map((entry, i) => (
                          <Cell key={entry.name} fill={getColor(i)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tabela resumo de formatos */}
            {!loadingStats && hasData && (
              <div className="rounded-xl border overflow-hidden mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Formato
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                        Jobs
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                        Folhas
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                        Média/Job
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formatStats.map((f, i) => (
                      <tr
                        key={f.format}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2.5 flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ background: getColor(i) }}
                          />
                          <span className="font-medium">{f.format}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {f.job_count.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                          {f.total_pages.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {f.job_count > 0
                            ? (f.total_pages / f.job_count).toFixed(1)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td className="px-4 py-2 font-semibold">Total</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">
                        {totalJobs.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold text-primary">
                        {totalPages.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {totalJobs > 0 ? (totalPages / totalJobs).toFixed(1) : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Histórico de impressões ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Histórico de Impressões</h3>
              {!loadingJobs && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {jobs.length} registros
                </span>
              )}
            </div>

            {loadingJobs && (
              <div className="space-y-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 rounded-lg bg-muted/30 animate-pulse" />
                ))}
              </div>
            )}

            {!loadingJobs && jobs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-24 rounded-xl border border-dashed bg-muted/10 text-sm text-muted-foreground gap-1">
                <FileText className="w-5 h-5 opacity-30" />
                <span>Nenhum job registrado para esta impressora</span>
              </div>
            )}

            {!loadingJobs && jobs.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-140">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3" />
                            Documento
                          </div>
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            Usuário
                          </div>
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                          Pág.
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                          Formato
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Calendar className="w-3 h-3" />
                            Data
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr
                          key={job.id}
                          className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-2.5 max-w-50">
                            <p
                              className="truncate font-medium text-foreground"
                              title={job.document_name}
                            >
                              {job.document_name}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground max-w-25">
                            <p className="truncate" title={job.user_name}>
                              {job.user_name}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <StatusBadge status={job.status} />
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {job.pages?.toLocaleString("pt-BR") ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {job.paper_format ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-muted/60 text-foreground font-medium text-[10px] uppercase tracking-wide">
                                {job.paper_format}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                            {fmtDate(parseISO(job.created_at), "dd/MM/yy HH:mm", {
                              locale: ptBR,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {jobsResult && jobsResult.total > 50 && (
                  <div className="px-4 py-2.5 bg-muted/20 border-t text-xs text-muted-foreground text-center">
                    Exibindo os 50 registros mais recentes de{" "}
                    {jobsResult.total.toLocaleString("pt-BR")} no total
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
