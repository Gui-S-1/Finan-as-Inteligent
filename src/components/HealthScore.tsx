import type { MonthlySnapshot } from '../types/finance';

type HealthScoreProps = {
  snapshot: MonthlySnapshot;
  monthlyBudget: number;
};

/**
 * Calculates a 0–1000 financial health score based on:
 * - Income vs Expense ratio (0–300)
 * - Budget adherence (0–300)
 * - Bill payment timeliness (0–200)
 * - Savings rate (0–200)
 */
function calcScore(s: MonthlySnapshot, budget: number): number {
  let score = 0;

  // 1. Income vs Expense Ratio (better if income > expenses) — 0 to 300
  if (s.incomesTotal > 0) {
    const ratio = Math.min(s.incomesTotal / Math.max(s.expensesTotal + s.billsToPay, 1), 3);
    score += Math.round((ratio / 3) * 300);
  }

  // 2. Budget adherence — 0 to 300
  if (budget > 0) {
    const used = s.budgetUsagePercent;
    if (used <= 70) score += 300;
    else if (used <= 90) score += 220;
    else if (used <= 100) score += 120;
    else score += Math.max(0, 60 - (used - 100));
  } else {
    score += 150; // neutral if no budget set
  }

  // 3. Bill timeliness — 0 to 200
  const totalBills = s.overdueBills.length + s.upcomingBills.length;
  if (totalBills === 0) {
    score += 200;
  } else {
    const onTimeRatio = 1 - s.overdueBills.length / (totalBills + s.overdueBills.length);
    score += Math.round(onTimeRatio * 200);
  }

  // 4. Savings rate — 0 to 200
  if (s.incomesTotal > 0) {
    const savings = s.incomesTotal - s.expensesTotal - s.billsPaidSoFar;
    const rate = Math.max(savings / s.incomesTotal, 0);
    score += Math.round(Math.min(rate, 0.5) * 400); // max at 50% savings rate
  }

  return Math.min(Math.max(score, 0), 1000);
}

function getLabel(score: number): string {
  if (score >= 850) return 'Excelente';
  if (score >= 650) return 'Bom';
  if (score >= 450) return 'Regular';
  if (score >= 250) return 'Atencao';
  return 'Critico';
}

export function HealthScore({ snapshot, monthlyBudget }: HealthScoreProps) {
  const score = calcScore(snapshot, monthlyBudget);
  const label = getLabel(score);
  const pct = score / 1000;
  const circumference = 2 * Math.PI * 54;
  const dashLen = pct * circumference;

  return (
    <div className="glass-card health-card">
      <h2 className="section-title">Saude Financeira</h2>
      <div className="health-body">
        <div className="health-gauge">
          <svg viewBox="0 0 120 120" className="gauge-svg">
            {/* track */}
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            {/* fill arc */}
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={circumference / 4}
              className="gauge-fill"
            />
            <defs>
              <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
              </linearGradient>
            </defs>
            <text x="60" y="54" textAnchor="middle" className="gauge-score">{score}</text>
            <text x="60" y="72" textAnchor="middle" className="gauge-label">{label}</text>
          </svg>
        </div>
        <div className="health-breakdown">
          <div className="hb-row">
            <span>Receita vs Despesa</span>
            <span>{snapshot.incomesTotal > 0 ? (snapshot.incomesTotal / Math.max(snapshot.expensesTotal, 1)).toFixed(1) + 'x' : '--'}</span>
          </div>
          <div className="hb-row">
            <span>Orcamento usado</span>
            <span>{monthlyBudget > 0 ? snapshot.budgetUsagePercent.toFixed(0) + '%' : 'N/A'}</span>
          </div>
          <div className="hb-row">
            <span>Contas em dia</span>
            <span>{snapshot.overdueBills.length === 0 ? 'Todas' : snapshot.overdueBills.length + ' atrasada(s)'}</span>
          </div>
          <div className="hb-row">
            <span>Score</span>
            <span>{score} / 1000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
