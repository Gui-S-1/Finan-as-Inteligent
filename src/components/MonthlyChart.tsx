import { GlassCard } from './GlassCard';
import { formatCurrency } from '../lib/finance';

type MonthlyChartProps = {
  incomes: number;
  expenses: number;
  series: number[];
};

function toPoints(values: number[], width: number, height: number): string {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export function MonthlyChart({ incomes, expenses, series }: MonthlyChartProps) {
  const width = 740;
  const height = 220;
  const points = toPoints(series.length ? series : [0], width, height);
  const maxBar = Math.max(incomes, expenses, 1);

  return (
    <GlassCard className="chart-card">
      <div className="chart-header-row">
        <h2 className="section-title">Fluxo Mensal</h2>
        <span className="chart-sub">linhas premium 1px • projeção diária</span>
      </div>

      <div className="chart-wrap">
        <svg className="balance-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.95)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.25)" />
            </linearGradient>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
            </linearGradient>
          </defs>

          {Array.from({ length: 6 }).map((_, index) => {
            const y = (index / 5) * height;
            return <line key={index} x1="0" y1={y} x2={width} y2={y} className="chart-grid-line" />;
          })}

          <polyline points={points} className="chart-line" stroke="url(#chartLine)" />
          <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#chartFill)" />
        </svg>
      </div>

      <div className="bar-compare">
        <div className="bar-item">
          <span className="bar-label">Entradas</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(incomes / maxBar) * 100}%` }} />
          </div>
          <span className="bar-value">{formatCurrency(incomes)}</span>
        </div>
        <div className="bar-item">
          <span className="bar-label">Saídas</span>
          <div className="bar-track">
            <div className="bar-fill soft" style={{ width: `${(expenses / maxBar) * 100}%` }} />
          </div>
          <span className="bar-value">{formatCurrency(expenses)}</span>
        </div>
      </div>
    </GlassCard>
  );
}
