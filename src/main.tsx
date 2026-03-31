// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppRouter } from "./router";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { UpdateBanner } from "./components/UpdateBanner";
import { UpdateModal } from "./components/UpdateModal";
import { Titlebar } from "./components/layout/Titlebar";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Desativa o menu de contexto padrão (botão direito) do navegador / webview,
// restrito para permitir clique direito sobre inputs ou áreas digitáveis.
if (import.meta.env.PROD || true) {
  document.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }
    e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="flex flex-col h-screen">
          <Titlebar />
          <UpdateBanner />
          <UpdateModal />
          <div className="flex-1 overflow-hidden relative">
            <AppRouter />
          </div>
        </div>
        <Toaster richColors position="bottom-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
