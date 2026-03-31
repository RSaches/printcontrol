# PRD — Instalador Windows (PrintControl)

**Versão:** 1.0
**Data:** 2026-03-30
**Status:** Rascunho

---

## 1. Visão Geral

Este documento descreve os requisitos, decisões técnicas e plano de implementação para o instalador Windows do PrintControl — um sistema de rastreabilidade de impressão construído com Tauri 2 + React + Rust.

O objetivo é entregar um instalador profissional, moderno e confiável que:
- Funcione sem atrito em Windows 10 e Windows 11
- Instale todas as dependências necessárias automaticamente
- Ofereça suporte a implantação silenciosa em ambientes corporativos
- Inclua mecanismo de atualização automática
- Transmita confiança ao usuário final (assinatura, branding)

---

## 2. Contexto Atual

O `tauri.conf.json` hoje tem apenas configuração mínima de bundle:

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
}
```

Isso gera um instalador funcional mas sem configuração de WebView2, assinatura de código, branding, ou atualização automática. Este PRD endereça todas essas lacunas.

---

## 3. Dependências do Projeto que o Instalador Deve Contemplar

| Dependência | Situação no Windows | Solução |
|---|---|---|
| **WebView2 Runtime** | Pré-instalado no Win 11; ausente em Win 10 limpo | `embedBootstrapper` |
| **Visual C++ Redistributable** | Pode estar ausente | Bundle + hook NSIS |
| **SQLite** | Compilado staticamente no binário Rust | Nenhuma ação necessária |
| **Runtime Tokio/async** | Compilado staticamente | Nenhuma ação necessária |
| **Ícones de bandeja (PNG)** | Bundled via `resources` | Incluir em `bundle.resources` |

---

## 4. Decisões Técnicas

### 4.1 Formato do Instalador

| Formato | Decisão | Justificativa |
|---|---|---|
| **NSIS** (`.exe`) | **Principal** | Build cross-platform; melhor UX; suporte a modo silencioso; branding completo |
| **MSI** (`.msi`) | **Opcional** | Exigido por algumas políticas corporativas / GPO |

Configuração:
```json
"bundle": {
  "targets": ["nsis", "msi"]
}
```

### 4.2 Tratamento do WebView2

Usar `embedBootstrapper` (~1,8 MB de overhead). Vantagens:
- Compatível com Windows 10 e Windows 11
- O bootstrapper é executado dentro do fluxo de instalação (sem popup "Windows Edge Update" confuso)
- Não depende de conexão ativa no momento da instalação (apenas para baixar o runtime completo se necessário)

Evitar `downloadBootstrapper` (padrão) por causa do [bug #4389](https://github.com/tauri-apps/tauri/issues/4389) que gera pop-up de UAC inesperado.

### 4.3 Modo de Instalação

| Cenário | Modo | Diretório | UAC |
|---|---|---|---|
| Uso individual / desenvolvedor | `currentUser` | `%LOCALAPPDATA%\PrintControl` | Não exige |
| Implantação corporativa | `perMachine` | `C:\Program Files\PrintControl` | Exige elevação |
| Padrão recomendado | `both` | Usuário escolhe durante instalação | Conforme escolha |

Recomendação: começar com `currentUser`. Migrar para `both` quando houver demanda corporativa.

### 4.4 Assinatura de Código

Sem assinatura de código, o Windows Defender SmartScreen bloqueia a execução com o aviso "Windows protegeu seu PC". Isso é inaceitável para produção.

**Roadmap de assinatura:**

| Fase | Certificado | Custo estimado | Comportamento SmartScreen |
|---|---|---|---|
| MVP / Beta | Sem certificado | R$ 0 | Bloqueio com aviso — aceitável apenas para testes internos |
| Lançamento v1 | OV (Organization Validated) | ~R$ 600–1.200/ano | Aviso desaparece após ~500 instalações |
| Produção consolidada | EV (Extended Validation) | ~R$ 1.500–3.500/ano | Confiança imediata, sem aviso |

**Implementação com Azure Key Vault (OV/EV pós-junho 2023):**

Desde junho de 2023, certificados OV não são mais exportados como `.pfx` — devem ficar armazenados em HSM. O Azure Key Vault é a solução recomendada para CI/CD.

```json
"bundle": {
  "windows": {
    "signCommand": "relic sign --file %1 --key azure --config relic.conf",
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.comodoca.com"
  }
}
```

### 4.5 Atualização Automática

Usar `tauri-plugin-updater` com modo `passive` (barra de progresso discreta, sem interação do usuário).

**Fluxo:**
1. App verifica endpoint de atualização ao iniciar (e periodicamente)
2. Se nova versão disponível: baixa em background com barra de progresso
3. Aplica atualização e relança automaticamente

**Modo de instalação do updater:** `passive` — mostra progresso sem pedir confirmação, ideal para ambiente de produção.

---

## 5. Especificação Completa do `tauri.conf.json`

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
        "https://releases.printcontrol.com/{{target}}/{{arch}}/{{current_version}}"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

---

## 6. Estrutura de Arquivos a Criar

```
src-tauri/
├── icons/
│   └── icon.ico                        (já existe)
├── windows/
│   ├── assets/
│   │   ├── header.bmp                  (150×57 px — cabeçalho do instalador)
│   │   └── sidebar.bmp                 (164×314 px — barra lateral welcome/finish)
│   └── hooks.nsh                       (instalar vcredist se necessário)
├── wix/
│   └── locales/
│       └── pt-BR.wxl                   (strings em português para MSI)
├── resources/
│   └── vc_redist.x64.exe              (Visual C++ Redistributable)
└── LICENSE.txt                         (exibida durante instalação)
```

---

## 7. Hook NSIS para Visual C++ Redistributable

Arquivo: `src-tauri/windows/hooks.nsh`

```nsis
!macro NSIS_HOOK_PREINSTALL
  ; Verifica se vcredist já está instalado (Visual Studio 2022 x64)
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  StrCmp $0 "1" vcredist_ok
    DetailPrint "Instalando Visual C++ Redistributable..."
    ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /passive /norestart'
  vcredist_ok:
