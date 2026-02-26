import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PageShell({ title, subtitle, children }: Props) {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <header className="page-header glass-layer">
        <button className="page-back" onClick={() => navigate('/')} type="button" title="Voltar ao Dashboard">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5m0 0l7-7m-7 7l7 7" />
          </svg>
        </button>
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </header>
      <main className="page-content">
        {children}
      </main>
    </div>
  );
}
