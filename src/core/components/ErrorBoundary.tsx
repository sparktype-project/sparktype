// src/components/core/ErrorBoundary.tsx


import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }


  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-destructive/10 border border-destructive rounded-lg">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-destructive-foreground">Something went wrong.</h1>
          <p className="text-muted-foreground mt-2 mb-4">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {this.state.error && (
            <details className="w-full max-w-lg text-left bg-background p-2 rounded border mb-4">
              <summary className="cursor-pointer text-sm font-medium">Error Details</summary>
              <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-all">
                {this.state.error.message}
              </pre>
            </details>
          )}

        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;