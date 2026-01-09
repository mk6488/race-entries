import React from 'react'
import { trace } from '../utils/trace'

type ErrorBoundaryProps = {
  children: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    trace({ type: 'ui:errorBoundary', meta: { message: error.message } })
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV
      return (
        <div style={{ padding: 16, maxWidth: 640, margin: '48px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Something went wrong</h2>
          {isDev && this.state.error ? (
            <pre style={{ textAlign: 'left', background: '#f8f9fa', padding: 12, borderRadius: 8, overflow: 'auto' }}>
              {this.state.error.message}
            </pre>
          ) : null}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={this.handleReset}>Refresh</button>
            {isDev ? (
              <a href="/diagnostics" style={{ alignSelf: 'center' }}>Diagnostics</a>
            ) : null}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
