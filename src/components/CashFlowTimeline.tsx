import { formatCurrency, billRemaining, getDaysInMonth } from '../lib/finance';
import type { Bill, RecurringIncome, Transaction } from '../types/finance';

type Props = {
  monthKey: string;
  transactions: Transaction[];
  bills: Bill[];
  recurringIncomes: RecurringIncome[];
};

interface DayFlow {
  day: number;
  inflow: number;
  outflow: number;
  balance: number;
  labels: string[];
}

function buildCashFlow(monthKey: string, transactions: Transaction[], bills: Bill[], incomes: RecurringIncome[]): DayFlow[] {
  const totalDays = getDaysInMonth(monthKey);
  const dayMap = new Map<number, { inflow: number; outflow: number; labels: string[] }>();

  for (let d = 1; d <= totalDays; d++) {
    dayMap.set(d, { inflow: 0, outflow: 0, labels: [] });
  }

  // Recurring incomes (salary days)
  incomes.filter((r) => r.active).forEach((r) => {
    const day = Math.min(r.payDay, totalDays);
    const entry = dayMap.get(day)!;
    entry.inflow += r.amount;
    entry.labels.push(`${r.title}: +${formatCurrency(r.amount)}`);
  });

  // Transactions
  transactions
    .filter((t) => t.date.startsWith(monthKey))
    .forEach((t) => {
      const day = new Date(t.date + 'T00:00:00').getDate();
      const entry = dayMap.get(day);
      if (!entry) return;
      if (t.type === 'income') {
        entry.inflow += t.amount;
        entry.labels.push(`${t.title}: +${formatCurrency(t.amount)}`);
      } else {
        entry.outflow += t.amount;
        entry.labels.push(`${t.title}: -${formatCurrency(t.amount)}`);
      }
    });

  // Bills
  bills
    .filter((b) => b.dueDate.startsWith(monthKey) && b.status !== 'paid')
    .forEach((b) => {
      const day = new Date(b.dueDate + 'T00:00:00').getDate();
      const entry = dayMap.get(day);
      if (!entry) return;
      const remaining = billRemaining(b);
      if (b.type === 'pay') {
        entry.outflow += remaining;
        entry.labels.push(`${b.title}: -${formatCurrency(remaining)}`);
      } else {
        entry.inflow += remaining;
        entry.labels.push(`${b.title}: +${formatCurrency(remaining)}`);
      }
    });

  let running = 0;
  const result: DayFlow[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const { inflow, outflow, labels } = dayMap.get(d)!;
    running += inflow - outflow;
    result.push({ day: d, inflow, outflow, balance: running, labels });
  }
  return result;
}

export function CashFlowTimeline({ monthKey, transactions, bills, recurringIncomes }: Props) {
  const flows = buildCashFlow(monthKey, transactions, bills, recurringIncomes);
  const maxVal = Math.max(...flows.map((f) => Math.max(f.inflow, f.outflow, Math.abs(f.balance))), 1);
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayDay = currentMonth === monthKey ? today.getDate() : -1;

  // Only show days that have activity + surrounding context
  const activeDays = flows.filter((f) => f.inflow > 0 || f.outflow > 0);

  if (activeDays.length === 0) {
    return (
      <div className="glass-card cashflow-card">
        <h2 className="section-title">Fluxo de Caixa Diario</h2>
        <p className="empty-text">Cadastre salario e contas para ver o fluxo dia a dia.</p>
      </div>
    );
  }

  return (
    <div className="glass-card cashflow-card">
      <h2 className="section-title">Fluxo de Caixa Diario</h2>

      {/* Mini chart */}
      <div className="cf-chart">
        <svg viewBox={`0 0 ${flows.length * 18} 80`} className="cf-svg" preserveAspectRatio="none">
          {/* Balance line */}
          <polyline
            points={flows.map((f, i) => `${i * 18 + 9},${80 - (((f.balance + maxVal) / (maxVal * 2)) * 70 + 5)}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Zero line */}
          <line x1="0" y1={80 - (((0 + maxVal) / (maxVal * 2)) * 70 + 5)} x2={flows.length * 18} y2={80 - (((0 + maxVal) / (maxVal * 2)) * 70 + 5)} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="3" />
          {/* Bars */}
          {flows.map((f, i) => {
            const x = i * 18 + 3;
            const zeroY = 80 - (((0 + maxVal) / (maxVal * 2)) * 70 + 5);
            if (f.inflow > 0) {
              const h = (f.inflow / maxVal) * 30;
              return <rect key={`in-${i}`} x={x} y={zeroY - h} width="5" height={h} rx="1" fill="rgba(255,255,255,0.7)" />;
            }
            if (f.outflow > 0) {
              const h = (f.outflow / maxVal) * 30;
              return <rect key={`out-${i}`} x={x + 6} y={zeroY} width="5" height={h} rx="1" fill="rgba(255,255,255,0.25)" />;
            }
            return null;
          })}
        </svg>
      </div>

      {/* Day-by-day list (only active days) */}
      <div className="cf-list">
        {activeDays.map((f) => (
          <div key={f.day} className={`cf-day-row ${f.day === todayDay ? 'cf-today' : ''}`}>
            <div className="cf-day-num">
              <span>{String(f.day).padStart(2, '0')}</span>
            </div>
            <div className="cf-day-flows">
              {f.inflow > 0 && <span className="cf-in">+{formatCurrency(f.inflow)}</span>}
              {f.outflow > 0 && <span className="cf-out">-{formatCurrency(f.outflow)}</span>}
              <div className="cf-labels">
                {f.labels.map((l, i) => <span key={i}>{l}</span>)}
              </div>
            </div>
            <div className="cf-day-balance">
              <span className={f.balance < 0 ? 'cf-negative' : ''}>{formatCurrency(f.balance)}</span>
              <span className="cf-bal-label">saldo</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
