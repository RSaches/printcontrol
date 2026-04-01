// src/features/reports/pages/ReportsPage.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportService } from "../../../services/report.service";
import { FileText, CheckCircle2, XCircle, Printer, User, Layers, Activity, Flame } from "lucide-react";
import type { PrintJob } from "../../../types";

const STATUS_COLORS: Record<string, { light: string; dark: string }> = {
  completed: { light: "#16a34a", dark: "#4ade80" },
  failed:    { light: "#dc2626", dark: "#f87171" },
  printing:  { light: "#2563eb", dark: "#60a5fa" },
  pending:   { light: "#d97706", dark: "#fbbf24" },
};

const PERIOD_OPTIONS = [
  { label: "7 dias",  days: 7  },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

const KPI_CONFIG = [
  { key: "total_jobs"     as const, label: "Total de Jobs",   icon: FileText,    gradient: "var(--gradient-blue)",  fg: "var(--status-printing-fg)" },
  { key: "total_pages"    as const, label: "Total de Páginas", icon: Layers,      gradient: "var(--gradient-green)", fg: "var(--status-completed-fg)" },
  { key: "failed_jobs"    as const, label: "Jobs com Falha",  icon: XCircle,     gradient: "var(--gradient-red)",   fg: "var(--status-failed-fg)" },
  { key: "avg_pages"      as const, label: "Média Págs/Job", icon: CheckCircle2, gradient: "var(--gradient-amber)", fg: "var(--status-pending-fg)" },
];

// --- Data Aggregators ---

function buildDailyStats(jobs: PrintJob[], days: number) {
  const map: Record<string, { date: string; jobs: number; pages: number }> = {};
  
  // Initialize map with all days in period to avoid gaps
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), i);
    const dayKey = format(d, "yyyy-MM-dd");
    map[dayKey] = {
      date: format(d, "dd/MM", { locale: ptBR }),
      jobs: 0,
      pages: 0,
    };
  }

  for (const job of jobs) {
    const dayKey = job.created_at.slice(0, 10);
    if (map[dayKey]) {
      map[dayKey].jobs += 1;
      map[dayKey].pages += (job.pages || 0);
    }
  }

  return Object.entries(map).sort(([a], [b]) => {
    return a.localeCompare(b);
  }).map(entry => entry[1]); // Retorna apenas o valor (o objeto de estatísticas)
}

