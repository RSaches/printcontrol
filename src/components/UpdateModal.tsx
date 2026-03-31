import { Printer, RefreshCw } from 'lucide-react';
import { useUpdaterContext } from '../hooks/useUpdaterContext';

export function UpdateModal() {
  const { state, applyUpdate, dismiss } = useUpdaterContext();

  // Só mostramos o modal se estiver disponível para baixar ou baixando
  if (state.status === 'idle' || state.status === 'up_to_date' || (state.status === 'error' && !state.message)) {
    return null;
  }

  const isDownloading = state.status === 'downloading';
  const isAvailable = state.status === 'available';
  const isError = state.status === 'error';
  const percent = isDownloading ? state.progress.percent : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 animate-in zoom-in-95 duration-300">
        
        {/* Header Decorativo */}
        <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        <div className="p-8 text-center">
          {/* Área da Animação da Impressora */}
          <div className="relative mb-8 flex justify-center h-40 items-end">
            
            {/* Impressora */}
            <div className={`relative z-10 transition-all duration-1000 ${isDownloading ? 'animate-bounce' : ''}`}>
              <div className={`p-4 bg-slate-100 dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 ${isDownloading ? 'animate-[pulse_2s_infinite]' : ''}`}>
                <Printer className={`h-16 w-16 text-blue-500 ${isDownloading ? 'animate-[print-slide_1.5s_ease-in-out_infinite]' : ''}`} />
              </div>
              
              {/* Luz de Status */}
              <div className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${
                isDownloading ? 'bg-blue-500 animate-ping' : 
                isError ? 'bg-red-500' : 'bg-green-500'
              }`} />
            </div>

            {/* Papel Saindo (Barra de Progresso Invertida) */}
            <div className="absolute top-[80px] w-32 flex flex-col items-center">
              <div 
                className="w-24 bg-slate-50 dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 ease-out flex flex-col justify-start overflow-hidden"
                style={{ height: isDownloading ? `${Math.max(20, percent)}px` : '0px', opacity: isDownloading ? 1 : 0 }}
              >
                {/* Linhas de "texto" no papel */}
                <div className="w-full space-y-1 p-2">
                  <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-1 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Conteúdo de Texto */}
          <h2 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">
            {isAvailable && "Melhorias disponíveis!"}
            {isDownloading && "Imprimindo melhorias..."}
            {isError && "Erro na impressão"}
          </h2>
          
          <p className="mb-8 text-slate-500 dark:text-slate-400">
            {isAvailable && `Uma nova versão (${state.update.version}) está pronta para deixar sua gestão de impressão mais potente.`}
            {isDownloading && `Estamos instalando novos componentes. Por favor, aguarde a conclusão: ${percent}%`}
            {isError && (state as any).message}
          </p>

          {/* Ações */}
          <div className="flex flex-col gap-3">
            {isAvailable && (
              <>
                <button
                  onClick={applyUpdate}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 px-6 py-4 text-white transition-all hover:bg-blue-700 active:scale-[0.98]"
                >
                  <RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
                  <span className="font-semibold">Atualizar e Reiniciar</span>
                </button>
                <button
                  onClick={dismiss}
                  className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  Lembrar mais tarde
                </button>
              </>
            )}

            {isDownloading && (
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}

            {isError && (
              <button
                onClick={dismiss}
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-6 py-3 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
              >
                Entendido
              </button>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes print-slide {
          0%, 100% { transform: translateX(-10px); }
          50% { transform: translateX(10px); }
        }
      `}} />
    </div>
  );
}
