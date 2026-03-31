# Spec — Instalador Windows (PrintControl)

**Baseado em:** `doc/PRD-instalador-windows.md`
**Data:** 2026-03-30
**Status:** Pronto para implementação

---

## Visão geral das mudanças

| # | Arquivo | Ação | Fase |
|---|---|---|---|
| 1 | `src-tauri/tauri.conf.json` | Modificar | 1 |
| 2 | `src-tauri/Cargo.toml` | Modificar | 3 |
| 3 | `src-tauri/src/lib.rs` | Modificar | 3 |
| 4 | `src-tauri/windows/hooks.nsh` | Criar | 1 |
| 5 | `src-tauri/wix/locales/pt-BR.wxl` | Criar | 1 |
| 6 | `src-tauri/LICENSE.txt` | Criar | 1 |
| 7 | `src/services/updater.service.ts` | Criar | 3 |
| 8 | `src/hooks/useUpdater.ts` | Criar | 3 |
| 9 | `src/components/UpdateBanner.tsx` | Criar | 3 |
| 10 | `src/main.tsx` | Modificar | 3 |
| 11 | `package.json` | Modificar | 3 |
| 12 | `.github/workflows/release-windows.yml` | Criar | 5 |
| 13 | `src-tauri/resources/` | Criar diretório + baixar vcredist | 1 |
| 14 | `src-tauri/windows/assets/` | Criar assets de branding | 2 |

---

## Fase 1 — Instalador Funcional

### 1. `src-tauri/tauri.conf.json` — MODIFICAR

Substituir o bloco `bundle` existente e adicionar `plugins`.

**Antes (atual):**
```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

**Depois (completo):**
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "PrintControl",
  "version": "1.0.0",
  "identifier": "com.printcontrol.app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "PrintControl",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: https://asset.localhost; connect-src ipc: http://ipc.localhost"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "createUpdaterArtifacts": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "licenseFile": "./LICENSE.txt",
    "resources": [
      "resources/**/*"
    ],
    "windows": {
      "allowDowngrades": true,
      "webviewInstallMode": {
        "type": "embedBootstrapper"
      },
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.comodoca.com",
      "nsis": {
        "installMode": "currentUser",
        "languages": ["Portuguese", "English"],
        "displayLanguageSelector": false,
        "headerImage": "./windows/assets/header.bmp",
        "sidebarImage": "./windows/assets/sidebar.bmp",
        "installerIcon": "./icons/icon.ico",
        "startMenuFolder": "PrintControl",
        "compression": "lzma",
        "minimumWebview2Version": "110.0.1531.0",
        "installerHooks": "./windows/hooks.nsh"
      },
      "wix": {
        "language": {
          "pt-BR": { "localePath": "./wix/locales/pt-BR.wxl" },
          "en-US": null
        }
      }
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "CHAVE_PUBLICA_AQUI",
      "endpoints": [
        "https://github.com/SEU_ORG/printcontrol/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

> **Nota:** `"version"` deve ser mantida em sincronia com `Cargo.toml`. Ao fazer releases, atualizar ambos.
>
> **Nota:** `"pubkey"` em `plugins.updater` fica vazia até a Fase 3 (geração das chaves). Pode deixar o campo com string vazia `""` — o updater simplesmente não funcionará até ser preenchido.

---

### 2. `src-tauri/windows/hooks.nsh` — CRIAR

**Caminho completo:** `src-tauri/windows/hooks.nsh`

```nsis
; Hooks NSIS do PrintControl
; Executado antes de copiar os arquivos do app

!macro NSIS_HOOK_PREINSTALL
  ; Verifica se Visual C++ Redistributable 2022 x64 já está instalado
  ; A chave de registro existe quando a versão 14.x está presente
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  StrCmp $0 "1" vcredist_ja_instalado

    DetailPrint "Instalando Visual C++ Redistributable 2022..."
    ; /install  = modo silencioso com progresso mínimo
    ; /passive  = mostra progresso sem interação
    ; /norestart = não reinicia ao terminar
    ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /passive /norestart'

  vcredist_ja_instalado:
