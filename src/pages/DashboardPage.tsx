import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MonthlyChart } from '../components/MonthlyChart';
import { CalendarTimeline } from '../components/CalendarTimeline';
import { ReminderBanner } from '../components/ReminderBanner';
import { CalendarIcon, TrashIcon } from '../components/InlineIcons';
import { formatCurrency, getMonthLabel } from '../lib/finance';
import type { MonthlySnapshot } from '../types/finance';

/* ── Health score (mirrors HealthScore component logic) ─────── */
function calcHealth(s: MonthlySnapshot, budget: number) {
  let score = 0;
  if (s.incomesTotal > 0) {
    const ratio = Math.min(s.incomesTotal / Math.max(s.expensesTotal + s.billsToPay, 1), 3);
    score += Math.round((ratio / 3) * 300);
  }
  if (budget > 0) {
    const u = s.budgetUsagePercent;
    if (u <= 70) score += 300;
    else if (u <= 90) score += 220;
    else if (u <= 100) score += 120;
    else score += Math.max(0, 60 - (u - 100));
  } else score += 150;
  const tot = s.overdueBills.length + s.upcomingBills.length;
  if (tot === 0) score += 200;
  else score += Math.round((1 - s.overdueBills.length / (tot + s.overdueBills.length)) * 200);
  if (s.incomesTotal > 0) {
    const rate = Math.max((s.incomesTotal - s.expensesTotal - s.billsPaidSoFar) / s.incomesTotal, 0);
    score += Math.round(Math.min(rate, 0.5) * 400);
  }
  score = Math.min(Math.max(score, 0), 1000);
  let label = 'Critico';
  if (score >= 850) label = 'Excelente';
  else if (score >= 650) label = 'Bom';
  else if (score >= 450) label = 'Regular';
  else if (score >= 250) label = 'Atencao';
  return { score, label };
}

/* ── Module definitions ─────────────────────────────────────── */
const modulesDef = [
  { to: '/contas', label: 'Contas', d: 'M6 2h12a1 1 0 0 1 1 1v18l-3-2-3 2-3-2-3 2V3a1 1 0 0 1 1-1zM9 7h6M9 11h6M9 15h3' },
  { to: '/lancamentos', label: 'Lancamentos', d: 'M7 4v16m0 0l-3-3m3 3l3-3M17 20V4m0 0l3 3m-3-3l-3 3' },
  { to: '/consultor', label: 'Consultor IA', d: 'M9 21h6M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3z' },
  { to: '/sandbox', label: 'Sandbox', d: 'M9 3h6M10 3v6l-5 8a1 1 0 0 0 .85 1.5h12.3a1 1 0 0 0 .85-1.5L14 9V3' },
  { to: '/fluxo', label: 'Fluxo & Renda', poly: '4 16 8 12 12 14 20 6', poly2: '15 6 20 6 20 11' },
  { to: '/metas', label: 'Metas', circles: true },
];

