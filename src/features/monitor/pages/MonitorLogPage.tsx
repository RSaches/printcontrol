// src/features/monitor/pages/MonitorLogPage.tsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorErrorService } from "../../../services/monitor-error.service";
import { Button } from "../../../components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Trash2,
  AlertTriangle,
} from "lucide-react";

const PER_PAGE = 25;

export function MonitorLogPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["monitor-errors", page],
    queryFn: () => MonitorErrorService.getPaginated(page, PER_PAGE),
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });

  const errors = data?.errors ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const start = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const end = Math.min(page * PER_PAGE, total);

  async function handleClear() {
    try {
      const deleted = await MonitorErrorService.clearAll();
      await qc.invalidateQueries({ queryKey: ["monitor-errors"] });
      setPage(1);
      toast.success(`${deleted} registro${deleted !== 1 ? "s" : ""} removido${deleted !== 1 ? "s" : ""}.`);
    } catch {
      toast.error("Erro ao limpar o log.");
    }
  }

  return (
    <div className="p-5 space-y-5 page-enter">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Log do Monitor</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total === 0
              ? "Nenhum erro registrado"
              : `${start}–${end} de ${total} registro${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        {total > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/5"
            onClick={handleClear}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar tudo
          </Button>
        )}
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="rounded-xl border overflow-hidden divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3.5 animate-pulse">
              <div className="h-4 bg-muted rounded w-40 shrink-0" />
              <div className="h-4 bg-muted rounded flex-1" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && errors.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 rounded-xl border border-dashed bg-muted/5">
          <ScrollText className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum erro registrado</p>
          <p className="text-xs text-muted-foreground/60">
            Erros do worker de monitoramento aparecerão aqui
          </p>
        </div>
      )}

      {/* Tabela */}
      {!isLoading && errors.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-48">
                  Data / Hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Mensagem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {errors.map((err) => (
                <tr
                  key={err.id}
                  className="hover:bg-muted/30 transition-colors duration-100"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {format(new Date(err.occurred_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                      <span className="text-xs text-foreground/80 break-all font-mono">
                        {err.message}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
