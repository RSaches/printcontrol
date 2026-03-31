import { Download, X } from 'lucide-react';
import { useUpdaterContext } from '../hooks/useUpdaterContext';

export function UpdateBanner() {
  const { state, applyUpdate, dismiss } = useUpdaterContext();

  if (state.status === 'available') {
    return (
      <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-2 text-sm z-50">
        <Download className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          Nova versão disponível: <strong>{state.update.version}</strong>
        </span>
        <button
          onClick={applyUpdate}
          className="rounded bg-white/20 px-3 py-1 font-medium hover:bg-white/30 transition-colors"
        >
          Atualizar agora
        </button>
        <button
          onClick={dismiss}
          className="rounded p-1 hover:bg-white/20 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (state.status === 'downloading') {
    const { percent } = state.progress;
    return (
      <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-2 text-sm z-50">
        <Download className="h-4 w-4 shrink-0 animate-bounce" />
        <div className="flex-1">
          <div className="mb-1">Baixando atualização... {percent}%</div>
          <div className="h-1.5 w-full rounded-full bg-white/30">
            <div
              className="h-1.5 rounded-full bg-white transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
