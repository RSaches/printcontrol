// src/components/WhatsNew.tsx
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useWhatsNew } from '../hooks/useWhatsNew';
import type { VersionChangelog, ChangeEntry } from '../data/changelog';

export function WhatsNew() {
  const { visible, entries, dismiss } = useWhatsNew();

  if (!visible || entries.length === 0) return null;

  return <WhatsNewPanel entries={entries} onDismiss={dismiss} />;
}

// ─── Painel principal ────────────────────────────────────────────────────────

interface PanelProps {
  entries: VersionChangelog[];
  onDismiss: () => void;
}

function WhatsNewPanel({ entries, onDismiss }: PanelProps) {
  // Se há múltiplas versões para mostrar, navega entre elas.
  const [versionIndex, setVersionIndex] = useState(0);
  const entry = entries[versionIndex];
  const isFirst = versionIndex === 0;
  const isLast = versionIndex === entries.length - 1;

  return (
    // Overlay não-modal: pointer-events none no fundo, só o painel é clicável.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4 pointer-events-none"
      aria-live="polite"
    >
      <div
        className="
          pointer-events-auto
          w-full max-w-2xl
          bg-white dark:bg-slate-900
          rounded-2xl shadow-2xl
          border border-slate-200 dark:border-slate-700
          animate-in slide-in-from-bottom-6 fade-in duration-400
          overflow-hidden
        "
      >
        {/* Faixa decorativa superior */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Novidades
              </p>
              <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight">
                Versão {entry.version}
              </h2>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtítulo da versão */}
        <p className="px-6 pb-4 text-sm text-slate-500 dark:text-slate-400">
          {entry.headline}
        </p>

        {/* Cards de melhorias */}
        <div className="px-6 pb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
            {entry.changes.map((change, i) => (
              <ChangeCard key={i} change={change} />
            ))}
          </div>
        </div>

        {/* Rodapé: navegação entre versões + botão de fechar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-5">
          <div className="flex items-center gap-1">
            {entries.length > 1 && (
              <>
                <button
                  onClick={() => setVersionIndex((i) => i - 1)}
                  disabled={isFirst}
                  className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Versão anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>

                {entries.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setVersionIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === versionIndex
                        ? 'bg-violet-500 w-4'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    aria-label={`Versão ${entries[i].version}`}
                  />
                ))}

                <button
                  onClick={() => setVersionIndex((i) => i + 1)}
                  disabled={isLast}
                  className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Próxima versão"
                >
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </>
            )}
          </div>

          <button
            onClick={isLast ? onDismiss : () => setVersionIndex((i) => i + 1)}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-sm font-semibold transition-all"
          >
            {entries.length > 1 && !isLast ? 'Próximo →' : 'Entendido!'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card individual de melhoria ─────────────────────────────────────────────

interface CardProps {
  change: ChangeEntry;
}

function ChangeCard({ change }: CardProps) {
  const gradient = change.gradient ?? 'from-blue-500 to-indigo-600';

  return (
    <div className="flex-shrink-0 w-44 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
      {/* Área de imagem / placeholder */}
      <div className="relative h-28 w-full overflow-hidden">
        {change.image ? (
          <img
            src={change.image}
            alt={change.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <span className="text-4xl select-none" role="img" aria-label={change.title}>
              {change.icon}
            </span>
          </div>
        )}
      </div>

      {/* Texto */}
      <div className="p-3">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight mb-1">
          {change.title}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
          {change.description}
        </p>
      </div>
    </div>
  );
}
