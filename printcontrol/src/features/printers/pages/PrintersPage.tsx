// src/features/printers/pages/PrintersPage.tsx
import { useQuery } from "@tanstack/react-query";
import { Printer, RefreshCw, MapPin, WifiOff } from "lucide-react";
import { PrinterService } from "../../../services/printer.service";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../utils/cn";

export function PrintersPage() {
  const { data: printers = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["printers"],
    queryFn: () => PrinterService.getAll(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const onlineCount = printers.filter((p) => p.is_online).length;

  return (
    <div className="p-5 space-y-5 page-enter">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Impressoras</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {printers.length === 0
              ? "Nenhuma impressora detectada"
              : `${onlineCount} de ${printers.length} online`}
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
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
          {printers.map((printer) => (
            <div
              key={printer.id}
              className={cn(
                "rounded-xl border bg-card p-5 space-y-3 shadow-sm card-hover",
                !printer.is_online && "opacity-60"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Ícone */}
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

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-sm font-semibold truncate"
                      title={printer.name}
                    >
                      {printer.name}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
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

                  {printer.location && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <MapPin className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">
                        {printer.location}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
