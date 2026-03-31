// src/features/jobs/hooks/useJobs.ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTauriEvent } from "../../../hooks/useTauriEvent";
import { JobService } from "../../../services/job.service";
import type { PrintJob } from "../../../types";

interface UseJobsParams {
  page: number;
  perPage: number;
  status?: string;
  search?: string;
}

export function useJobs({ page, perPage, status, search }: UseJobsParams) {
  return useQuery({
    queryKey: ["jobs", page, perPage, status, search],
    queryFn: () => JobService.getPaginated(page, perPage, status, search),
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}

export function useJobEvents() {
  const qc = useQueryClient();

  // Novo job ou job atualizado → invalida todas as queries de jobs paginados.
  // Não tentamos fazer patch cirúrgico no cache porque não sabemos em qual
  // página o job está com os filtros ativos.
  useTauriEvent<PrintJob>("job-update", () => {
    qc.invalidateQueries({ queryKey: ["jobs"] });
  });

  useTauriEvent("job-new", () => {
    qc.invalidateQueries({ queryKey: ["jobs"] });
  });

  useTauriEvent<PrintJob>("job-failed", () => {
    qc.invalidateQueries({ queryKey: ["jobs"] });
  });
}
