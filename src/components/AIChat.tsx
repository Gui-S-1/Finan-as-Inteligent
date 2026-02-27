import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { chatCompletionStream } from '../lib/openai';
import type { ChatMessage } from '../lib/openai';
import {
  calculateIndices,
  buildFinancialContext,
  SYSTEM_PROMPT,
} from '../lib/aiContext';
import { formatCurrency } from '../lib/finance';

/* ═══════════════════════════════════════════════════════
   NeuroLedger AI Chat — Estrategista Financeiro
   Single floating button → full chat panel
   All features accessible via quick actions + free text
   ═══════════════════════════════════════════════════════ */

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS = [
  {
    label: 'Rotas',
    icon: 'M3 12h4l2-4 3 8 2-4h7',
    prompt:
      'Gere as 4 rotas financeiras para minha situação atual: Sobrevivência, Crescimento, Agressiva e Anti-Dívida. Com valores concretos dos meus dados.',
  },
  {
    label: 'Score',
    icon: 'M4 18V12M9 18V6M14 18V10M19 18V8',
    prompt:
      'Analise meu score de disciplina financeira em detalhes. O que está bom, o que melhorar? Dicas para subir de nível.',
  },
  {
    label: 'Projeção',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    prompt:
      'Projeção de 12 meses baseada no meu padrão atual. Cenário otimista e pessimista com valores concretos.',
  },
  {
    label: 'Cortar',
    icon: 'M3 6h18M6 10h12M9 14h6M11 18h2',
    prompt:
      'Analise meus gastos por categoria e sugira cortes inteligentes que eu quase não vou sentir. Quanto economizo?',
  },
  {
    label: 'Meta',
    icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v4m0 12v4M2 12h4m12 0h4',
    prompt:
      'Baseado na minha renda e gastos, qual deveria ser minha meta de economia ideal? Plano prático.',
  },
  {
    label: 'Erro',
    icon: 'M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 001.71-3L13.71 4a2 2 0 00-3.42 0L3.36 16a2 2 0 001.71 3z',
    prompt:
      'Simule: se eu continuar gastando exatamente como estou por 6 meses, o que acontece? Impacto real com números.',
  },
  {
    label: 'Padrões',
    icon: 'M12 3a6 6 0 00-4 10.5V17h8v-3.5A6 6 0 0012 3zM9 21h6',
    prompt:
      'Analise meus padrões de gasto. Detecte auto-sabotagens financeiras e me confronte com dados concretos.',
  },
  {
    label: 'Análise',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    prompt:
      'Análise completa da minha saúde financeira: pontos fortes, fracos, riscos, oportunidades. Seja direto.',
  },
  {
    label: 'Futuro',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    prompt:
      'Mostre duas versões de mim daqui 3 anos: 1) se continuar como estou 2) se seguir um plano disciplinado. Números reais.',
  },
];

/* ─── Simple markdown → HTML (XSS-hardened) ──────────── */
function fmtMd(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<span class="ai-li">• $1</span>')
    .replace(/^\d+\.\s(.+)$/gm, (match) => `<span class="ai-li">${match}</span>`)
    .replace(/\n/g, '<br>');
}

