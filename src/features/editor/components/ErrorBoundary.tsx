'use client';

import React from 'react';
import { Button } from '@/core/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

export class CollectionErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Collection Error Boundary caught an error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.retry} />;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 border border-destructive/20 rounded-lg bg-destructive/5">
          <AlertTriangle className="h-8 w-8 text-destructive mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">
            Collection Error
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred while loading the collection.'}
          </p>
          <div className="flex gap-2">
            <Button onClick={this.retry} variant="outline" size="sm">
              Try Again
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="destructive" 
              size="sm"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function CollectionErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  return (
    <div className="p-4 text-center border border-destructive/20 rounded-md bg-destructive/5">
      <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
      <p className="text-sm text-destructive font-medium mb-2">
        Collection Loading Error
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        {error?.message || 'Failed to load collection data'}
      </p>
      <Button onClick={retry} size="sm" variant="outline" className="text-xs">
        Retry
      </Button>
    </div>
  );
}