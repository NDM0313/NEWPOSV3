import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  screenName?: string;
  onBack?: () => void;
}

interface State {
  error: Error | null;
}

/** Catches render errors inside a lazy-loaded module screen. */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ERP Mobile] ${this.props.screenName ?? 'screen'} error:`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex flex-col items-center justify-center p-6">
          <h1 className="text-lg font-semibold text-white mb-2">
            {this.props.screenName ? `${this.props.screenName} could not load` : 'Something went wrong'}
          </h1>
          <p className="text-sm text-[#9CA3AF] text-center max-w-sm mb-6">
            Try going back or reload the app.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {this.props.onBack && (
              <button
                type="button"
                onClick={() => {
                  this.setState({ error: null });
                  this.props.onBack?.();
                }}
                className="px-4 py-3 rounded-xl bg-[#374151] text-white font-medium"
              >
                Go back
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-3 rounded-xl bg-[#3B82F6] text-white font-medium"
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
