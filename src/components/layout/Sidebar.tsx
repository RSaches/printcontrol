// src/components/layout/Sidebar.tsx
import { Link, useMatch, useResolvedPath } from "react-router-dom";
import { cn } from "../../utils/cn";
import {
  Printer,
  LayoutList,
  BarChart3,
  Settings2,
  PrinterCheck,
  Activity,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/jobs",      label: "Jobs",           description: "Histórico de impressões",  icon: LayoutList },
  { to: "/printers",  label: "Impressoras",    description: "Status das impressoras",    icon: Printer    },
  { to: "/reports",   label: "Relatórios",     description: "Gráficos e estatísticas",  icon: BarChart3  },
  { to: "/settings",  label: "Configurações",  description: "Ajustes do aplicativo",    icon: Settings2  },
];

function NavItemLink({ to, label, description, icon: Icon }: NavItem) {
  const resolved = useResolvedPath(to);
  const isActive  = Boolean(useMatch({ path: resolved.pathname, end: false }));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          aria-label={label}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "group relative flex items-center gap-2.5 px-3 py-2 rounded-lg",
            "text-sm transition-all duration-200 outline-none",
            "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            isActive
              ? "nav-active-bar bg-sidebar-primary/10 text-sidebar-primary font-semibold"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Icon
            className={cn(
              "w-[18px] h-[18px] shrink-0 transition-colors duration-200",
              isActive
                ? "text-sidebar-primary"
                : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground"
            )}
            strokeWidth={isActive ? 2.25 : 1.75}
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          "w-56 flex flex-col shrink-0",
          "border-r border-sidebar-border",
          "bg-sidebar-background"
        )}
      >
        {/* Logo */}
        <div className="h-12 flex items-center gap-2.5 px-4 border-b border-sidebar-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
            <PrinterCheck className="w-4.5 h-4.5 text-primary-foreground" aria-hidden />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground">
              PrintControl
            </span>
            <span className="text-[10px] text-sidebar-foreground/40 -mt-0.5 leading-none">
              Monitor de impressão
            </span>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 p-2.5 space-y-0.5" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <NavItemLink key={item.to} {...item} />
          ))}
        </nav>

        {/* Rodapé com status do monitor */}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="relative flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-sidebar-foreground/50" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-[11px] text-sidebar-foreground/50">Monitor ativo</span>
          </div>
          <p className="text-[10px] text-sidebar-foreground/30 text-center tracking-wide">
            v0.1.0
          </p>
        </div>
      </aside>
    </TooltipProvider>
  );
}
