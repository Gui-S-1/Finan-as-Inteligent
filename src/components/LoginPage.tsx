import { useState, useRef, useEffect } from 'react';
import type { UserAccount } from '../types/user';

interface LoginPageProps {
  onLogin: (user: UserAccount) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      triggerShake();
      return;
    }

    // Dynamic import to avoid circular deps
    const { login } = await import('../lib/auth');
    const user = login(username.trim(), password);
    if (!user) {
      setError('Credenciais invalidas');
      triggerShake();
      return;
    }
    onLogin(user);
  };

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  return (
    <div className="login-screen">
      {/* Background effects */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="login-grid-bg" />
      </div>

      <div className={`login-container ${show ? 'login-visible' : ''}`}>
        {/* Logo & Branding */}
        <div className="login-brand">
          <div className="login-logo-wrap">
            <img
              src="/icarus.jpg"
              alt="Icarus"
              className="login-logo"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 className="login-title">NeuroLedger</h1>
          <p className="login-subtitle">Inteligencia financeira aplicada a sua vida.</p>
          <div className="login-brand-line" />
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className={`login-form ${shake ? 'login-shake' : ''}`}>
          <div className="login-field">
            <label className="login-label" htmlFor="login-user">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="login-icon">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Usuario
            </label>
            <input
              ref={inputRef}
              id="login-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Seu usuario"
              autoComplete="username"
              className="login-input"
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-pass">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="login-icon">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Senha
            </label>
            <input
              id="login-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
              className="login-input"
            />
          </div>

          {error && (
            <div className="login-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                <path d="M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 001.71-3L13.71 4a2 2 0 00-3.42 0L3.36 16a2 2 0 001.71 3z" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="login-btn">
            <span>Entrar</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="login-btn-arrow">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        <div className="login-footer">
          <span className="login-footer-text">by Icarus</span>
        </div>
      </div>
    </div>
  );
}
