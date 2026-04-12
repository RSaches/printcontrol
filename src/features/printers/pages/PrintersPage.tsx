// src/features/printers/pages/PrintersPage.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, RefreshCw, MapPin, WifiOff, ChevronRight } from "lucide-react";
import { PrinterService } from "../../../services/printer.service";
import { Button } from "../../../components/ui/button";
import { PrinterDetailModal } from "../components/PrinterDetailModal";
import { cn } from "../../../utils/cn";
import type { Printer as PrinterType, PrinterHealthScore } from "../../../types";

// ─── Score helpers ─────────────────────────────────────────────────────────

const GRADE_STYLES: Record<string, { ring: string; bg: string; text: string; label: string }> = {
  A:  { ring: "ring-emerald-400/60", bg: "bg-emerald-500/10", text: "text-emerald-500",  label: "Excelente"  },
  B:  { ring: "ring-green-400/60",   bg: "bg-green-500/10",   text: "text-green-500",    label: "Bom"        },
  C:  { ring: "ring-yellow-400/60",  bg: "bg-yellow-500/10",  text: "text-yellow-500",   label: "Regular"    },
  D:  { ring: "ring-orange-400/60",  bg: "bg-orange-500/10",  text: "text-orange-500",   label: "Atenção"    },
  F:  { ring: "ring-red-400/60",     bg: "bg-red-500/10",     text: "text-red-500",      label: "Crítico"    },
  "—":{ ring: "ring-border",         bg: "bg-muted/30",       text: "text-muted-foreground", label: "Sem dados" },
};

interface ScoreRingProps {
  hs: PrinterHealthScore;
}

