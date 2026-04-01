// src/features/settings/pages/SettingsPage.tsx
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { toast } from "sonner";
import { AppSettings } from "../../../types";
import { settingsService } from "../../../services/settings.service";
import { useSettingsStore } from "../../../store/settingsStore";
import { useWhatsNew } from "../../../hooks/useWhatsNew";
import { Switch } from "../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import {
  Activity,
  Database,
  Bell,
  Palette,
  Info,
  RotateCcw,
  Sparkles,
  Mail,
} from "lucide-react";

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-1 pl-9">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { settings, fetch, update } = useSettingsStore();
  const [dbPath, setDbPath] = useState<string>("");
  const [appVersion, setAppVersion] = useState<string>("");
  const [clearingDays, setClearingDays] = useState("90");
  const { showAll: showWhatsNew } = useWhatsNew();
  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [pollInterval, setPollInterval] = useState("");
  const [jobTimeout, setJobTimeout] = useState("");
  const [historyRetention, setHistoryRetention] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState("");

  useEffect(() => {
    fetch();
    settingsService.getDbPath().then(setDbPath).catch(() => {});
    getVersion().then(setAppVersion).catch(() => {});
  }, [fetch]);

  useEffect(() => {
    if (settings) {
      setPollInterval(String(settings.poll_interval_secs));
      setJobTimeout(String(settings.job_timeout_mins));
      setHistoryRetention(String(settings.history_retention_days));
      setItemsPerPage(String(settings.items_per_page));
    }
  }, [settings]);

  async function saveNumeric(key: keyof AppSettings, value: string) {
    try {
      await update(key, value);
      toast.success("Configuração salva.");
    } catch {
      toast.error("Erro ao salvar configuração.");
    }
  }

  async function saveToggle(key: keyof AppSettings, checked: boolean) {
    try {
      await update(key, String(checked));
    } catch {
      toast.error("Erro ao salvar configuração.");
    }
  }

  async function saveSelect(key: keyof AppSettings, value: string) {
    try {
      await update(key, value);
    } catch {
      toast.error("Erro ao salvar configuração.");
    }
  }

  async function handleClearHistory() {
    const days = parseInt(clearingDays, 10);
    if (isNaN(days) || days < 0) {
      toast.error("Informe um número de dias válido.");
      return;
    }
    setClearing(true);
    try {
      const deleted = await settingsService.clearHistory(days);
      if (deleted > 0) {
        // Invalida cache para atualizar a Dashboard e a lista de Jobs
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["job-stats"] });
        toast.success(`${deleted} registros removidos.`);
        if (days === 0) setClearingDays("0");
      } else {
        toast.info("Nenhum registro encontrado para este período.");
      }
    } catch {
      toast.error("Erro ao limpar histórico.");
    } finally {
      setClearing(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await settingsService.reset();
      await fetch();
      toast.success("Configurações restauradas para o padrão.");
    } catch {
      toast.error("Erro ao restaurar configurações.");
    } finally {
      setResetting(false);
    }
  }

  if (!settings) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="p-5 max-w-2xl space-y-5 page-enter">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Configurações</h1>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="w-3.5 h-3.5" />
          {resetting ? "Restaurando..." : "Restaurar padrões"}
        </Button>
      </div>

      {/* ── Monitoramento ── */}
      <SectionCard icon={Activity} title="Monitoramento">
        <SettingRow
          label="Intervalo de polling (segundos)"
          description="Com que frequência o spooler é verificado."
        >
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={1}
              max={60}
              value={pollInterval}
              onChange={(e) => setPollInterval(e.target.value)}
              className="w-20 h-8 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => saveNumeric("poll_interval_secs", pollInterval)}
            >
              Salvar
            </Button>
          </div>
        </SettingRow>
        <SettingRow
          label="Timeout de jobs (minutos)"
          description="Jobs em PRINTING/PENDING por mais que este tempo são marcados como FAILED."
        >
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={1}
              max={120}
              value={jobTimeout}
              onChange={(e) => setJobTimeout(e.target.value)}
              className="w-20 h-8 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => saveNumeric("job_timeout_mins", jobTimeout)}
            >
              Salvar
            </Button>
          </div>
        </SettingRow>
        <SettingRow
          label="Iniciar monitor automaticamente"
          description="Inicia o monitoramento ao abrir o aplicativo."
        >
          <Switch
            checked={settings.auto_start_monitor}
            onCheckedChange={(v) => saveToggle("auto_start_monitor", v)}
          />
        </SettingRow>
      </SectionCard>

      {/* ── Histórico & BD ── */}
      <SectionCard icon={Database} title="Histórico & Banco de Dados">
        <SettingRow
          label="Retenção de histórico (dias)"
          description="Jobs mais antigos que este período serão removidos automaticamente."
        >
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={1}
              max={3650}
              value={historyRetention}
              onChange={(e) => setHistoryRetention(e.target.value)}
              className="w-20 h-8 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => saveNumeric("history_retention_days", historyRetention)}
            >
              Salvar
            </Button>
          </div>
        </SettingRow>
        <SettingRow
          label="Limpar histórico agora"
          description="Remove registros mais antigos que N dias do banco de dados."
        >
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={0}
              value={clearingDays}
              onChange={(e) => setClearingDays(e.target.value)}
              className="w-20 h-8 text-sm"
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={handleClearHistory}
              disabled={clearing}
            >
              {clearing ? "Limpando..." : "Limpar"}
            </Button>
          </div>
        </SettingRow>
        <SettingRow
          label="Localização do banco de dados"
          description={dbPath || "Carregando..."}
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(dbPath).catch(() => {});
              toast.success("Caminho copiado.");
            }}
          >
            Copiar
          </Button>
        </SettingRow>
      </SectionCard>

      {/* ── Notificações ── */}
      <SectionCard icon={Bell} title="Notificações">
        <SettingRow
          label="Notificar em jobs com falha"
          description="Exibe toast quando um job é marcado como FAILED."
        >
          <Switch
            checked={settings.notify_on_failed}
            onCheckedChange={(v) => saveToggle("notify_on_failed", v)}
          />
        </SettingRow>
        <SettingRow
          label="Notificar em erros do monitor"
          description="Exibe toast quando o worker de monitoramento encontra um erro."
        >
          <Switch
            checked={settings.notify_on_monitor_error}
            onCheckedChange={(v) => saveToggle("notify_on_monitor_error", v)}
          />
        </SettingRow>
        <SettingRow
          label="Notificação na área de trabalho"
          description="Envia notificação do sistema operacional além do toast in-app."
        >
          <Switch
            checked={settings.desktop_notification}
            onCheckedChange={(v) => saveToggle("desktop_notification", v)}
          />
        </SettingRow>
      </SectionCard>

      {/* ── Interface ── */}
      <SectionCard icon={Palette} title="Interface">
        <SettingRow
          label="Itens por página"
          description="Número de linhas exibidas na tabela de jobs."
        >
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={5}
              max={200}
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(e.target.value)}
              className="w-20 h-8 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => saveNumeric("items_per_page", itemsPerPage)}
            >
              Salvar
            </Button>
          </div>
        </SettingRow>
        <SettingRow label="Tema" description="Aparência do aplicativo.">
          <Select
            value={settings.theme}
            onValueChange={(v) => saveSelect("theme", v)}
          >
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Sistema</SelectItem>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Idioma" description="Idioma da interface.">
          <Select
            value={settings.language}
            onValueChange={(v) => saveSelect("language", v)}
          >
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt-BR">Português</SelectItem>
              <SelectItem value="en-US">English</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SectionCard>

      {/* ── Sobre ── */}
      <SectionCard icon={Info} title="Sobre">
        <SettingRow label="Versão" description="Versão instalada do PrintControl">
          <span className="text-sm font-medium text-muted-foreground">
            {appVersion ? `v${appVersion}` : "—"}
          </span>
        </SettingRow>
        <SettingRow label="Tecnologia" description="Tauri 2 + Rust + React">
          <span className="text-sm text-muted-foreground">
            {navigator.userAgent.includes("Linux") ? "Linux" : "Windows"}
          </span>
        </SettingRow>
        <SettingRow
          label="Contato do desenvolvedor"
          description="Dúvidas, sugestões ou suporte técnico."
        >
          <a
            href="mailto:dev.sanchess@proton.me"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Mail className="w-3.5 h-3.5" />
            dev.sanchess@proton.me
          </a>
        </SettingRow>
        <SettingRow
          label="O que há de novo"
          description="Veja as melhorias da versão atual e anteriores."
        >
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={showWhatsNew}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ver novidades
          </Button>
        </SettingRow>
      </SectionCard>
    </div>
  );
}