!macroend
```

---

## 8. Atualização Automática — Implementação

### 8.1 Dependências (`Cargo.toml`)

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

### 8.2 Registro no App (`src-tauri/src/lib.rs`)

```rust
app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
app.handle().plugin(tauri_plugin_process::init())?;
```

### 8.3 Lógica no Frontend (TypeScript)

```typescript
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates() {
  const update = await check();
  if (!update) return;

  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? 0;
        console.log(`Iniciando download: ${total} bytes`);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        console.log(`Progresso: ${pct}%`);
        break;
      case 'Finished':
        console.log('Download concluído, aplicando atualização...');
        break;
    }
  });

  await relaunch();
}
```

### 8.4 Geração das Chaves

```bash
# Gerar par de chaves de assinatura
npm run tauri signer generate -- -w ~/.tauri/printcontrol.key

# Exportar variáveis de ambiente (nunca commitar a chave privada)
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/printcontrol.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

A chave pública gerada vai em `plugins.updater.pubkey` no `tauri.conf.json`.

### 8.5 Formato do JSON de Release

Hospedar em endpoint estático (ex: GitHub Releases ou CDN):

```json
{
  "version": "1.1.0",
  "notes": "Correções de bugs e melhorias de desempenho",
  "pub_date": "2026-04-01T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://releases.printcontrol.com/1.1.0/PrintControl_1.1.0_x64-setup.exe",
      "signature": "ASSINATURA_BASE64_AQUI"
    }
  }
}
```

---

## 9. Pipeline de Build (GitHub Actions)

```yaml
name: Release Windows

on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Enable VBScript (para build MSI)
        run: Enable-WindowsOptionalFeature -Online -FeatureName "VBScript" -NoRestart
        shell: powershell

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install frontend deps
        run: pnpm install

      - name: Import certificate
        env:
          WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
          WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
        run: |
          New-Item -ItemType directory -Path certificate
          Set-Content -Path certificate/tempCert.txt -Value $env:WINDOWS_CERTIFICATE
          certutil -decode certificate/tempCert.txt certificate/certificate.pfx
          Remove-Item certificate/tempCert.txt
          Import-PfxCertificate -FilePath certificate/certificate.pfx `
            -CertStoreLocation Cert:\CurrentUser\My `
            -Password (ConvertTo-SecureString -String $env:WINDOWS_CERTIFICATE_PASSWORD -Force -AsPlainText)
        shell: powershell

      - name: Build e empacota
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: 'PrintControl v__VERSION__'
          releaseBody: |
            Veja as mudanças em CHANGELOG.md
          releaseDraft: true
          prerelease: false
```

---

## 10. Implantação Silenciosa (Corporativo)

### NSIS
```cmd
REM Instalação silenciosa no diretório padrão
PrintControl_1.0.0_x64-setup.exe /S

REM Instalação silenciosa com diretório customizado (sem aspas, deve ser último argumento)
PrintControl_1.0.0_x64-setup.exe /S /D=C:\Sistemas\PrintControl

REM Instalação passiva (mostra progresso, sem interação)
PrintControl_1.0.0_x64-setup.exe /passive
```

### MSI (WiX)
```cmd
REM Completamente silencioso
msiexec /i PrintControl_1.0.0_x64_pt-BR.msi /qn

REM Silencioso com diretório customizado
msiexec /i PrintControl_1.0.0_x64_pt-BR.msi /qn INSTALLFOLDER="C:\Sistemas\PrintControl"

REM Para todos os usuários (requer admin)
msiexec /i PrintControl_1.0.0_x64_pt-BR.msi /qn ALLUSERS=1
```

