# 🖨️ PrintControl

[![Release](https://github.com/RSaches/printcontrol/actions/workflows/release.yml/badge.svg)](https://github.com/RSaches/printcontrol/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)

**PrintControl** é um sistema moderno de rastreabilidade e monitoramento de impressões, desenvolvido para oferecer visibilidade total sobre o que, quem e onde está sendo impresso em sua rede ou computador local.

Construído com a robustez do **Rust** no backend e a agilidade do **React** no frontend, o PrintControl garante performance excepcional com baixo consumo de recursos, integrando-se perfeitamente ao ambiente desktop (Windows e Linux).

---

## ✨ Funcionalidades Principais

- 🔍 **Rastreabilidade em Tempo Real**: Monitore jobs de impressão instantaneamente conforme são enviados para o spooler do sistema.
- 📊 **Dashboards Inteligentes**: Visualize estatísticas de uso e volumes de impressão através de gráficos interativos.
- 🗃️ **Histórico Persistente**: Armazenamento local seguro usando SQLite para consultas históricas de longo prazo.
- 🔔 **Notificações Nativas**: Alertas de sistema vinculados a falhas de monitoramento ou erros críticos de job.
- 🧊 **Ícone na Bandeja (Tray Icon)**: O app continua rodando silenciosamente em segundo plano, acessível a qualquer momento.
- 🔌 **Gerenciamento de Impressoras**: Liste e gerencie as impressoras instaladas no sistema diretamente pelo app.
- 🔄 **Auto-Updates**: Sistema de atualização automática para garantir que você sempre tenha a versão mais estável.

---

## 🛠️ Stack Tecnológica

### Backend
- **Rust**: Linguagem principal para segurança e performance.
- **Tauri 2.0**: Framework para criação de apps desktop com webview segura.
- **SQLite + SQLx**: Banco de dados embarcado com suporte a migrações assíncronas.
- **Tokio**: Runtime assíncrono para monitoramento multitarefa.

### Frontend
- **React 19**: Biblioteca de interface moderna e reativa.
- **TypeScript**: Tipagem estática para maior confiabilidade de código.
- **Tailwind CSS**: Estilização baseada em utilitários para design responsivo.
- **TanStack Query & Table**: Gerenciamento de estado de dados e tabelas complexas.
- **Shadcn/UI**: Componentes de interface de alta qualidade e acessibilidade.

---

## 🚀 Começando

### Pré-requisitos
Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (LTS recomendado)
- [Rust & Cargo](https://rustup.rs/) v1.77+
- [PNPM](https://pnpm.io/) (Gerenciador de pacotes preferencial)

### Instalação

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/RSaches/printcontrol.git
    cd printcontrol
    ```

2.  **Instale as dependências do frontend**:
    ```bash
    pnpm install
    ```

3.  **Ambiente de Desenvolvimento**:
    Para rodar o app localmente com hot-reload (Frontend e Backend):
    ```bash
    pnpm tauri dev
    ```

4.  **Gerar Build de Produção**:
    Para compilar o executável final otimizado para o seu sistema:
    ```bash
    pnpm tauri build
    ```

---

## ☁️ CI/CD e Releases

Este projeto utiliza **GitHub Actions** para automação de builds e lançamentos. 

Sempre que uma nova **Tag** seguindo o padrão `v*` (ex: `v0.1.0`) é enviada ao repositório, o pipeline inicia automaticamente a compilação cruzada para Windows e Linux, gerando instaladores `.exe`, `.msi` e `.deb` na aba de [Releases](https://github.com/RSaches/printcontrol/releases).

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE.txt](LICENSE.txt) para mais detalhes.

---

## 🤝 Contribuição

Contribuições são sempre bem-vindas! Sinta-se à vontade para abrir uma *Issue* ou enviar um *Pull Request* com melhorias.

---
*Desenvolvido com ❤️ pela equipe do PrintControl.*