!macroend
```

---

### 3. `src-tauri/wix/locales/pt-BR.wxl` — CRIAR

**Caminho completo:** `src-tauri/wix/locales/pt-BR.wxl`

```xml
<?xml version="1.0" encoding="utf-8"?>
<WixLocalization Culture="pt-BR" Codepage="1252"
  xmlns="http://schemas.microsoft.com/wix/2006/localization">

  <String Id="WelcomeTitle">Bem-vindo ao assistente de instalação do PrintControl</String>
  <String Id="WelcomeText">Este assistente irá guiá-lo durante a instalação do [ProductName] no seu computador.\n\nRecomenda-se fechar todos os outros programas antes de continuar.\n\nClique em Avançar para continuar.</String>
  <String Id="FinishedTitle">Instalação do PrintControl concluída</String>
  <String Id="FinishedText">O [ProductName] foi instalado com sucesso.\n\nClique em Concluir para fechar o assistente.</String>
  <String Id="InstallDirDlgTitle">Pasta de destino</String>
  <String Id="InstallDirDlgBannerTitle">Pasta de destino</String>
  <String Id="InstallDirDlgBannerText">Clique em Avançar para instalar nesta pasta ou em Alterar para escolher outra pasta.</String>
  <String Id="ProgressDlgTitle">Instalando [ProductName]</String>
  <String Id="ProgressDlgBannerTitle">Instalando [ProductName]</String>
  <String Id="ProgressDlgBannerText">Por favor aguarde enquanto o assistente instala o [ProductName].</String>
  <String Id="ButtonNext">Avançar &gt;</String>
  <String Id="ButtonBack">&lt; Voltar</String>
  <String Id="ButtonCancel">Cancelar</String>
  <String Id="ButtonFinish">Concluir</String>
  <String Id="ButtonBrowse">Alterar...</String>

</WixLocalization>
```

---

### 4. `src-tauri/LICENSE.txt` — CRIAR

**Caminho completo:** `src-tauri/LICENSE.txt`

```
MIT License

Copyright (c) 2026 PrintControl Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 5. `src-tauri/resources/` — CRIAR DIRETÓRIO + BAIXAR ARQUIVO

O diretório `resources/` deve existir com um arquivo `.gitkeep` para ser rastreado pelo git. O binário do vcredist não vai para o repositório (é grande e binário).

**Ação manual necessária — executar no terminal:**
```bash
# Criar o diretório
mkdir -p src-tauri/resources

# Baixar o vcredist (requer internet; ~25 MB)
curl -Lo src-tauri/resources/vc_redist.x64.exe \
  "https://aka.ms/vs/17/release/vc_redist.x64.exe"
```

**Adicionar ao `.gitignore`:**
```
# Visual C++ Redistributable (baixado durante setup do ambiente)
src-tauri/resources/vc_redist.x64.exe
```

**Criar `src-tauri/resources/.gitkeep`:** (arquivo vazio, só para rastrear o diretório)

---

## Fase 2 — Branding

### 6. `src-tauri/windows/assets/` — CRIAR ASSETS

Estes são arquivos de imagem que precisam ser criados manualmente em ferramenta gráfica (Figma, Photoshop, GIMP, etc.).

| Arquivo | Dimensões exatas | Formato | Conteúdo sugerido |
|---|---|---|---|
| `src-tauri/windows/assets/header.bmp` | 150 × 57 px | BMP 24-bit | Logo PrintControl + fundo branco/cinza claro |
| `src-tauri/windows/assets/sidebar.bmp` | 164 × 314 px | BMP 24-bit | Logo grande + fundo cor da marca + slogan |

**Requisito técnico crítico:** o formato deve ser BMP 24-bit (não PNG, não BMP 32-bit com canal alpha). O NSIS não suporta transparência.