function buildPrinterStats(jobs: PrintJob[]) {
  const map: Record<string, number> = {};
  for (const job of jobs) {
    map[job.printer_name] = (map[job.printer_name] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function buildUserStats(jobs: PrintJob[]) {
  const map: Record<string, number> = {};
  for (const job of jobs) {
    map[job.user_name] = (map[job.user_name] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

const DAYS_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildHeatmap(jobs: PrintJob[]): number[][] {
  // grid[dayOfWeek][hour] = count
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const job of jobs) {
    const d = new Date(job.created_at);
    grid[d.getDay()][d.getHours()]++;
  }
  return grid;
}

interface HeatmapCellProps {
  count: number;
  max: number;
  day: string;
  hour: number;
}

function HeatmapCell({ count, max, day, hour }: HeatmapCellProps) {
  const intensity = max === 0 ? 0 : count / max;
  const opacity = count === 0 ? 0.06 : 0.15 + intensity * 0.85;
  const label = `${day} ${String(hour).padStart(2, "0")}h — ${count} job${count !== 1 ? "s" : ""}`;

  return (
    <div
      title={label}
      className="rounded-sm cursor-default transition-transform hover:scale-125 hover:z-10 relative"
      style={{
        background: `hsl(var(--status-printing-fg) / ${opacity})`,
        aspectRatio: "1",
      }}
    />
  );
}

// --- Dashboard Component ---

export function ReportsPage() {
  const [periodDays, setPeriodDays] = useState(30);
  const isDark = document.documentElement.classList.contains("dark");

  const to   = new Date().toISOString();
  const from = subDays(startOfDay(new Date()), periodDays).toISOString();

  const { data: globalStats } = useQuery({
    queryKey: ["job-stats"],
    queryFn:  () => ReportService.getStats(),
    staleTime: 60_000,
  });

  const { data: jobsInPeriod = [] } = useQuery({
    queryKey: ["jobs-period", periodDays],
    queryFn:  () => ReportService.getByPeriod(from, to),
    staleTime: 60_000,
  });

  // Derived Stats for the selected period
  const { dailyStats, printerStats, userStats, periodKPIs, heatmap, heatmapMax } = useMemo(() => {
    const daily = buildDailyStats(jobsInPeriod, periodDays);
    const printers = buildPrinterStats(jobsInPeriod);
    const users = buildUserStats(jobsInPeriod);
    const hm = buildHeatmap(jobsInPeriod);
    const max = Math.max(1, ...hm.flat());

    const totalJobs = jobsInPeriod.length;
    const totalPages = jobsInPeriod.reduce((acc, job) => acc + (job.pages || 0), 0);
    const failedJobs = jobsInPeriod.filter(j => j.status === "FAILED").length;
    const avgPages = totalJobs > 0 ? (totalPages / totalJobs).toFixed(1) : "0";

    return {
      dailyStats: daily,
      printerStats: printers,
      userStats: users,
      heatmap: hm,
      heatmapMax: max,
      periodKPIs: {
        total_jobs: totalJobs,
        total_pages: totalPages,
        failed_jobs: failedJobs,
        avg_pages: avgPages
      }
    };
  }, [jobsInPeriod, periodDays]);

  const pieData = globalStats
    ? [
        { name: "Concluídos", value: globalStats.completed, color: isDark ? STATUS_COLORS.completed.dark : STATUS_COLORS.completed.light },
        { name: "Falhos",     value: globalStats.failed,    color: isDark ? STATUS_COLORS.failed.dark : STATUS_COLORS.failed.light },
        { name: "Imprimindo", value: globalStats.printing,  color: isDark ? STATUS_COLORS.printing.dark : STATUS_COLORS.printing.light },
        { name: "Pendentes",  value: globalStats.pending,   color: isDark ? STATUS_COLORS.pending.dark : STATUS_COLORS.pending.light },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="p-5 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Relatórios</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Visão analítica do parque de impressão</p>
        </div>
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setPeriodDays(opt.days)}
              className={[
                "text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg font-bold transition-all duration-200",
                periodDays === opt.days
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Dinâmicos do Período */}
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
                  {periodKPIs[key as keyof typeof periodKPIs]}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase opacity-80">{label}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `hsl(${fg} / 0.15)` }}>
                <Icon className="w-5 h-5" style={{ color: `hsl(${fg})` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        
        {/* Volume de Jobs por Dia (AreaChart Moderno) */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Volume de Jobs
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isDark ? "#3b82f6" : "#2563eb"} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={isDark ? "#3b82f6" : "#2563eb"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}
              />
              <Area 
                type="monotone" 
                dataKey="jobs" 
                stroke={isDark ? "#60a5fa" : "#2563eb"} 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorJobs)" 
                name="Jobs"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Consumo de Páginas (AreaChart Complementar) */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            Consumo de Páginas
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false} 
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false} 
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area 
                type="monotone" 
                dataKey="pages" 
                stroke="#10b981" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorPages)" 
                name="Páginas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Volume por Impressora (BarChart) */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" />
            Uso por Impressora
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={printerStats} layout="vertical" margin={{ left: 40, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                width={120}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="value" fill="url(#colorJobs)" radius={[0, 4, 4, 0]} name="Jobs" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ranking de Usuários (BarChart) */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-amber-500" />
            Top 5 Usuários
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={userStats} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Jobs" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Heatmap de Atividade */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          Heatmap de Atividade
          <span className="text-xs text-muted-foreground font-normal ml-1">
            — dia da semana × hora do dia
          </span>
        </h2>

        {/* Eixo de horas */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="flex items-center gap-1 mb-1 pl-10">
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-[9px] text-muted-foreground/60 tabular-nums"
                >
                  {h % 3 === 0 ? `${String(h).padStart(2, "0")}h` : ""}
                </div>
              ))}
            </div>

            {/* Grid: 7 linhas (dias) × 24 colunas (horas) */}
            <div className="space-y-1">
              {heatmap.map((hourCounts, dayIdx) => (
                <div key={dayIdx} className="flex items-center gap-1">
                  <span className="w-9 shrink-0 text-[10px] text-muted-foreground text-right pr-1">
                    {DAYS_LABEL[dayIdx]}
                  </span>
                  {hourCounts.map((count, hour) => (
                    <div key={hour} className="flex-1">
                      <HeatmapCell
                        count={count}
                        max={heatmapMax}
                        day={DAYS_LABEL[dayIdx]}
                        hour={hour}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Legenda de intensidade */}
            <div className="flex items-center gap-2 mt-3 justify-end">
              <span className="text-[10px] text-muted-foreground">Menos</span>
              {[0.06, 0.25, 0.45, 0.65, 1].map((op, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{ background: `hsl(var(--status-printing-fg) / ${op})` }}
                />
              ))}
              <span className="text-[10px] text-muted-foreground">Mais</span>
            </div>
          </div>
        </div>
      </div>

      {/* PieChart - Distribuição Global (Sempre visível) */}
      {pieData.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-4">Eficiência de Impressão (Status Global)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 items-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={70}
                  strokeWidth={5}
                  stroke="hsl(var(--card))"
                  paddingAngle={5}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-4 pr-10">
              {pieData.map((d, i) => (
                 <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      <span className="text-sm font-medium">{d.name}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{d.value}</span>
                 </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