function ScoreRing({ hs }: ScoreRingProps) {
  const s = GRADE_STYLES[hs.grade] ?? GRADE_STYLES["—"];
  const pct = hs.score ?? 0;

  const R = 22;
  const circ = 2 * Math.PI * R;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={R} fill="none" strokeWidth="5" className="stroke-muted" />
          {hs.score !== null && (
            <circle
              cx="28" cy="28" r={R}
              fill="none"
              strokeWidth="5"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              className={cn(
                "transition-all duration-700",
                hs.grade === "A" && "stroke-emerald-500",
                hs.grade === "B" && "stroke-green-500",
                hs.grade === "C" && "stroke-yellow-500",
                hs.grade === "D" && "stroke-orange-500",
                hs.grade === "F" && "stroke-red-500",
              )}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-bold leading-none", s.text)}>{hs.grade}</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {hs.score !== null ? `${hs.score}/100` : "—"}
      </span>
    </div>
  );
}

interface StatPillProps {
  label: string;
  value: number;
  variant?: "default" | "success" | "danger" | "warning";
}

function StatPill({ label, value, variant = "default" }: StatPillProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-2.5 py-1.5 rounded-lg min-w-13",
        variant === "success" && "bg-[hsl(var(--status-completed-bg))]",
        variant === "danger"  && "bg-[hsl(var(--status-failed-bg))]",
        variant === "warning" && "bg-[hsl(var(--status-pending-bg))]",
        variant === "default" && "bg-muted/40",
      )}
    >
      <span
        className={cn(
          "text-base font-bold tabular-nums leading-none",
          variant === "success" && "text-[hsl(var(--status-completed-fg))]",
          variant === "danger"  && "text-[hsl(var(--status-failed-fg))]",
          variant === "warning" && "text-[hsl(var(--status-pending-fg))]",
          variant === "default" && "text-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function PrintersPage() {
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterType | null>(null);

  const { data: printers = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["printers"],
    queryFn: () => PrinterService.getAll(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: healthScores = [] } = useQuery({
    queryKey: ["printer-health-scores"],
    queryFn: () => PrinterService.getHealthScores(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const scoreByName = new Map<string, PrinterHealthScore>(
    healthScores.map((s) => [s.printer_name, s])
  );

  const onlineCount = printers.filter((p) => p.is_online).length;

  const selectedScore = selectedPrinter
    ? (scoreByName.get(selectedPrinter.name) ?? null)
    : null;

  return (
    <div className="p-5 space-y-5 page-enter">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Impressoras</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {printers.length === 0
              ? "Nenhuma impressora detectada"
              : `${onlineCount} de ${printers.length} online · clique em uma impressora para detalhes`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-5 space-y-3 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="w-14 h-14 rounded-full bg-muted shrink-0" />
              </div>
              <div className="flex gap-2 pt-1">
                <div className="h-10 bg-muted rounded-lg flex-1" />
                <div className="h-10 bg-muted rounded-lg flex-1" />
                <div className="h-10 bg-muted rounded-lg flex-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && printers.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 rounded-xl border border-dashed bg-muted/5">
          <WifiOff className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma impressora detectada</p>
          <p className="text-xs text-muted-foreground/60">
            Verifique se as impressoras estão conectadas
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs mt-1">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Grid de impressoras */}
      {!isLoading && printers.length > 0 && (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {printers.map((printer) => {
            const hs = scoreByName.get(printer.name) ?? {
              printer_name: printer.name,
              score: null,
              grade: "—",
              total_30d: 0,
              completed_30d: 0,
              failed_30d: 0,
              active_jobs: 0,
            };
            const gradeStyle = GRADE_STYLES[hs.grade] ?? GRADE_STYLES["—"];

            return (
              <button
                key={printer.id}
                type="button"
                onClick={() => setSelectedPrinter(printer)}
                className={cn(
                  "rounded-xl border bg-card p-5 space-y-4 shadow-sm card-hover text-left w-full",
                  "transition-all duration-150 hover:border-primary/40 hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  !printer.is_online && "opacity-60"
                )}
              >
                {/* Linha superior: ícone + nome + status + score */}
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      printer.is_online
                        ? "bg-[hsl(var(--status-completed-bg))]"
                        : "bg-muted"
                    )}
                  >
                    <Printer
                      className={cn(
                        "w-5 h-5",
                        printer.is_online
                          ? "text-[hsl(var(--status-completed-fg))]"
                          : "text-muted-foreground"
                      )}
                      strokeWidth={1.75}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" title={printer.name}>
                      {printer.name}
                    </p>
                    {printer.location && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">
                          {printer.location}
                        </p>
                      </div>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                        printer.is_online
                          ? "bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed-fg))] border-[hsl(var(--status-completed)/0.3)]"
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
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <ScoreRing hs={hs} />
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                  </div>
                </div>

                {/* Rótulo do grade */}
                <div className={cn("text-center text-[10px] font-semibold uppercase tracking-wider rounded-md py-1", gradeStyle.bg, gradeStyle.text)}>
                  {gradeStyle.label}
                  {hs.total_30d > 0 && (
                    <span className="font-normal opacity-70 ml-1">· {hs.total_30d} jobs/30d</span>
                  )}
                </div>

                {/* Pills de stats */}
                {hs.total_30d > 0 && (
                  <div className="flex gap-2 justify-between">
                    <StatPill label="Total"      value={hs.total_30d}     variant="default" />
                    <StatPill label="Concluídos" value={hs.completed_30d} variant="success" />
                    <StatPill label="Falhas"     value={hs.failed_30d}    variant="danger"  />
                    <StatPill label="Ativos"     value={hs.active_jobs}   variant={hs.active_jobs > 1 ? "warning" : "default"} />
                  </div>
                )}

                {hs.total_30d === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-1">
                    Sem atividade nos últimos 30 dias
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Modal de detalhes */}
      {selectedPrinter && (
        <PrinterDetailModal
          printer={selectedPrinter}
          healthScore={selectedScore}
          isOpen={!!selectedPrinter}
          onClose={() => setSelectedPrinter(null)}
        />
      )}
    </div>
  );
}
