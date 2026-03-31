import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, PrinterCheck } from 'lucide-react';

export function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="h-9 select-none flex justify-between items-center w-full border-b shrink-0 z-50 text-foreground glass"
    >
      {/* App identity */}
      <div
        data-tauri-drag-region
        className="flex-1 flex px-3 items-center gap-2 text-xs font-semibold tracking-tight opacity-90"
      >
        <div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center">
          <PrinterCheck className="w-3 h-3 text-primary" />
        </div>
        <span>PrintControl</span>
      </div>

      {/* Center: quicklaunch hint */}
      <div data-tauri-drag-region className="hidden sm:flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-muted-foreground">Buscar</span>
        <kbd className="kbd">Ctrl</kbd>
        <kbd className="kbd">K</kbd>
      </div>

      {/* Window controls */}
      <div className="flex items-center h-full ml-4">
        <button
          className="inline-flex items-center justify-center h-full w-11 hover:bg-muted/60 transition-colors duration-150 focus:outline-none"
          onClick={() => getCurrentWindow().minimize()}
          title="Minimizar"
        >
          <Minus className="h-3.5 w-3.5 opacity-70" />
        </button>
        <button
          className="inline-flex items-center justify-center h-full w-11 hover:bg-muted/60 transition-colors duration-150 focus:outline-none"
          onClick={() => getCurrentWindow().toggleMaximize()}
          title="Maximizar"
        >
          <Square className="h-3 w-3 opacity-70" />
        </button>
        <button
          className="inline-flex items-center justify-center h-full w-11 hover:bg-red-500/90 hover:text-white transition-colors duration-150 focus:outline-none rounded-tr-none"
          onClick={() => getCurrentWindow().close()}
          title="Fechar"
        >
          <X className="h-4 w-4 opacity-80" />
        </button>
      </div>
    </div>
  );
}
