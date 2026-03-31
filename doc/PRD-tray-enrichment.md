# PRD — Bandeja de Sistema Enriquecida (System Tray)

**Projeto:** PrintControl
**Data:** 2026-03-30
**Status:** Draft

---

## 1. Visão Geral

### Problema Atual

A bandeja do sistema do PrintControl exibe apenas dois itens fixos:
- "Abrir PrintControl"
- "Sair"

O usuário precisa abrir a janela completa para obter qualquer informação sobre o estado das impressões, o que vai contra o propósito de uma bandeja de sistema: oferecer **visibilidade imediata sem abrir a aplicação**.

### Objetivo

Transformar a bandeja em um **painel de controle rápido**, onde o usuário veja as informações mais relevantes do momento (jobs ativos, falhas, status das impressoras) e execute ações frequentes sem precisar abrir a janela principal.

### Referências de Mercado

| App | Padrão de Tray |
|-----|---------------|
| **Docker Desktop** | Conta containers por status (running/stopped), acesso rápido por container, uso de recursos |
| **Dropbox** | Últimos 5 arquivos sincronizados, status global (sincronizando/pausado/erro), uso de cota |
| **NordVPN** | Status de conexão em destaque, servidor atual, botão conectar/desconectar no topo |
| **Windows Print Spooler** | Contagem de jobs na fila, nome do documento ativo, cancelar/pausar diretamente |
| **Slack** | Contador de não-lidos no ícone, mute rápido, DND mode |

**Padrão emergente:** os melhores trays colocam **o dado mais crítico no topo** (em destaque, como cabeçalho não-clicável), seguido de **ações contextuais** e, por último, as ações globais (abrir/sair).

---

## 2. Dados Disponíveis no Projeto

O backend já expõe tudo que é necessário via comandos Tauri e eventos em tempo real:

### Comandos disponíveis
| Comando | Dado retornado |
|---------|---------------|
| `get_job_stats` | `{ total, pending, printing, completed, failed }` |
| `get_jobs` | Lista completa de jobs com status, documento, usuário, impressora |
| `get_printers` | Lista de impressoras com `is_online`, `name`, `location` |
| `get_settings` | Configurações incluindo `auto_start_monitor` |

### Eventos em tempo real (push do backend)
| Evento | Quando dispara |
|--------|---------------|
| `job-new` | Novo job detectado no spooler |
| `job-update` | Status de job alterado |
| `job-failed` | Job marcado como FAILED |
| `monitor-error` | Erro no worker de monitoramento |

### Estado de JobStatus
```
PENDING → PRINTING → COMPLETED
                   → FAILED
PENDING →          → FAILED (timeout)
```

---

## 3. Estrutura do Menu Proposto

```
┌─────────────────────────────────────┐
│  🖨  PrintControl          v0.1.0   │  ← cabeçalho (disabled, informativo)
│  ● Monitor ativo                    │  ← status do monitor (disabled)
├─────────────────────────────────────┤
│  IMPRESSÕES AGORA                   │  ← seção (disabled, label)
│    ⟳  2 imprimindo                  │  ← clique → abre Jobs filtrado
│    ⏳  1 pendente                   │
│    ✗  3 falhas hoje                 │  ← destaque visual quando > 0
├─────────────────────────────────────┤
│  JOBS RECENTES                      │  ← últimos 3 jobs (dinâmico)
│    Relatorio_Q1.pdf  [IMPRIMINDO]   │
│    Planilha.xlsx     [CONCLUÍDO]    │
│    Ata_reuniao.docx  [FALHOU]       │
├─────────────────────────────────────┤
│  IMPRESSORAS  (2 de 3 online)       │  ← seção (disabled, label)
│    ● HP LaserJet Pro                │  ← ● verde = online
│    ● Epson L3150                    │
│    ○ Canon MF642C   [offline]       │  ← ○ cinza = offline
├─────────────────────────────────────┤
│  Pausar Monitor                     │  ← toggle (muda para "Retomar" se pausado)
│  Abrir Configurações                │
├─────────────────────────────────────┤
│  Abrir PrintControl                 │
│  Sair                               │
└─────────────────────────────────────┘
```

---

## 4. Comportamento do Ícone

### Ícone dinâmico por estado
O ícone na bandeja muda conforme o estado global do sistema:

| Estado | Ícone | Quando |
|--------|-------|--------|
| Normal | Ícone padrão (printer + check verde) | Tudo ok, monitor ativo |
| Imprimindo | Ícone com badge animado (opcional) | `printing > 0` |
| Falha | Ícone com indicador vermelho | `failed > 0` em jobs recentes |
| Monitor pausado | Ícone dessaturado / com X | Monitor parado |

> **Implementação:** Tauri 2.x suporta `TrayIcon::set_icon()` em runtime. Gerar 3–4 variações do SVG com diferentes indicadores e alternar conforme o estado.

### Tooltip dinâmico
```
Estado normal:   "PrintControl — Monitor ativo"
Com impressões:  "PrintControl — 2 imprimindo, 1 pendente"
Com falhas:      "PrintControl — ⚠ 3 falhas detectadas"
Pausado:         "PrintControl — Monitor pausado"
```

