import { Component, type ReactNode } from "react";

type Recovery = { retries: number; reset: () => void };

type RenderErrorBoundaryProps = {
  children: ReactNode;
  fallback: (recovery: Recovery) => ReactNode;
  resetKeys: readonly unknown[];
  onReset?: () => void;
};

type RenderErrorBoundaryState = { failed: boolean; retries: number; resetKeys: readonly unknown[] };

const keysChanged = (next: readonly unknown[], previous: readonly unknown[]) =>
  next.length !== previous.length || next.some((key, index) => !Object.is(key, previous[index]));

export class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = { failed: false, retries: 0, resetKeys: this.props.resetKeys };

  static getDerivedStateFromProps(props: RenderErrorBoundaryProps, state: RenderErrorBoundaryState) {
    return keysChanged(props.resetKeys, state.resetKeys) ? { failed: false, retries: 0, resetKeys: props.resetKeys } : null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate() {
    if (!this.state.failed && this.state.retries > 0) this.setState({ retries: 0 });
  }

  reset = () => {
    this.props.onReset?.();
    this.setState((state) => ({ failed: false, retries: state.retries + 1 }));
  };

  render() {
    return this.state.failed ? this.props.fallback({ retries: this.state.retries, reset: this.reset }) : this.props.children;
  }
}
