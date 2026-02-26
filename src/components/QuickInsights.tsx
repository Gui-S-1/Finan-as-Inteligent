import type { MonthlySnapshot } from '../types/finance';
import { CATEGORY_LABELS } from '../types/finance';
import { formatCurrency, daysUntil } from '../lib/finance';
import { AlertIcon, ClockIcon, TargetIcon } from './InlineIcons';
import { GlassCard } from './GlassCard';

type QuickInsightsProps = {
  snapshot: MonthlySnapshot;
  monthlyBudget: number;
  onBudgetChange: (v: number) => void;
};

export function QuickInsights({ snapshot, monthlyBudget, onBudgetChange }: QuickInsightsProps) {
  const nextBill = snapshot.upcomingBills[0];
  const overdue = snapshot.overdueBills.length;

  return (
    <GlassCard className="insights-card">
      <h2 className="section-title">Painel Inteligente</h2>

      <div className="insight-grid">
        {/* Overdue alert */}
        <div className={`insight-item${overdue > 0 ? ' insight-warn' : ''}`}>
          <AlertIcon className="icon" />
          <div>
            <span className="insight-label">Contas atrasadas</span>
            <strong className="insight-value">{overdue}</strong>
          </div>
        </div>

        {/* Next due */}
        <div className="insight-item">
          <ClockIcon className="icon" />
          <div>
            <span className="insight-label">Proxima conta</span>
            <strong className="insight-value">
              {nextBill ? `${nextBill.title} em ${daysUntil(nextBill.dueDate)}d` : 'Nenhuma'}
            </strong>
          </div>
        </div>

        {/* Budget target */}
        <div className="insight-item insight-budget">
          <TargetIcon className="icon" />
          <div>
            <span className="insight-label">Meta mensal</span>
            <div className="budget-input-row">
              <span>R$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={monthlyBudget || ''}
                onChange={(e) => onBudgetChange(Number(e.target.value))}
                placeholder="Definir meta"
                className="budget-input"
              />
            </div>
          </div>
        </div>

        {/* Budget usage */}
        {monthlyBudget > 0 && (
          <div className="insight-item">
            <div className="budget-ring-wrap">
              <svg viewBox="0 0 40 40" className="budget-ring">
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                <circle
                  cx="20" cy="20" r="16" fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${snapshot.budgetUsagePercent} ${100 - snapshot.budgetUsagePercent}`}
                  strokeDashoffset="25"
                  className="budget-ring-fill"
                />
                <text x="20" y="21" textAnchor="middle" dominantBaseline="middle" className="budget-ring-text">
                  {snapshot.budgetUsagePercent.toFixed(0)}%
                </text>
              </svg>
            </div>
            <div>
              <span className="insight-label">Uso do orcamento</span>
              <strong className="insight-value">{formatCurrency(snapshot.expensesTotal + snapshot.billsPaidSoFar)} / {formatCurrency(monthlyBudget)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {snapshot.categoryBreakdown.length > 0 && (
        <div className="cat-breakdown">
          <h3 className="detail-title">Gastos por categoria</h3>
          <div className="cat-bars">
            {snapshot.categoryBreakdown.map(({ category, total }) => {
              const maxCat = snapshot.categoryBreakdown[0].total;
              return (
                <div key={category} className="cat-row">
                  <span className="cat-name">{CATEGORY_LABELS[category]}</span>
                  <div className="cat-track">
                    <div className="cat-fill" style={{ width: `${(total / maxCat) * 100}%` }} />
                  </div>
                  <span className="cat-val">{formatCurrency(total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