> **Implementação:** `TrayIcon::set_tooltip()` em runtime.

---

## 5. Atualização Dinâmica do Menu

### Estratégia recomendada para Tauri 2.x

A pesquisa identifica **dois padrões** para atualização do menu. O PrintControl deve usar uma combinação dos dois:

#### Padrão A — Reconstrução no clique (refresh-on-open) ✅ recomendado como base
Rebuilda o menu completo via `tray.set_menu()` toda vez que o usuário abre o menu (disparado por `on_tray_icon_event`). Garante dados sempre frescos sem polling em background.

```rust
.on_tray_icon_event(|tray, event| {
    if let TrayIconEvent::Click { .. } = event {
        let app = tray.app_handle().clone();
        tauri::async_runtime::spawn(async move {
            rebuild_tray_menu(&app).await;
        });
    }
})
```

#### Padrão B — Mutação de itens individuais ✅ para atualizações push de eventos
`MenuItem` é reference-counted — clonar dá handle ao mesmo item. Armazenar clones em `State` e chamar `set_text()` a partir de handlers de eventos.

> ⚠️ **Bug conhecido (issue #11372):** `set_text()` não pode ser chamado dentro de closures `on_menu_event`. Armazenar o `MenuItem` em `Arc<Mutex<>>` ou `tauri::State` e acessar de fora do closure.

> ⚠️ **Bug Linux (issue #8374):** `tray.set_menu()` pode falhar em versões antigas do Tauri 2.x no Linux. Manter Tauri atualizado.

**Fluxo de atualização recomendado:**
1. No `setup()`: criar menu, armazenar `MenuItem` handles em `TrayState` gerenciado
2. Reconstruir menu completo no clique do ícone (Padrão A)
3. Nos eventos `job-new`, `job-update`, `job-failed`: atualizar apenas tooltip e ícone (rápido, não bloqueia)
4. `CheckMenuItem` para o toggle do monitor (mantém estado visual automaticamente)

**Estado compartilhado necessário:**
```rust
pub struct TrayState {
    pub tray: TrayIcon,
    pub items: TrayMenuItems,  // handles para cada MenuItem
    pub last_stats: Mutex<JobStats>,
    pub monitor_paused: AtomicBool,
}

pub struct TrayMenuItems {
    pub stats_printing: MenuItem,
    pub stats_pending:  MenuItem,
    pub stats_failed:   MenuItem,
    pub recent_jobs:    [MenuItem; 3],
    pub printers:       Vec<MenuItem>,
    pub monitor_toggle: CheckMenuItem,  // CheckMenuItem mantém estado de check
}
```

### API Tauri 2.x validada pela pesquisa

| Método | Tipo | Uso |
|--------|------|-----|
| `TrayIconBuilder::new().id("main-tray").build(app)` | Rust | Criar com ID para acesso posterior |
| `app.tray_by_id("main-tray")` | Rust | Obter handle em qualquer lugar |
| `tray.set_menu(Some(menu))` | Rust/JS | Substituir menu completo |
| `tray.set_icon(icon)` | Rust/JS | Trocar ícone em runtime |
| `tray.set_tooltip(Some(text))` | Rust/JS | Atualizar tooltip |
| `MenuItem::with_id(app, id, text, enabled, accel)` | Rust | Criar item nomeado |
| `item.set_text("novo texto")` | Rust | Mutar item individual |
| `item.set_enabled(bool)` | Rust | Habilitar/desabilitar |
| `CheckMenuItem::set_checked(bool)` | Rust | Toggle de checkmark |
| `TrayIconBuilder::menu_on_left_click(true)` | Rust | Abrir menu no clique esquerdo |

---

## 6. Ações e Comportamentos

### Cliques em itens de menu

| Item | Ação |
|------|------|
| Cabeçalho / status | Nenhuma (disabled) |
| "2 imprimindo" | Abre janela + navega para `/jobs` com filtro `status=PRINTING` |
| "3 falhas" | Abre janela + navega para `/jobs` com filtro `status=FAILED` |
| Job recente | Abre janela + navega para `/jobs` com busca pelo documento |
| Nome de impressora | Abre janela + navega para `/printers` |
| "Pausar Monitor" | Para o MonitorWorker, muda item para "Retomar Monitor", atualiza ícone |
| "Retomar Monitor" | Reinicia MonitorWorker, muda item de volta |
| "Abrir Configurações" | Abre janela + navega para `/settings` |
| "Abrir PrintControl" | Mostra e foca janela principal |
| "Sair" | Para MonitorWorker + encerra app |

### Clique simples no ícone (left click)
Mantém comportamento atual: mostra e foca a janela principal.

### Clique direito no ícone
Exibe o menu contextual (comportamento padrão do SO).

---

## 7. Regras de Negócio e UX

### Seção "Impressões Agora"
- Exibir sempre os três contadores (mesmo quando zero): `0 imprimindo`, `0 pendentes`, `0 falhas`
- Quando `failed > 0`: item de falhas fica **habilitado** (clicável) e com texto em destaque
- Quando `printing == 0 && pending == 0 && failed == 0`: mostrar "Nenhuma impressão ativa" (disabled)

### Seção "Jobs Recentes"
- Mostrar os **3 jobs mais recentes** por `created_at DESC`
- Truncar `document_name` em ~28 caracteres com `…`
- Incluir status abreviado: `[IMPRIMINDO]`, `[CONCLUÍDO]`, `[FALHOU]`, `[PENDENTE]`
- Se não houver jobs: mostrar "Nenhum job registrado" (disabled)

### Seção "Impressoras"
- Listar **todas** as impressoras detectadas
- Prefixo visual: `●` para online, `○` para offline
- Label da seção indica contagem: `IMPRESSORAS (2 de 3 online)`
- Se nenhuma impressora: "Nenhuma impressora detectada" (disabled)
- Máximo de 5 impressoras listadas (para não alongar demais o menu)

### Toggle do Monitor
- Label muda dinamicamente: "Pausar Monitor" ↔ "Retomar Monitor"
- Ao pausar: ícone na bandeja muda para versão dessaturada
- Estado de pausa é persistido em `AppSettings` (`auto_start_monitor`)

### Performance
- **Não bloquear a thread principal**: todas as chamadas ao banco são async
- Usar `tauri::async_runtime::spawn` para atualizar o tray em background
- **Rate limiting**: não atualizar o menu mais de 1x por segundo (debounce)
- **Fallback de polling**: se eventos não chegarem, atualizar a cada 30s

---

## 8. Arquivos a Criar/Modificar

### Backend (Rust)
| Arquivo | Ação |
|---------|------|
| `src/app/tray.rs` | **Novo** — módulo dedicado para lógica do tray: build, update, state |
| `src/app/state.rs` | Adicionar `tray_state: Option<Arc<TrayState>>` |
| `src/lib.rs` | Mover lógica do tray para `tray::setup(app)`, registrar listeners de eventos |
| `src/app/mod.rs` | Exportar módulo `tray` |

### Estrutura do novo módulo `tray.rs`
```rust
pub fn setup(app: &App) -> Result<(), Box<dyn Error>>
pub fn update(app: &AppHandle)          // chamado a cada evento relevante
fn build_menu(app: &App) -> Result<Menu, ...>
fn format_job_label(job: &PrintJob) -> String
fn format_printer_label(printer: &Printer) -> String
fn pick_tray_icon(stats: &JobStats, paused: bool) -> Image
```

### Ícones necessários
| Arquivo | Descrição |
|---------|-----------|
| `src-tauri/icons/tray-normal.png` | Ícone padrão (32x32, já existe como `32x32.png`) |
| `src-tauri/icons/tray-printing.png` | Com indicador azul animado (opcional) |
| `src-tauri/icons/tray-error.png` | Com ponto vermelho no canto |
| `src-tauri/icons/tray-paused.png` | Dessaturado ou com `||` overlay |

> Tauri 2.x suporta `Image::from_bytes()` para carregar ícones em runtime.

---

## 9. Critérios de Aceite

- [ ] Menu exibe estatísticas de jobs em tempo real (atualiza em até 3s após evento)
- [ ] Menu exibe os 3 jobs mais recentes com status e nome truncado
- [ ] Menu exibe todas as impressoras com indicador online/offline
- [ ] Clicar em "X falhas" abre a janela na aba Jobs com filtro FAILED aplicado
- [ ] Toggle "Pausar/Retomar Monitor" funciona e persiste entre sessões
- [ ] Ícone da bandeja muda quando há falhas ou monitor pausado
- [ ] Tooltip atualiza com resumo do estado atual
- [ ] Menu não trava a UI (todas atualizações são assíncronas)
- [ ] Funciona em Linux (X11/Wayland via AppIndicator) e Windows

---

## 10. Referências Técnicas

- [Tauri v2 — System Tray](https://v2.tauri.app/learn/system-tray/)
- [Tauri JS Tray API](https://v2.tauri.app/reference/javascript/api/namespacetray/)
- [Tauri JS Menu API](https://v2.tauri.app/reference/javascript/api/namespacemenu/)
- [Discussion #8508 — Dynamic tray with progress](https://github.com/tauri-apps/tauri/discussions/8508)
- [Discussion #7735 — Changing menu items at runtime](https://github.com/tauri-apps/tauri/discussions/7735)
- [Issue #11372 — set_text em closures (not planned)](https://github.com/tauri-apps/tauri/issues/11372)
- [Issue #9280 — Easier tray menu updates (open)](https://github.com/tauri-apps/tauri/issues/9280)
- [Issue #8374 — set_menu bug Linux](https://github.com/tauri-apps/tauri/issues/8374)

## 11. Fora de Escopo (esta iteração)

- Notificações nativas do SO (toast/balloon) — gerenciar por settings separada
- Sub-menus hierárquicos por impressora com jobs detalhados
- Histórico de estatísticas / gráfico no tray
- Integração com SNMP para toner/papel (planejado para Fase 2)
- Clique duplo no ícone (comportamento varia muito por SO/DE no Linux)
