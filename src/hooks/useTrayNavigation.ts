// src/hooks/useTrayNavigation.ts
import { useNavigate } from "react-router-dom";
import { useJobStore } from "../store/jobStore";
import { useTauriEvent } from "./useTauriEvent";
import type { JobStatus } from "../types";

interface NavigateFilterPayload {
  route: string;
  status?: JobStatus;
}

/**
 * Ouve eventos emitidos pela bandeja do sistema e aplica
 * navegação + filtros na janela principal.
 *
 * Eventos suportados:
 *  - "navigate"        → payload: string (rota, ex: "/settings")
 *  - "navigate-filter" → payload: { route, status? }
 */
export function useTrayNavigation() {
  const navigate = useNavigate();
  const setFilter = useJobStore((s) => s.setFilter);

  // Navegação simples — sem filtro
  useTauriEvent<string>("navigate", ({ payload }) => {
    navigate(payload);
  });

  // Navegação com filtro de status aplicado ao jobStore
  useTauriEvent<NavigateFilterPayload>("navigate-filter", ({ payload }) => {
    if (payload.status) {
      setFilter("status", payload.status);
    }
    navigate(payload.route);
  });
}