**Dica para converter PNG → BMP com ImageMagick:**
```bash
# header
magick logo.png -resize 150x57 -depth 24 -type TrueColor BMP3:header.bmp

# sidebar
magick logo.png -resize 164x314 -gravity center -background "#1E3A5F" -extent 164x314 -depth 24 -type TrueColor BMP3:sidebar.bmp
```

---

## Fase 3 — Atualização Automática

### 7. `src-tauri/Cargo.toml` — MODIFICAR

Adicionar as dependências dos plugins de updater e process na seção `[dependencies]`:

**Adicionar após `tauri-plugin-fs = "2"`:**
```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

**Arquivo completo resultante:**
```toml
[package]
name = "printcontrol"
version = "1.0.0"
description = "Sistema de rastreabilidade de impressão"
authors = ["PrintControl Team"]
license = "MIT"
repository = ""
default-run = "printcontrol"
edition = "2021"
rust-version = "1.77"

[lib]
name = "printcontrol_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[[bin]]
name = "printcontrol"
path = "src/main.rs"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-fs = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Impressão
printers = "2.3"

# Decodificação de PNG para ícones do tray
image = { version = "0.25", default-features = false, features = ["png"] }

# Banco de dados
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite", "macros", "chrono", "uuid"] }

# Async runtime
tokio = { version = "1", features = ["full"] }

# Async trait
async-trait = "0.1"

# Utilitários
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
thiserror = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

> **Nota:** `version` no `[package]` foi atualizado de `"0.1.0"` para `"1.0.0"` para alinhar com o `tauri.conf.json`. Mantenha sempre os dois em sincronia.

---

### 8. `src-tauri/src/lib.rs` — MODIFICAR

Registrar os dois novos plugins no builder. Inserir **antes** de `.plugin(tauri_plugin_shell::init())`:

**Diff — adicionar as duas linhas de plugin:**
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())  // ADICIONAR
    .plugin(tauri_plugin_process::init())                   // ADICIONAR
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    // ... resto inalterado
```

**Arquivo completo resultante:**
```rust
// src-tauri/src/lib.rs
mod app;
mod domain;
mod infrastructure;
mod services;
mod utils;
mod workers;

