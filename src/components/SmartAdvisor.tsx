import { formatCurrency, billRemaining, daysUntil } from '../lib/finance';
import type { AppState, MonthlySnapshot } from '../types/finance';
import { CATEGORY_LABELS } from '../types/finance';

type Props = {
  state: AppState;
  snapshot: MonthlySnapshot;
  monthKey: string;
};

interface Tip {
  icon: string;       // SVG path
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
}

function buildTips(state: AppState, snap: MonthlySnapshot, monthKey: string): Tip[] {
  const tips: Tip[] = [];
  const incomes = state.recurringIncomes.filter((r) => r.active);
  const totalSalary = incomes.reduce((s, r) => s + r.amount, 0);
  const pendingBills = state.bills.filter((b) => b.status !== 'paid' && b.dueDate.startsWith(monthKey));
  const totalPending = pendingBills.reduce((s, b) => s + billRemaining(b), 0);

  // ─── Salary day strategy ────────────────────────
  if (incomes.length > 0) {
    const payDays = incomes.map((r) => r.payDay).sort((a, b) => a - b);
    const billsDueBefore = pendingBills.filter((b) => {
      const day = new Date(b.dueDate + 'T00:00:00').getDate();
      return day < payDays[0];
    });
    if (billsDueBefore.length > 0) {
      tips.push({
        icon: 'M12 2v10l4.5 2.5',
        title: `${billsDueBefore.length} conta(s) vencem ANTES do salario`,
        body: `Seu salario cai no dia ${payDays[0]}, mas ${billsDueBefore.map((b) => b.title).join(', ')} vence(m) antes. Reserve ${formatCurrency(billsDueBefore.reduce((s, b) => s + billRemaining(b), 0))} do mes anterior.`,
        priority: 'high',
      });
    }

    // Suggest best payment days
    const afterPayDay = pendingBills.filter((b) => {
      const day = new Date(b.dueDate + 'T00:00:00').getDate();
      return day >= payDays[0];
    });
    if (afterPayDay.length > 0) {
      tips.push({
        icon: 'M9 12l2 2 4-4',
        title: 'Pague estas contas logo apos o salario',
        body: `No dia ${payDays[0]} voce recebe ${formatCurrency(totalSalary)}. Pague primeiro: ${afterPayDay.slice(0, 3).map((b) => `${b.title} (${formatCurrency(billRemaining(b))})`).join(', ')}.`,
        priority: 'medium',
      });
    }
  }

  // ─── Budget analysis ────────────────────────────
  if (state.monthlyBudget > 0) {
    const used = snap.budgetUsagePercent;
    const today = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const idealPct = (dayOfMonth / daysInMonth) * 100;

    if (used > idealPct + 15) {
      tips.push({
        icon: 'M13 16h-1v-4h-1m2-4h.01',
        title: 'Voce esta gastando rapido demais!',
        body: `Ja usou ${used.toFixed(0)}% do orcamento, mas so passaram ${idealPct.toFixed(0)}% do mes. Reduza gastos em ${formatCurrency(((used - idealPct) / 100) * state.monthlyBudget)} para voltar ao ritmo.`,
        priority: 'high',
      });
    } else if (used < idealPct - 10) {
      tips.push({
        icon: 'M5 13l4 4L19 7',
        title: 'Otimo controle de gastos!',
        body: `Voce usou ${used.toFixed(0)}% do orcamento com ${idealPct.toFixed(0)}% do mes ja passado. Voce tem ${formatCurrency(state.monthlyBudget * (1 - used / 100))} disponivel.`,
        priority: 'low',
      });
    }
  }

  // ─── Savings potential ──────────────────────────
  if (totalSalary > 0) {
    const expenses = snap.expensesTotal + totalPending;
    const leftover = totalSalary - expenses;
    const savingsPct = (leftover / totalSalary) * 100;

    if (leftover > 0) {
      tips.push({
        icon: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z',
        title: `Potencial de economia: ${formatCurrency(leftover)}`,
        body: `Com salario de ${formatCurrency(totalSalary)} e gastos de ${formatCurrency(expenses)}, voce pode guardar ${savingsPct.toFixed(0)}% da renda. A regra 50/30/20 sugere guardar pelo menos 20%.`,
        priority: savingsPct >= 20 ? 'low' : 'medium',
      });
    } else {
      tips.push({
        icon: 'M18.364 5.636a9 9 0 11-12.728 0',
        title: 'Gastos excedem a renda!',
        body: `Seus gastos (${formatCurrency(expenses)}) superam o salario (${formatCurrency(totalSalary)}) em ${formatCurrency(Math.abs(leftover))}. Revise as categorias mais caras.`,
        priority: 'high',
      });
    }
  }

  // ─── Category-specific advice ───────────────────
  if (snap.categoryBreakdown.length > 0 && totalSalary > 0) {
    const top = snap.categoryBreakdown[0];
    const pct = ((top.total / totalSalary) * 100).toFixed(0);
    tips.push({
      icon: 'M4 6h16M4 12h10M4 18h16',
      title: `Maior gasto: ${CATEGORY_LABELS[top.category]} (${pct}% da renda)`,
      body: top.total > totalSalary * 0.3
        ? `${CATEGORY_LABELS[top.category]} consome ${pct}% do seu salario. Tente reduzir para abaixo de 30% buscando alternativas ou negociando valores.`
        : `${CATEGORY_LABELS[top.category]} esta dentro de um nivel saudavel. Continue monitorando.`,
      priority: top.total > totalSalary * 0.3 ? 'medium' : 'low',
    });
  }

  // ─── Overdue urgency ───────────────────────────
  if (snap.overdueBills.length > 0) {
    const total = snap.overdueBills.reduce((s, b) => s + billRemaining(b), 0);
    tips.push({
      icon: 'M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.71-3L13.71 4a2 2 0 00-3.42 0L3.36 16a2 2 0 001.71 3z',
      title: `URGENTE: ${formatCurrency(total)} em atraso`,
      body: `Pague ${snap.overdueBills.map((b) => b.title).join(', ')} o mais rapido possivel para evitar juros e multas.`,
      priority: 'high',
    });
  }

  // ─── Emergency fund tip ─────────────────────────
  if (totalSalary > 0 && state.savingsGoals.length === 0) {
    tips.push({
      icon: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z',
      title: 'Crie uma meta de reserva de emergencia',
      body: `Especialistas recomendam guardar ${formatCurrency(totalSalary * 6)} (6 meses de renda). Comece definindo uma meta abaixo.`,
      priority: 'low',
    });
  }

  // ─── Upcoming big expenses ──────────────────────
  const upcoming = pendingBills
    .filter((b) => daysUntil(b.dueDate) > 0 && daysUntil(b.dueDate) <= 7)
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate));
  if (upcoming.length > 0) {
    tips.push({
      icon: 'M8 7V3m8 4V3m-4 18v-4m0 0l-3 3m3-3l3 3',
      title: `${upcoming.length} conta(s) nos proximos 7 dias`,
      body: upcoming.map((b) => `${b.title}: ${formatCurrency(billRemaining(b))} em ${daysUntil(b.dueDate)}d`).join(' | '),
      priority: 'medium',
    });
  }

  // Sort by priority
  const order = { high: 0, medium: 1, low: 2 };
  return tips.sort((a, b) => order[a.priority] - order[b.priority]);
}

const priorityClass: Record<string, string> = {
  high: 'tip-high',
  medium: 'tip-medium',
  low: 'tip-low',
};

export function SmartAdvisor({ state, snapshot, monthKey }: Props) {
  const tips = buildTips(state, snapshot, monthKey);

  if (tips.length === 0) {
    return (
      <div className="glass-card advisor-card">
        <h2 className="section-title">Consultor Financeiro</h2>
        <p className="empty-text">Adicione seu salario e contas para receber dicas personalizadas.</p>
      </div>
    );
  }

  return (
    <div className="glass-card advisor-card">
      <div className="advisor-header">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h2 className="section-title">Consultor Financeiro ({tips.length} dicas)</h2>
      </div>
      <div className="advisor-tips">
        {tips.map((tip, i) => (
          <div key={i} className={`tip-card ${priorityClass[tip.priority]}`}>
            <div className="tip-icon-wrap">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d={tip.icon} />
              </svg>
            </div>
            <div className="tip-body">
              <strong>{tip.title}</strong>
              <p>{tip.body}</p>
            </div>
            <span className={`tip-badge tip-badge-${tip.priority}`}>
              {tip.priority === 'high' ? 'Urgente' : tip.priority === 'medium' ? 'Atencao' : 'Dica'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
