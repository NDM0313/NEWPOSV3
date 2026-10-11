import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors during boot so the WebView never stays blank after splash hide. */
export class BootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ERP Mobile] boot error:', error, info.componentStack);
  }

  private handleContinue = (): void => {
    this.setState({ error: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex flex-col items-center justify-center p-6">
          <h1 className="text-lg font-semibold text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-[#9CA3AF] text-center max-w-sm mb-6">
            The app could not finish loading. You can continue to the login screen or reload.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={this.handleContinue}
              className="h-11 rounded-xl bg-[#3B82F6] text-white font-medium"
            >
              Continue to login
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="h-11 rounded-xl bg-[#374151] text-white font-medium"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
