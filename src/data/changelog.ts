// src/data/changelog.ts
//
// Adicione uma entrada no INÍCIO do array a cada release.
// A entrada com índice 0 é sempre considerada a versão mais recente.
//
// Campos de cada ChangeEntry:
//   icon        — emoji ou string (exibido no card quando não há imagem)
//   title       — título curto da melhoria
//   description — descrição de uma ou duas frases para o usuário final
//   image       — (opcional) caminho relativo em /public/whats-new/
//                 Ex.: "/whats-new/v0.2.8-tray.png"
//                 Quando ausente, o card exibe o ícone sobre gradiente.
//   gradient    — (opcional) classes Tailwind para o fundo do card sem imagem
//                 Padrão: "from-blue-500 to-indigo-600"

export interface ChangeEntry {
  icon: string;
  title: string;
  description: string;
  image?: string;
  gradient?: string;
}

export interface VersionChangelog {
  version: string;
  releaseDate: string;
  headline: string;
  changes: ChangeEntry[];
}

export const changelog: VersionChangelog[] = [
  // ─── v0.3.0 ────────────────────────────────────────────────────────────────
  {
    version: '0.3.0',
    releaseDate: '2026-04-01',
    headline: 'Analytics avançados, saúde das impressoras e novos controles',
    changes: [
      {
        icon: '🏥',
        title: 'Score de saúde das impressoras',
        description:
          'Cada impressora agora exibe uma pontuação de 0 a 100 com grade A–F. ' +
          'O score considera taxa de sucesso, atividade recente e jobs travados dos últimos 30 dias.',
        gradient: 'from-emerald-500 to-teal-600',
        // image: '/whats-new/v0.3.0-health.png',
      },
      {
        icon: '🔥',
        title: 'Heatmap de atividade',
        description:
          'Visualize os horários de pico de impressão em um grid dia × hora. ' +
          'Identifique padrões e otimize a capacidade do parque de impressão.',
        gradient: 'from-orange-500 to-red-500',
        // image: '/whats-new/v0.3.0-heatmap.png',
      },
      {
        icon: '📋',
        title: 'Log persistente do monitor',
        description:
          'Erros do worker de monitoramento agora são gravados no banco de dados e ficam disponíveis ' +
          'em uma página dedicada, mesmo após reiniciar o aplicativo.',
        gradient: 'from-slate-500 to-slate-700',
        // image: '/whats-new/v0.3.0-log.png',
      },
      {
        icon: '📅',
        title: 'Filtro por período nos jobs',
        description:
          'Filtre a lista de jobs por intervalo de datas com os novos campos "de" e "até". ' +
          'O filtro age diretamente no banco de dados, sem impacto no desempenho.',
        gradient: 'from-blue-500 to-indigo-600',
        // image: '/whats-new/v0.3.0-datefilter.png',
      },
      {
        icon: '🌙',
        title: 'Toggle de tema no cabeçalho',
        description:
          'Alterne entre claro, escuro e sistema diretamente pelo botão no cabeçalho, ' +
          'sem precisar acessar as configurações.',
        gradient: 'from-violet-500 to-purple-600',
        // image: '/whats-new/v0.3.0-theme.png',
      },
    ],
  },

  // ─── v0.2.8 ────────────────────────────────────────────────────────────────
  {
    version: '0.2.8',
    releaseDate: '2026-04-01',
    headline: 'Menu da bandeja, atualização automática e detecção de jobs melhorada',
    changes: [
      {
        icon: '🖨️',
        title: 'Detecção de jobs no Windows',
        description:
          'Jobs em lote agora são capturados com uma segunda consulta WMI. ' +
          'Drivers que marcam ERROR transitoriamente durante a impressão não geram mais alertas falsos.',
        gradient: 'from-blue-500 to-cyan-500',
        // image: '/whats-new/v0.2.8-jobs.png',
      },
      {
        icon: '🔄',
        title: 'Atualização automática corrigida',
        description:
          'Versões novas chegam automaticamente a todos os usuários assim que publicadas. ' +
          'O banner e o modal de atualização agora compartilham o mesmo estado.',
        gradient: 'from-violet-500 to-purple-600',
        // image: '/whats-new/v0.2.8-update.png',
      },
      {
        icon: '🗂️',
        title: 'Menu da bandeja sempre funcional',
        description:
          'Clique direito no ícone da bandeja agora exibe o menu corretamente. ' +
          'O menu é atualizado em tempo real quando jobs mudam e a cada 30 segundos.',
        gradient: 'from-emerald-500 to-teal-600',
        // image: '/whats-new/v0.2.8-tray.png',
      },
      {
        icon: '⚡',
        title: 'Confirmação de falhas inteligente',
        description:
          'Jobs só são marcados como falha após 2 ciclos consecutivos de erro, ' +
          'evitando notificações falsas durante impressões normais.',
        gradient: 'from-amber-500 to-orange-500',
        // image: '/whats-new/v0.2.8-fail.png',
      },
    ],
  },

  // ─── v0.2.7 ────────────────────────────────────────────────────────────────
  {
    version: '0.2.7',
    releaseDate: '2026-03-31',
    headline: 'Melhorias de estabilidade e fluxo de atualização',
    changes: [
      {
        icon: '🚀',
        title: 'Releases automáticas',
        description:
          'A partir desta versão, as atualizações são publicadas automaticamente ' +
          'sem necessidade de aprovação manual.',
        gradient: 'from-pink-500 to-rose-600',
      },
      {
        icon: '🔁',
        title: 'Contexto de atualização unificado',
        description:
          'O banner e o modal de atualização foram unificados para evitar ' +
          'downloads duplicados e inconsistências de estado.',
        gradient: 'from-sky-500 to-blue-600',
      },
    ],
  },
];
