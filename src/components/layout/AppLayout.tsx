// src/components/layout/AppLayout.tsx
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandMenu } from "../ui/command-menu";
import { useTauriEvent } from "../../hooks/useTauriEvent";
import { useTrayNavigation } from "../../hooks/useTrayNavigation";
import { useNotificationStore } from "../../store/notificationStore";
import { useSettingsStore } from "../../store/settingsStore";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { toast } from "sonner";
import type { PrintJob } from "../../types";

export function AppLayout() {
  const addMonitorError = useNotificationStore((s) => s.addMonitorError);
  const { settings, fetch } = useSettingsStore();

  // Navegação via bandeja do sistema
  useTrayNavigation();

  // Carrega settings na inicialização
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Aplica tema ao documento
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (settings.theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings?.theme]);

  // Notifica erros do monitor
  useTauriEvent<string>("monitor-error", ({ payload }) => {
    addMonitorError(payload);
    if (settings?.notify_on_monitor_error !== false) {
      toast.error(`Erro no monitor: ${payload}`);
      if (settings?.desktop_notification) {
        sendNotification({
          title: "PrintControl — Erro no Monitor",
          body: `Falha no monitoramento: ${payload}`,
        });
      }
    }
  });

  // Notifica jobs com falha — payload é sempre um PrintJob completo
  useTauriEvent<PrintJob>("job-failed", ({ payload }) => {
    if (settings?.notify_on_failed !== false) {
      toast.error(`Job falhou: ${payload.document_name}`);
      if (settings?.desktop_notification) {
        sendNotification({
          title: "PrintControl — Falha na Impressão",
          body: `O job "${payload.document_name}" foi classificado como FAILED.`,
        });
      }
    }
  });

  return (
    <div className="flex h-full bg-background overflow-hidden relative">
      <CommandMenu />
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
