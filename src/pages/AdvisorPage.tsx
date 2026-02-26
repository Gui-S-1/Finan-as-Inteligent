import { useApp } from '../context/AppContext';
import { PageShell } from '../components/PageShell';
import { SmartAdvisor } from '../components/SmartAdvisor';
import { HealthScore } from '../components/HealthScore';
import { QuickInsights } from '../components/QuickInsights';

export function AdvisorPage() {
  const { state, snapshot, monthKey, setBudget } = useApp();

  return (
    <PageShell title="Consultor IA" subtitle="Analise inteligente e dicas personalizadas">
      <section className="insights-row">
        <HealthScore snapshot={snapshot} monthlyBudget={state.monthlyBudget} />
        <QuickInsights snapshot={snapshot} monthlyBudget={state.monthlyBudget} onBudgetChange={setBudget} />
      </section>
      <SmartAdvisor state={state} snapshot={snapshot} monthKey={monthKey} />
    </PageShell>
  );
}