export function DashboardPage() {
  const ctx = useApp();
  const { state, monthKey, setMonthKey, snapshot, confirmDelete, setConfirmDelete, handleDeleteAll, exportData } = ctx;

  const { score, label } = calcHealth(snapshot, state.monthlyBudget);
  const pct = score / 1000;
  const C = 2 * Math.PI * 54;
  const dash = pct * C;

  const pendingBills = state.bills.filter((b) => b.status !== 'paid').length;
  const activeIncomes = state.recurringIncomes.filter((r) => r.active).length;
  const activeGoals = state.savingsGoals.length;

  const subLabels: Record<string, string> = {
    '/contas': `${pendingBills} pendente${pendingBills !== 1 ? 's' : ''}`,
    '/lancamentos': `${ctx.monthTransactions.length} no mes`,
    '/consultor': 'Analise inteligente',
    '/sandbox': 'Simular cenarios',
    '/fluxo': `${activeIncomes} fonte${activeIncomes !== 1 ? 's' : ''} ativa${activeIncomes !== 1 ? 's' : ''}`,
    '/metas': `${activeGoals} meta${activeGoals !== 1 ? 's' : ''}`,
  };

  return (
    <div className="dashboard">
      {/* ── Top bar ────────────────────────────────── */}
      <header className="dash-topbar glass-layer">
        <div>
          <h1 className="headline">NeuroLedger</h1>
          <p className="subline">Command Center — {getMonthLabel(monthKey)}</p>
        </div>
        <div className="topbar-actions">
          <button className="btn-ghost" type="button" onClick={exportData}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            Export
          </button>
          {confirmDelete ? (
            <div className="confirm-row">
              <span className="confirm-text">Apagar tudo?</span>
              <button className="btn-danger" type="button" onClick={handleDeleteAll}>Sim</button>
              <button className="btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>Nao</button>
            </div>
          ) : (
            <button className="btn-ghost btn-ghost-danger" type="button" onClick={() => setConfirmDelete(true)}>
              <TrashIcon className="icon icon-sm" /> Apagar
            </button>
          )}
          <label className="month-picker">
            <CalendarIcon className="icon" />
            <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
          </label>
        </div>
      </header>

      {/* ── Reminder strip ─────────────────────────── */}
      <ReminderBanner overdueBills={snapshot.overdueBills} upcomingBills={snapshot.upcomingBills} />

      {/* ── Hero — Health ring + KPIs ──────────────── */}
      <section className="dash-hero glass-layer">
        <div className="dash-hero-side">
          <div className="dash-pod">
            <span className="dash-pod-label">Entradas</span>
            <span className="dash-pod-value accent">{formatCurrency(snapshot.incomesTotal)}</span>
          </div>
          <div className="dash-pod">
            <span className="dash-pod-label">Saidas</span>
            <span className="dash-pod-value">{formatCurrency(snapshot.expensesTotal)}</span>
          </div>
        </div>

        <div className="dash-ring-wrap">
          <svg viewBox="0 0 120 120" className="dash-ring-svg">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="url(#dGrad)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={C / 4}
              className="gauge-fill"
            />
            <defs>
              <linearGradient id="dGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
              </linearGradient>
            </defs>
            <text x="60" y="54" textAnchor="middle" className="gauge-score">{score}</text>
            <text x="60" y="72" textAnchor="middle" className="gauge-label">{label}</text>
          </svg>
          <span className="dash-ring-caption">Saude Financeira</span>
        </div>

        <div className="dash-hero-side">
          <div className="dash-pod">
            <span className="dash-pod-label">Saldo Projetado</span>
            <span className="dash-pod-value">{formatCurrency(snapshot.projectedBalance)}</span>
          </div>
          <div className="dash-pod">
            <span className="dash-pod-label">Ja Pago</span>
            <span className="dash-pod-value">{formatCurrency(snapshot.billsPaidSoFar)}</span>
          </div>
        </div>
      </section>

      {/* ── Charts row ─────────────────────────────── */}
      <section className="dash-charts">
        <MonthlyChart
          incomes={snapshot.incomesTotal + snapshot.billsToReceive}
          expenses={snapshot.expensesTotal + snapshot.billsToPay}
          series={snapshot.dailyBalanceSeries}
        />
        <CalendarTimeline monthKey={monthKey} bills={state.bills} transactions={state.transactions} />
      </section>

      {/* ── Module navigation cards ────────────────── */}
      <section className="dash-modules">
        <h2 className="dash-section-title">Modulos</h2>
        <div className="module-grid">
          {modulesDef.map((m) => (
            <Link key={m.to} to={m.to} className="module-card glass-layer">
              <div className="module-icon-wrap">
                <svg className="module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  {m.d && <path d={m.d} />}
                  {m.poly && <><polyline points={m.poly} /><polyline points={m.poly2} /></>}
                  {m.circles && <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /></>}
                </svg>
              </div>
              <div className="module-info">
                <strong>{m.label}</strong>
                <span>{subLabels[m.to]}</span>
              </div>
              <svg className="module-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="app-footer">
        <span>NeuroLedger — Dados salvos localmente + Supabase</span>
      </footer>
    </div>
  );
}
