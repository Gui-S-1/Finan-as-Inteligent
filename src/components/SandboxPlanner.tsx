import { useCallback, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/finance';

// ──────────────────────────────────────────────────────────
// Sandbox Planner — area de testes financeiros
// O usuario insere entradas e saidas hipoteticas e o
// motor inteligente gera o MELHOR PLANO de distribuicao
// ──────────────────────────────────────────────────────────

interface SandboxEntry {
  id: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  date: string;
  flexible?: boolean; // can we move payment date?
}

interface PlanStep {
  date: string;
  source: string;
  received: number;
  allocations: { target: string; amount: number; reason: string }[];
  remaining: number;
  runningFree: number;
}

interface PlanResult {
  steps: PlanStep[];
  totalIncome: number;
  totalExpenses: number;
  finalFree: number;
  warnings: string[];
  advice: string[];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALLOCATION ENGINE — builds the optimal distribution plan
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildPlan(entries: SandboxEntry[]): PlanResult {
  const incomes = entries
    .filter((e) => e.type === 'income')
    .sort((a, b) => a.date.localeCompare(b.date));
  const expenses = entries
    .filter((e) => e.type === 'expense')
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalIncome = incomes.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const warnings: string[] = [];
  const advice: string[] = [];

  if (totalIncome === 0) {
    return { steps: [], totalIncome: 0, totalExpenses, finalFree: 0, warnings: ['Adicione pelo menos uma entrada de renda.'], advice: [] };
  }

  if (totalExpenses > totalIncome) {
    warnings.push(`Suas despesas (${formatCurrency(totalExpenses)}) superam a renda (${formatCurrency(totalIncome)}) em ${formatCurrency(totalExpenses - totalIncome)}. Voce precisara cortar gastos ou buscar renda extra.`);
  }

  // Track remaining to pay per expense
  const expRemaining = new Map<string, number>();
  expenses.forEach((e) => expRemaining.set(e.id, e.amount));

  const steps: PlanStep[] = [];
  let runningFree = 0;

  incomes.forEach((inc) => {
    let budget = inc.amount;
    const allocations: PlanStep['allocations'] = [];

    // 1. First, pay expenses due ON or BEFORE this income date
    //    (already overdue or due now — highest priority)
    const urgentExpenses = expenses.filter(
      (e) => e.date <= inc.date && (expRemaining.get(e.id) ?? 0) > 0,
    );
    urgentExpenses.forEach((exp) => {
      const remaining = expRemaining.get(exp.id) ?? 0;
      if (remaining <= 0 || budget <= 0) return;
      const pay = Math.min(remaining, budget);
      allocations.push({
        target: exp.title,
        amount: pay,
        reason: `Vence ${formatDate(exp.date)} — ${exp.date <= todayStr() ? 'JA VENCEU' : 'vence agora'}`,
      });
      expRemaining.set(exp.id, remaining - pay);
      budget -= pay;
    });

    // 2. Then, pay upcoming expenses sorted by nearest due date
    const upcomingExpenses = expenses.filter(
      (e) => e.date > inc.date && (expRemaining.get(e.id) ?? 0) > 0,
    );
    upcomingExpenses.forEach((exp) => {
      const remaining = expRemaining.get(exp.id) ?? 0;
      if (remaining <= 0 || budget <= 0) return;
      const pay = Math.min(remaining, budget);
      allocations.push({
        target: exp.title,
        amount: pay,
        reason: `Vence ${formatDate(exp.date)} — reservar agora`,
      });
      expRemaining.set(exp.id, remaining - pay);
      budget -= pay;
    });

    // 3. Remaining is free money
    runningFree += budget;

    if (budget > 0) {
      allocations.push({
        target: 'Livre para voce',
        amount: budget,
        reason: 'Sobrando apos cobrir todas as contas',
      });
    }

    steps.push({
      date: inc.date,
      source: inc.title,
      received: inc.amount,
      allocations,
      remaining: budget,
      runningFree,
    });
  });

  // Check if any expense still unpaid
  expenses.forEach((exp) => {
    const rem = expRemaining.get(exp.id) ?? 0;
    if (rem > 0) {
      warnings.push(
        `"${exp.title}" ficara com ${formatCurrency(rem)} sem cobertura. Renegocie a data ou busque renda extra.`,
      );
    }
  });

  // Generate advice
  const finalFree = totalIncome - totalExpenses;
  if (finalFree > 0) {
    const pct = ((finalFree / totalIncome) * 100).toFixed(0);
    advice.push(`Apos pagar tudo, sobram ${formatCurrency(finalFree)} (${pct}% da renda).`);

    if (finalFree >= totalIncome * 0.2) {
      advice.push(`Excelente! Voce consegue guardar mais de 20%. Considere investir parte.`);
    } else if (finalFree >= totalIncome * 0.1) {
      advice.push(`Bom! Voce guarda ~${pct}%. Tente chegar a 20% cortando gastos nao essenciais.`);
    } else {
      advice.push(`Margem apertada de ${pct}%. Qualquer imprevisto pode apertar. Cuidado com gastos extras.`);
    }
  }

  // Specific route advice — when to pay what
  if (steps.length > 1) {
    const biggestExpense = expenses.sort((a, b) => b.amount - a.amount)[0];
    if (biggestExpense) {
      const incomeBeforeDue = incomes.filter((i) => i.date <= biggestExpense.date);
      if (incomeBeforeDue.length > 1) {
        advice.push(
          `Para "${biggestExpense.title}" (${formatCurrency(biggestExpense.amount)}): acumule reservas dos recebimentos anteriores. Nao gaste essas reservas!`,
        );
      }
    }
  }

  // Timing advice
  const firstIncome = incomes[0];
  const firstExpense = expenses[0];
  if (firstExpense && firstIncome && firstExpense.date < firstIncome.date) {
    advice.push(
      `ATENCAO: "${firstExpense.title}" vence em ${formatDate(firstExpense.date)}, ANTES do primeiro recebimento em ${formatDate(firstIncome.date)}. Separe esse valor com antecedencia.`,
    );
  }

  return { steps, totalIncome, totalExpenses, finalFree: Math.max(finalFree, 0), warnings, advice };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function SandboxPlanner() {
  const [entries, setEntries] = useState<SandboxEntry[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<'income' | 'expense'>('income');

  const addEntry = useCallback(() => {
    const amt = parseFloat(amount);
    if (!title.trim() || !amt || amt <= 0 || !date) return;
    setEntries((prev) => [
      ...prev,
      { id: uid(), type, title: title.trim(), amount: amt, date },
    ]);
    setTitle('');
    setAmount('');
  }, [title, amount, date, type]);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => setEntries([]), []);

  const plan = useMemo(() => buildPlan(entries), [entries]);

  const hasEntries = entries.length > 0;
  const hasIncomes = entries.some((e) => e.type === 'income');
  const hasExpenses = entries.some((e) => e.type === 'expense');

  return (
    <div className="glass-card sandbox-card">
      {/* Header */}
      <div className="sandbox-header">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <div>
          <h2 className="section-title">Sandbox Financeiro</h2>
          <p className="sandbox-sub">Area de testes — simule cenarios e veja o melhor plano</p>
        </div>
      </div>

      {/* Input Form */}
      <div className="sandbox-form">
        <div className="sandbox-type-toggle">
          <button
            type="button"
            className={`stb ${type === 'income' ? 'stb-active stb-income' : ''}`}
            onClick={() => setType('income')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
              <path d="M12 19V5m0 0l-5 5m5-5l5 5" />
            </svg>
            Entrada
          </button>
          <button
            type="button"
            className={`stb ${type === 'expense' ? 'stb-active stb-expense' : ''}`}
            onClick={() => setType('expense')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
              <path d="M12 5v14m0 0l5-5m-5 5l-5-5" />
            </svg>
            Saida
          </button>
        </div>

        <div className="sandbox-fields">
          <input
            type="text"
            placeholder="Descricao (ex: Salario, Nubank, Irma...)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          />
          <input
            type="number"
            placeholder="Valor R$"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button type="button" className="btn-primary" onClick={addEntry}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M12 5v14m-7-7h14" />
            </svg>
            Adicionar
          </button>
        </div>
      </div>

      {/* Entries List */}
      {hasEntries && (
        <div className="sandbox-entries">
          <div className="sandbox-entries-head">
            <span className="sandbox-entries-label">Cenario ({entries.length} itens)</span>
            <button type="button" className="btn-ghost btn-xs" onClick={clearAll}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Limpar
            </button>
          </div>
          <div className="sandbox-entry-list">
            {[...entries].sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
              <div key={e.id} className={`sandbox-entry ${e.type === 'income' ? 'se-income' : 'se-expense'}`}>
                <div className="se-icon-wrap">
                  {e.type === 'income' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                      <path d="M12 19V5m0 0l-5 5m5-5l5 5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                      <path d="M12 5v14m0 0l5-5m-5 5l-5-5" />
                    </svg>
                  )}
                </div>
                <div className="se-info">
                  <strong>{e.title}</strong>
                  <span>{formatDate(e.date)}</span>
                </div>
                <span className="se-amount">{e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount)}</span>
                <button type="button" className="se-del" onClick={() => removeEntry(e.id)} title="Remover">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── PLAN RESULT ─── */}
      {hasIncomes && hasExpenses && (
        <div className="sandbox-plan">
          {/* KPI Summary */}
          <div className="sp-kpi-row">
            <div className="sp-kpi">
              <span className="sp-kpi-label">Renda Total</span>
              <span className="sp-kpi-val sp-kpi-pos">{formatCurrency(plan.totalIncome)}</span>
            </div>
            <div className="sp-kpi">
              <span className="sp-kpi-label">Despesas Total</span>
              <span className="sp-kpi-val sp-kpi-neg">{formatCurrency(plan.totalExpenses)}</span>
            </div>
            <div className="sp-kpi">
              <span className="sp-kpi-label">Sobra Final</span>
              <span className={`sp-kpi-val ${plan.finalFree > 0 ? 'sp-kpi-pos' : 'sp-kpi-neg'}`}>
                {formatCurrency(plan.finalFree)}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {plan.warnings.length > 0 && (
            <div className="sp-warnings">
              {plan.warnings.map((w, i) => (
                <div key={i} className="sp-warning">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                    <path d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.71-3L13.71 4a2 2 0 00-3.42 0L3.36 16a2 2 0 001.71 3z" />
                  </svg>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Step-by-step Plan */}
          <div className="sp-section-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="18" height="18">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3>Plano de Acao — Melhor Rota</h3>
          </div>

          <div className="sp-steps">
            {plan.steps.map((step, i) => (
              <div key={i} className="sp-step">
                <div className="sp-step-header">
                  <div className="sp-step-num">{i + 1}</div>
                  <div className="sp-step-meta">
                    <strong>{formatDate(step.date)} — {step.source}</strong>
                    <span>Recebe {formatCurrency(step.received)}</span>
                  </div>
                </div>
                <div className="sp-allocs">
                  {step.allocations.map((alloc, j) => (
                    <div key={j} className={`sp-alloc ${alloc.target === 'Livre para voce' ? 'sp-alloc-free' : ''}`}>
                      <div className="sp-alloc-arrow">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                          <path d="M5 12h14m0 0l-4-4m4 4l-4 4" />
                        </svg>
                      </div>
                      <div className="sp-alloc-info">
                        <strong>{formatCurrency(alloc.amount)}</strong>
                        <span>{alloc.target}</span>
                      </div>
                      <span className="sp-alloc-reason">{alloc.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Allocation Table */}
          <div className="sp-section-head" style={{ marginTop: 16 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="18" height="18">
              <path d="M3 10h18M3 14h18M3 6h18M3 18h18" />
            </svg>
            <h3>Resumo do Plano</h3>
          </div>
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Entrada</th>
                  <th>Destino</th>
                  <th className="sp-tr">Livre Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {plan.steps.map((step, i) => (
                  <tr key={i}>
                    <td className="sp-tm">{formatDate(step.date)}</td>
                    <td>
                      <strong>{formatCurrency(step.received)}</strong>
                      <span className="sp-src">{step.source}</span>
                    </td>
                    <td>
                      {step.allocations
                        .filter((a) => a.target !== 'Livre para voce')
                        .map((a) => `${formatCurrency(a.amount)} p/ ${a.target}`)
                        .join(' + ')}
                      {step.remaining > 0 && (
                        <> + {formatCurrency(step.remaining)} livre</>
                      )}
                    </td>
                    <td className="sp-tr">{formatCurrency(step.runningFree)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Advice from the advisor */}
          {plan.advice.length > 0 && (
            <div className="sp-advice">
              <div className="sp-section-head">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="18" height="18">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3>Consultor diz</h3>
              </div>
              <div className="sp-advice-list">
                {plan.advice.map((a, i) => (
                  <div key={i} className="sp-advice-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state guidance */}
      {!hasEntries && (
        <div className="sandbox-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" width="48" height="48">
            <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <p>Adicione entradas (salarios, freelance) e saidas (contas, dividas) para ver o plano ideal de distribuicao.</p>
          <p className="sandbox-empty-hint">O consultor vai analisar em tempo real e sugerir a melhor rota financeira.</p>
        </div>
      )}

      {hasEntries && !hasExpenses && (
        <div className="sandbox-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" width="36" height="36">
            <path d="M12 5v14m0 0l5-5m-5 5l-5-5" />
          </svg>
          <p>Agora adicione saidas (contas a pagar, dividas) para gerar o plano de alocacao.</p>
        </div>
      )}

      {hasEntries && !hasIncomes && (
        <div className="sandbox-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" width="36" height="36">
            <path d="M12 19V5m0 0l-5 5m5-5l5 5" />
          </svg>
          <p>Adicione entradas (salarios, rendas) para o consultor montar o plano.</p>
        </div>
      )}
    </div>
  );
}
