import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-surface-0">
          <div className="animate-scale-pop text-center max-w-md p-8">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4m0 4h.01M12 2L2 20h20L12 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-primary mb-2">Algo deu errado</h2>
            <p className="text-sm text-muted mb-6">
              {this.state.error?.message || 'Erro inesperado na aplicação.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRestart}
                className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-surface-2 text-secondary text-sm font-medium hover:bg-surface-3 transition-colors"
              >
                Reiniciar App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
