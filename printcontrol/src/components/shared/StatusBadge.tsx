// src/components/shared/StatusBadge.tsx
import { cn } from "../../utils/cn";
import type { JobStatus } from "../../types";

function StatusDot({ dotColor, pulse = false }: { dotColor: string; pulse?: boolean }) {
  return (
    <span
      className={cn("inline-block w-1.5 h-1.5 rounded-full", dotColor, pulse && "animate-pulse")}
      aria-hidden
    />
  );
}

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; dotColor: string; containerStyle: string; pulse: boolean }
> = {
  PENDING: {
    label: "Pendente",
    dotColor: "bg-[hsl(var(--status-pending))]",
    containerStyle:
      "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-fg))] border-[hsl(var(--status-pending)/0.3)]",
    pulse: false,
  },
  PRINTING: {
    label: "Imprimindo",
    dotColor: "bg-[hsl(var(--status-printing))]",
    containerStyle:
      "bg-[hsl(var(--status-printing-bg))] text-[hsl(var(--status-printing-fg))] border-[hsl(var(--status-printing)/0.3)]",
    pulse: true,
  },
  COMPLETED: {
    label: "Concluído",
    dotColor: "bg-[hsl(var(--status-completed))]",
    containerStyle:
      "bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed-fg))] border-[hsl(var(--status-completed)/0.3)]",
    pulse: false,
  },
  FAILED: {
    label: "Falhou",
    dotColor: "bg-[hsl(var(--status-failed))]",
    containerStyle:
      "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-fg))] border-[hsl(var(--status-failed)/0.3)]",
    pulse: false,
  },
};

interface StatusBadgeProps {
  status: JobStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full",
        "text-[11px] font-medium border",
        cfg.containerStyle
      )}
    >
      <StatusDot dotColor={cfg.dotColor} pulse={cfg.pulse} />
      {cfg.label}
    </span>
  );
}