export function AIChat() {
  const { state, snapshot, monthKey } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const indices = useMemo(
    () => calculateIndices(state, snapshot),
    [state, snapshot],
  );

  // Scroll to bottom on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, streamingContent]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      setStreamingContent('');

      try {
        // Load user profile for AI context
        const username = localStorage.getItem('neuro-current-user');
        let userProfile = null;
        if (username) {
          const { getProfile } = await import('../lib/auth');
          userProfile = getProfile(username);
        }

        const context = buildFinancialContext(
          state,
          snapshot,
          indices,
          monthKey,
          userProfile,
        );

        // Token economy: only last 6 messages of history
        const recentHistory: ChatMessage[] = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const apiMessages: ChatMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `[CONTEXTO FINANCEIRO ATUALIZADO]\n${context}`,
          },
          ...recentHistory,
          { role: 'user', content: text.trim() },
        ];

        const fullResponse = await chatCompletionStream(
          apiMessages,
          (chunk) => {
            setStreamingContent((prev) => prev + chunk);
          },
        );

        const assistantMsg: UIMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fullResponse,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent('');

        // Save AI memory — extract key insight from response for persistent memory
        if (username) {
          try {
            const { addAIMemory } = await import('../lib/auth');
            const date = new Date().toLocaleDateString('pt-BR');
            // Save a summary: user question + first 100 chars of AI response
            const summary = `[${date}] Pergunta: "${text.trim().slice(0, 60)}" | Resposta: ${fullResponse.slice(0, 100)}`;
            addAIMemory(username, summary);
          } catch { /* non-critical */ }
        }
      } catch (err) {
        const errorMsg: UIMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Erro ao conectar com a IA: ${(err as Error).message}`,
        };
        setMessages((prev) => [...prev, errorMsg]);
        setStreamingContent('');
      } finally {
        setLoading(false);
      }
    },
    [state, snapshot, indices, monthKey, messages, loading],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const riskLabel =
    indices.monthProjection === 'safe'
      ? 'Seguro'
      : indices.monthProjection === 'caution'
        ? 'Atenção'
        : 'Risco';

  return (
    <>
      {/* ─── Floating Action Button ──────────────────── */}
      {!open && (
        <button
          className={`ai-fab ${indices.monthProjection === 'risk' ? 'ai-fab-pulse' : ''}`}
          onClick={() => setOpen(true)}
          type="button"
          title="Estrategista Financeiro IA"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="ai-fab-icon"
          >
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {indices.monthProjection !== 'safe' && (
            <span className="ai-fab-badge">
              <svg viewBox="0 0 12 12" width="10" height="10">
                <circle cx="6" cy="6" r={indices.monthProjection === 'risk' ? 5 : 4} fill="currentColor" opacity={indices.monthProjection === 'risk' ? 0.95 : 0.5} />
              </svg>
            </span>
          )}
        </button>
      )}

      {/* ─── Chat Panel ──────────────────────────────── */}
      {open && (
        <div className="ai-panel">
          {/* Header */}
          <div className="ai-header">
            <div className="ai-header-left">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="20"
                height="20"
              >
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div>
                <strong className="ai-title">NeuroLedger AI</strong>
                <span className="ai-subtitle">Estrategista Financeiro</span>
              </div>
            </div>
            <button
              className="ai-close"
              onClick={() => setOpen(false)}
              type="button"
              title="Fechar"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="18"
                height="18"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Status Bar */}
          <div className="ai-status">
            <div className="ai-stat">
              <span className="ai-stat-label">Disciplina</span>
              <span className="ai-stat-value">
                {indices.disciplineScore}
                <small>/1000</small>
              </span>
              <div className="ai-stat-bar">
                <div
                  className="ai-stat-fill"
                  style={{ width: `${indices.disciplineScore / 10}%` }}
                />
              </div>
              <span className="ai-stat-level">
                <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="ai-level-icon">
                  {indices.disciplineLevelNum === 1 && <circle cx="8" cy="8" r="5" />}
                  {indices.disciplineLevelNum === 2 && <><circle cx="8" cy="8" r="5" /><line x1="8" y1="3" x2="8" y2="13" /></>}
                  {indices.disciplineLevelNum === 3 && <circle cx="8" cy="8" r="5" fill="currentColor" />}
                  {indices.disciplineLevelNum === 4 && <path d="M8 2l4 6-4 6-4-6z" fill="currentColor" />}
                  {indices.disciplineLevelNum === 5 && <path d="M8 1l2 5h5l-4 3.5 1.5 5L8 11.5 3.5 14.5 5 9.5 1 6h5z" fill="currentColor" />}
                </svg>
                {indices.disciplineLevel}
              </span>
            </div>
            <div className="ai-stat ai-stat-compact">
              <span className="ai-stat-label">Impulsividade</span>
              <span className="ai-stat-value">{indices.impulsivityIndex}%</span>
            </div>
            <div className="ai-stat ai-stat-compact">
              <span className="ai-stat-label">Risco</span>
              <span
                className="ai-stat-value"
                style={{
                  opacity: indices.riskIndex > 50 ? 1 : 0.7,
                }}
              >
                {indices.riskIndex}%
              </span>
            </div>
            <div className="ai-stat ai-stat-compact">
              <span className="ai-stat-label">Mês</span>
              <span className="ai-stat-value ai-stat-risk">
                <svg viewBox="0 0 12 12" width="8" height="8" className="ai-risk-icon">
                  <circle cx="6" cy="6" r={indices.monthProjection === 'risk' ? 5 : indices.monthProjection === 'caution' ? 4 : 3} fill="currentColor" opacity={indices.monthProjection === 'risk' ? 0.95 : indices.monthProjection === 'caution' ? 0.5 : 0.25} />
                </svg>
                {riskLabel}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="ai-quick-scroll">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                className="ai-quick-btn"
                onClick={() => sendMessage(action.prompt)}
                disabled={loading}
                type="button"
              >
                <svg className="ai-qa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d={action.icon} />
                </svg>
                {action.label}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="ai-messages">
            {messages.length === 0 && !streamingContent && (
              <div className="ai-welcome">
                <div className="ai-welcome-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    width="44"
                    height="44"
                  >
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p className="ai-welcome-title">
                  Seu estrategista financeiro pessoal
                </p>
                <p className="ai-welcome-text">
                  Analiso seus dados em tempo real e gero rotas, projeções e
                  insights. Use os botões acima ou pergunte qualquer coisa.
                </p>
                <div className="ai-welcome-stats">
                  <span>
                    Score: <strong>{indices.disciplineScore}</strong>
                  </span>
                  <span>
                    Projeção:{' '}
                    <strong>
                      {formatCurrency(indices.projectedEndBalance)}
                    </strong>
                  </span>
                  <span>
                    Poupança:{' '}
                    <strong>{indices.savingsRate.toFixed(0)}%</strong>
                  </span>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`ai-msg ai-msg-${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="ai-msg-avatar">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      width="14"
                      height="14"
                    >
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                )}
                <div
                  className="ai-msg-bubble"
                  dangerouslySetInnerHTML={{ __html: fmtMd(msg.content) }}
                />
              </div>
            ))}

            {/* Streaming content */}
            {loading && streamingContent && (
              <div className="ai-msg ai-msg-assistant">
                <div className="ai-msg-avatar">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    width="14"
                    height="14"
                  >
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div
                  className="ai-msg-bubble"
                  dangerouslySetInnerHTML={{ __html: fmtMd(streamingContent) }}
                />
              </div>
            )}

            {/* Typing indicator */}
            {loading && !streamingContent && (
              <div className="ai-msg ai-msg-assistant">
                <div className="ai-msg-avatar">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    width="14"
                    height="14"
                  >
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="ai-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form className="ai-input-area" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre suas finanças..."
              disabled={loading}
              className="ai-input"
            />
            <button
              type="submit"
              className="ai-send"
              disabled={loading || !input.trim()}
              title="Enviar"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width="18"
                height="18"
              >
                <path d="M5 12h14m0 0l-4-4m4 4l-4 4" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
