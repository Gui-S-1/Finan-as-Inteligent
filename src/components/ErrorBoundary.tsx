import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: '#000', color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif',
          padding: 32,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ opacity: 0.6 }}>
            <path d="M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 001.71-3L13.71 4a2 2 0 00-3.42 0L3.36 16a2 2 0 001.71 3z" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Algo deu errado</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
            style={{
              marginTop: 8, padding: '10px 24px', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#fff',
              cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