use app::commands;
use app::state::AppState;
use infrastructure::storage::sqlite::create_pool;
use services::settings_manager::SettingsManager;
use std::sync::Arc;
use tauri::Manager;
use workers::monitor::MonitorWorker;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("printcontrol=debug".parse().unwrap()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async {
                let (pool, db_path) = create_pool(&app_handle)
                    .await
                    .expect("Falha ao inicializar banco de dados");

                #[cfg(target_os = "windows")]
                let adapter = Arc::new(
                    infrastructure::printing::windows::WindowsAdapter::new()
                );

                #[cfg(target_os = "linux")]
                let adapter = Arc::new(
                    infrastructure::printing::linux::LinuxAdapter::new()
                );

                let job_manager = Arc::new(
                    services::job_manager::JobManager::new(pool.clone())
                );

                let settings_manager = Arc::new(
                    SettingsManager::new(pool.clone())
                );

                let auto_start = settings_manager
                    .get_all()
                    .await
                    .map(|s| s.auto_start_monitor)
                    .unwrap_or(true);

                let state = Arc::new(AppState {
                    printing_adapter: adapter,
                    job_manager,
                    settings_manager: settings_manager.clone(),
                    db_path,
                });

                app.manage(state.clone());

                if auto_start {
                    let worker = Arc::new(MonitorWorker::new());
                    app.manage(worker.clone());
                    worker.start(app_handle, state);
                }

                Ok::<(), Box<dyn std::error::Error>>(())
            })?;

            app::tray::setup(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(worker) = window.app_handle().try_state::<Arc<MonitorWorker>>() {
                    worker.stop();
                    tracing::info!("MonitorWorker encerrado via CloseRequested");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_jobs,
            commands::get_jobs_by_period,
            commands::get_printers,
            commands::get_job_stats,
            commands::get_settings,
            commands::update_setting,
            commands::reset_settings,
            commands::clear_history,
            commands::get_db_path,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar aplicacao PrintControl");
}
```

---

### 9. `package.json` — MODIFICAR

Adicionar os pacotes npm dos plugins na seção `dependencies`:

**Adicionar após `"@tauri-apps/plugin-shell": "^2.3.5"`:**
```json
"@tauri-apps/plugin-updater": "^2",
"@tauri-apps/plugin-process": "^2",
```

**Seção `dependencies` completa resultante:**
```json
"dependencies": {
  "@radix-ui/react-dialog": "^1.1.15",
  "@radix-ui/react-select": "^2.2.6",
  "@radix-ui/react-separator": "^1.1.8",
  "@radix-ui/react-slot": "^1.2.4",
  "@radix-ui/react-switch": "^1.2.6",
  "@radix-ui/react-tooltip": "^1.2.8",
  "@tanstack/react-query": "^5.95.2",
  "@tanstack/react-table": "^8.21.3",
  "@tauri-apps/api": "^2",
  "@tauri-apps/plugin-fs": "^2.4.5",
  "@tauri-apps/plugin-opener": "^2",
  "@tauri-apps/plugin-shell": "^2.3.5",
  "@tauri-apps/plugin-updater": "^2",
  "@tauri-apps/plugin-process": "^2",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "date-fns": "^4.1.0",
  "lucide-react": "^1.7.0",
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "react-router-dom": "^7.13.2",
  "recharts": "^3.8.1",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.5.0",
  "zod": "^4.3.6",
  "zustand": "^5.0.12"
}
```

**Após editar, rodar:**
```bash
pnpm install
```

---

### 10. `src/services/updater.service.ts` — CRIAR

**Caminho completo:** `src/services/updater.service.ts`

```typescript
// src/services/updater.service.ts
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export interface UpdateInfo {
  version: string;
  notes: string | null;
}

export async function checkForUpdate(): Promise<Update | null> {
  return await check();
}

export async function downloadAndApply(
  update: Update,
  onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? 0;
        onProgress({ downloaded: 0, total, percent: 0 });
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        onProgress({ downloaded, total, percent });
        break;
      case 'Finished':
        onProgress({ downloaded: total, total, percent: 100 });
        break;
    }
  });

  await relaunch();
}
```

---

### 11. `src/hooks/useUpdater.ts` — CRIAR

**Caminho completo:** `src/hooks/useUpdater.ts`

```typescript
// src/hooks/useUpdater.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import {
  checkForUpdate,
  downloadAndApply,
  type UpdateProgress,
} from '../services/updater.service';

type UpdaterState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; update: Update }
  | { status: 'downloading'; progress: UpdateProgress }
  | { status: 'up_to_date' }
  | { status: 'error'; message: string };

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 horas

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({ status: 'idle' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setState({ status: 'checking' });
    try {
      const update = await checkForUpdate();
      if (update) {
        setState({ status: 'available', update });
      } else {
        setState({ status: 'up_to_date' });
      }
    } catch (err) {
      // Em dev (sem endpoint configurado) silencia o erro para não poluir a UI
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message });
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (state.status !== 'available') return;
    const { update } = state;

    try {
      await downloadAndApply(update, (progress) => {
        setState({ status: 'downloading', progress });
      });
      // Se chegou aqui, relaunch() foi chamado — não há próximo estado
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message });
    }
  }, [state]);

  const dismiss = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  // Verificação inicial ao montar + polling a cada 4 horas
  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  return { state, applyUpdate, dismiss, checkNow: check };
}
```

---

### 12. `src/components/UpdateBanner.tsx` — CRIAR

**Caminho completo:** `src/components/UpdateBanner.tsx`

```tsx
// src/components/UpdateBanner.tsx
import { Download, X } from 'lucide-react';
import { useUpdater } from '../hooks/useUpdater';