---

## 11. Branding do Instalador

### Assets necessários

| Arquivo | Dimensões | Formato | Onde aparece |
|---|---|---|---|
| `header.bmp` | 150×57 px | BMP 24-bit | Cabeçalho de todas as telas |
| `sidebar.bmp` | 164×314 px | BMP 24-bit | Tela de boas-vindas e conclusão |
| `icon.ico` | Multi-resolução | ICO | Ícone da janela do instalador |

### Conteúdo sugerido para `sidebar.bmp`
- Logo PrintControl em destaque
- Fundo em cor da marca
- Slogan / tagline do produto

---

## 12. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| SmartScreen bloqueia instalador sem assinatura | Alto — impede adoção | Assinar com certificado OV ou EV antes do lançamento público |
| WebView2 ausente em Win 10 | Alto — app não abre | Usar `embedBootstrapper` (já incluído neste PRD) |
| Chave privada do updater vazada | Crítico — permite injeção de updates maliciosos | Armazenar apenas em secrets do CI/CD, nunca em repositório |
| VBScript desabilitado no CI | Médio — build MSI falha | `Enable-WindowsOptionalFeature` no pipeline (já incluído) |
| FIPS mode em ambiente governamental | Baixo | Definir `TAURI_BUNDLER_WIX_FIPS_COMPLIANT=true` no build |
| Versão não permite downgrade | Médio — trava rollback | Manter `allowDowngrades: true` (padrão, já incluído) |

---

## 13. Plano de Implementação

### Fase 1 — Instalador Funcional (sem assinatura)
- [ ] Atualizar `tauri.conf.json` com configurações de WebView2, NSIS e MSI
- [ ] Criar estrutura de diretórios `windows/`, `wix/`, `resources/`
- [ ] Baixar `vc_redist.x64.exe` e colocar em `src-tauri/resources/`
- [ ] Criar `hooks.nsh` para instalar vcredist
- [ ] Criar `LICENSE.txt`
- [ ] Testar build local no Windows: `pnpm tauri build`
- [ ] Validar instalação em Windows 10 limpo (VM)

### Fase 2 — Branding
- [ ] Criar `header.bmp` (150×57)
- [ ] Criar `sidebar.bmp` (164×314)
- [ ] Referenciar assets no `tauri.conf.json`
- [ ] Testar visual do instalador

### Fase 3 — Atualização Automática
- [ ] Adicionar `tauri-plugin-updater` e `tauri-plugin-process` ao `Cargo.toml`
- [ ] Registrar plugins em `lib.rs`
- [ ] Implementar lógica de verificação no frontend
- [ ] Gerar par de chaves de assinatura
- [ ] Configurar endpoint de releases (GitHub Releases ou servidor próprio)
- [ ] Testar ciclo completo de atualização

### Fase 4 — Assinatura de Código
- [ ] Adquirir certificado OV (ou EV se orçamento permitir)
- [ ] Configurar Azure Key Vault + `relic`
- [ ] Configurar secrets no GitHub Actions
- [ ] Testar pipeline completo com assinatura
- [ ] Verificar ausência de aviso SmartScreen

### Fase 5 — CI/CD Completo
- [ ] Criar workflow `release-windows.yml`
- [ ] Configurar todos os secrets necessários
- [ ] Testar release end-to-end via tag git
- [ ] Documentar processo de release para a equipe

---

## 14. Dependências de Software para Build

| Software | Versão mínima | Necessidade |
|---|---|---|
| Rust | 1.77 | Já no `Cargo.toml` |
| Node.js | 20 | Frontend |
| pnpm | 9 | Gerenciador de pacotes |
| Tauri CLI | 2.x | `@tauri-apps/cli` |
| Windows 10/11 ou runner Windows | — | Build de MSI (WiX não roda em Linux/macOS) |
| WiX Toolset | Gerenciado pelo Tauri | Somente para MSI |
| NSIS | Gerenciado pelo Tauri | Somente para NSIS |

> Nota: o build NSIS pode ser feito cross-platform a partir do Linux usando `cargo-xwin`. O build MSI exige obrigatoriamente uma máquina Windows.

---

## 15. Referências

- [Tauri v2 — Windows Installer](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri v2 — Updater Plugin](https://v2.tauri.app/plugin/updater/)
- [Tauri v2 — Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [Tauri v2 — GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/)
- [Tauri v2 — Configuration Reference](https://v2.tauri.app/reference/config/)
- [NsisConfig Struct — docs.rs](https://docs.rs/tauri-utils/latest/tauri_utils/config/struct.NsisConfig.html)
- [WebviewInstallMode Enum — docs.rs](https://docs.rs/tauri-utils/latest/tauri_utils/config/enum.WebviewInstallMode.html)
