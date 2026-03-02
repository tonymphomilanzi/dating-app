// src/components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(error) { return { err: error }; }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] componentDidCatch", { error: error?.stack || error, info });
  }
  render() {
    if (this.state.err) {
      return (
        <div className="grid min-h-dvh place-items-center p-6 text-center">
          <div>
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-red-500/10" />
            <div className="font-semibold text-red-600">Something broke rendering this page.</div>
            <div className="mt-2 text-sm text-gray-600">Check console for details.</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}