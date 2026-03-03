import React from 'react';

interface SlateErrorBoundaryProps {
  moduleName: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface SlateErrorBoundaryState {
  hasError: boolean;
}

export class SlateErrorBoundary extends React.Component<SlateErrorBoundaryProps, SlateErrorBoundaryState> {
  state: SlateErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): SlateErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    window.dispatchEvent(
      new CustomEvent('system:reinit', {
        detail: {
          moduleName: this.props.moduleName,
          error: error.message,
          timestamp: Date.now(),
        },
      }),
    );
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
