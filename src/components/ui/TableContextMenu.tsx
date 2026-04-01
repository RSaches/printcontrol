// src/components/ui/TableContextMenu.tsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, FileText } from 'lucide-react';

export interface ContextMenuAction {
  label: string;
  sublabel?: string;
  icon: 'excel' | 'pdf';
  onClick: () => void;
}

export interface ContextMenuGroup {
  heading: string;
  actions: ContextMenuAction[];
}

interface TableContextMenuProps {
  x: number;
  y: number;
  groups: ContextMenuGroup[];
  onClose: () => void;
}

export function TableContextMenu({ x, y, groups, onClose }: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou pressionar Escape
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Ajusta posição para não sair da viewport
  const MENU_W = 240;
  const MENU_H = groups.reduce((acc, g) => acc + 28 + g.actions.length * 36, 8);
  const left = x + MENU_W > window.innerWidth  ? x - MENU_W : x;
  const top  = y + MENU_H > window.innerHeight ? y - MENU_H : y;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ left, top, minWidth: MENU_W }}
      className="
        fixed z-[200]
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-700
        rounded-xl shadow-xl
        py-1.5 overflow-hidden
        animate-in fade-in zoom-in-95 duration-100
      "
    >
      {groups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && (
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          )}

          <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
            {group.heading}
          </p>

          {group.actions.map((action, ai) => (
            <button
              key={ai}
              role="menuitem"
              onClick={() => { action.onClick(); onClose(); }}
              className="
                w-full flex items-center gap-2.5 px-3 py-2
                text-sm text-slate-700 dark:text-slate-200
                hover:bg-slate-100 dark:hover:bg-slate-800
                transition-colors text-left
              "
            >
              {action.icon === 'excel' ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span className="flex-1">{action.label}</span>
              {action.sublabel && (
                <span className="text-[10px] text-slate-400">{action.sublabel}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}
