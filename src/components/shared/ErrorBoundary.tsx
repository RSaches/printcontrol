// src/components/shared/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full glass p-8 rounded-2xl border text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">Ocorreu um erro inesperado</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A aplicação encontrou uma falha na renderização. Se o problema persistir, entre em contato com o suporte enviando os arquivos de log.
              </p>
            </div>

            <div className="p-4 bg-muted/50 rounded-xl border border-border/50 text-left overflow-auto max-h-32">
              <code className="text-xs text-destructive font-mono break-all">
                {this.state.message}
              </code>
            </div>

            <button
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
