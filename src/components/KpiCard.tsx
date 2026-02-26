import type { ReactNode } from 'react';
import { GlassCard } from './GlassCard';
import { Sparkline } from './Sparkline';

type KpiCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  series: number[];
};

export function KpiCard({ label, value, icon, series }: KpiCardProps) {
  return (
    <GlassCard className="kpi-card">
      <div className="kpi-top-glow" />
      <div className="kpi-head">
        <div className="kpi-icon-wrap">{icon}</div>
        <span className="kpi-label">{label}</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      <Sparkline values={series.length ? series : [0, 1, 0.5, 0.9]} />
    </GlassCard>
  );
}