export function UpdateBanner() {
  const { state, applyUpdate, dismiss } = useUpdater();

  if (state.status === 'available') {
    return (
      <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-2 text-sm">
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
      <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-2 text-sm">
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
```

---

### 13. `src/main.tsx` — MODIFICAR

Inserir o `<UpdateBanner />` dentro do provider, antes do `<AppRouter />`:

**Antes:**
```tsx
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>
);
```

**Depois:**
```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppRouter } from "./router";
import { UpdateBanner } from "./components/UpdateBanner";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen">
        <UpdateBanner />
        <div className="flex-1 overflow-hidden">
          <AppRouter />
        </div>
      </div>
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## Fase 4 — Assinatura de Código

Esta fase **não gera arquivos de código** — é operacional. Passos:

### Passo 1 — Adquirir certificado
- Opção econômica: [Sectigo OV](https://sectigo.com) ou [DigiCert OV](https://www.digicert.com)
- Opção sem SmartScreen: [DigiCert EV](https://www.digicert.com) ou [Certum EV](https://www.certum.eu)
- Desde jun/2023, certificados OV ficam em HSM (físico ou Azure Key Vault)

### Passo 2 — Configurar Azure Key Vault (se OV/EV via HSM cloud)

Instalar `relic`:
```bash
cargo install relic
```

Criar `src-tauri/relic.conf` (não commitar — adicionar ao `.gitignore`):
```toml
[tokens.azure]
type = "azure"

[keys.codesign]
token = "azure"
id = "https://SEU_KEYVAULT.vault.azure.net/certificates/NOME_DO_CERT"
```

Adicionar ao `.gitignore`:
```
src-tauri/relic.conf
certificate/
```

### Passo 3 — Adicionar `signCommand` ao `tauri.conf.json`

Na seção `bundle.windows`, adicionar:
```json
"signCommand": "relic sign --file %1 --key codesign --config relic.conf"
```

### Passo 4 — Variáveis de ambiente necessárias no CI

| Secret | Descrição |
|---|---|
| `AZURE_CLIENT_ID` | App Registration ID no Azure AD |
| `AZURE_TENANT_ID` | Tenant ID do Azure AD |
| `AZURE_CLIENT_SECRET` | Secret do App Registration |

---

## Fase 5 — CI/CD

### 14. `.github/workflows/release-windows.yml` — CRIAR

**Caminho completo:** `.github/workflows/release-windows.yml`

```yaml
name: Release Windows

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # WiX (para build MSI) precisa do VBScript habilitado
      - name: Habilitar VBScript para build MSI
        shell: powershell
        run: Enable-WindowsOptionalFeature -Online -FeatureName "VBScript" -NoRestart

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Rust (stable)
        uses: dtolnay/rust-toolchain@stable

      # Cache das dependências Rust para builds mais rápidos
      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Instalar dependências frontend
        run: pnpm install

      # Baixar vcredist (não está no repositório por ser binário grande)
      - name: Baixar Visual C++ Redistributable
        shell: powershell
        run: |
          New-Item -ItemType Directory -Force -Path src-tauri/resources
          Invoke-WebRequest `
            -Uri "https://aka.ms/vs/17/release/vc_redist.x64.exe" `
            -OutFile "src-tauri/resources/vc_redist.x64.exe"

      # Importar certificado (só executa se o secret existir)
      - name: Importar certificado de assinatura
        if: ${{ secrets.WINDOWS_CERTIFICATE != '' }}
        shell: powershell
        env:
          WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
          WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
        run: |
          New-Item -ItemType Directory -Force -Path certificate
          Set-Content -Path certificate/tempCert.txt -Value $env:WINDOWS_CERTIFICATE
          certutil -decode certificate/tempCert.txt certificate/certificate.pfx
          Remove-Item certificate/tempCert.txt
          Import-PfxCertificate `
            -FilePath certificate/certificate.pfx `
            -CertStoreLocation Cert:\CurrentUser\My `
            -Password (ConvertTo-SecureString -String $env:WINDOWS_CERTIFICATE_PASSWORD -Force -AsPlainText)
          Remove-Item -Recurse -Force certificate

      - name: Build e criar release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # Para assinatura via Azure Key Vault (Fase 4):
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'PrintControl ${{ github.ref_name }}'
          releaseBody: |
            ## PrintControl ${{ github.ref_name }}

            ### Instalação
            - **Windows**: Baixe `PrintControl_*_x64-setup.exe` e execute

            ### Instalação silenciosa (corporativo)
            ```
            PrintControl_*_x64-setup.exe /S
            ```

            Veja `CHANGELOG.md` para detalhes das mudanças.
          releaseDraft: true
          prerelease: false
          includeUpdaterJson: true
```

---

## Geração das chaves do updater (executar uma única vez)

```bash
# No terminal, na raiz do projeto
pnpm tauri signer generate -- -w ~/.tauri/printcontrol.key

# O comando imprime a chave pública — copie-a para tauri.conf.json em:
# plugins.updater.pubkey
```

**Adicionar ao GitHub Secrets:**

| Secret | Valor |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Conteúdo de `~/.tauri/printcontrol.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Senha definida na geração (pode ser vazia) |

**Nunca commitar `~/.tauri/printcontrol.key`.**

---

## Checklist de verificação por fase

### Fase 1 — Instalador Funcional
- [ ] `tauri.conf.json` atualizado
- [ ] `src-tauri/windows/hooks.nsh` criado
- [ ] `src-tauri/wix/locales/pt-BR.wxl` criado
- [ ] `src-tauri/LICENSE.txt` criado
- [ ] `src-tauri/resources/vc_redist.x64.exe` baixado (manual)
- [ ] `.gitignore` atualizado para excluir `vc_redist.x64.exe`
- [ ] Build local: `pnpm tauri build` sem erros
- [ ] Instalação testada em Windows 10 (VM) — app abre sem erro de WebView2
- [ ] Instalação testada em Windows 11

### Fase 2 — Branding
- [ ] `header.bmp` criado (150×57, BMP 24-bit)
- [ ] `sidebar.bmp` criado (164×314, BMP 24-bit)
- [ ] Visual do instalador aprovado

### Fase 3 — Atualização Automática
- [ ] `tauri-plugin-updater` e `tauri-plugin-process` adicionados ao `Cargo.toml`
- [ ] Plugins registrados em `lib.rs`
- [ ] Pacotes npm instalados (`pnpm install`)
- [ ] `updater.service.ts` criado
- [ ] `useUpdater.ts` criado
- [ ] `UpdateBanner.tsx` criado
- [ ] `main.tsx` atualizado
- [ ] Chaves geradas (`pnpm tauri signer generate`)
- [ ] `pubkey` inserida no `tauri.conf.json`
- [ ] Endpoint de releases configurado (GitHub Releases)
- [ ] Ciclo completo testado: build v1.0.0 → instala → build v1.0.1 → app detecta e atualiza

### Fase 4 — Assinatura de Código
- [ ] Certificado adquirido
- [ ] `relic` instalado e configurado
- [ ] `signCommand` adicionado ao `tauri.conf.json`
- [ ] Secrets do Azure configurados no GitHub
- [ ] Build assinado verificado (sem aviso SmartScreen)

### Fase 5 — CI/CD
- [ ] `.github/workflows/release-windows.yml` criado
- [ ] Todos os secrets configurados no repositório GitHub
- [ ] Release disparado via tag `v1.0.0` — artifacts gerados corretamente
- [ ] `latest.json` publicado junto com o release (para o updater)

---

## Dependências de ambiente de desenvolvimento (Windows)

Para buildar localmente no Windows, instalar:

```powershell
# Rust
winget install Rustlang.Rust.MSVC

# Node.js 20 LTS
winget install OpenJS.NodeJS.LTS

# pnpm
npm install -g pnpm

# WebView2 (já vem no Windows 11; se Win 10 limpo:)
# Baixar de https://developer.microsoft.com/microsoft-edge/webview2/

# Visual Studio Build Tools (necessário para compilar crates Rust com C FFI)
winget install Microsoft.VisualStudio.2022.BuildTools
# Durante instalação, selecionar: "C++ build tools" workload
```
