import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-stone-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-stone-900 mb-2">Ops! Algo deu errado.</h2>
            <p className="text-stone-600 mb-8 leading-relaxed">
              Ocorreu um erro inesperado na interface. Tente recarregar a página para continuar usando o SKP Render Pro IA.
            </p>

            <button
              onClick={this.handleReset}
              className="w-full py-4 bg-[#1b4e36] hover:bg-[#143d2a] text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-lg shadow-green-900/10"
            >
              <RefreshCw className="w-5 h-5" />
              Recarregar Interface
            </button>
            
            <div className="mt-8 pt-6 border-t border-stone-100">
              <p className="text-xs text-stone-400">
                Se o problema persistir, verifique sua conexão ou entre em contato com o suporte.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
