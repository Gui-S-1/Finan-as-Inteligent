import { useApp } from '../context/AppContext';
import { PageShell } from '../components/PageShell';
import { SavingsGoals } from '../components/SavingsGoals';

export function GoalsPage() {
  const { state, addGoal, depositToGoal, deleteGoal } = useApp();

  return (
    <PageShell title="Metas" subtitle="Acompanhe suas metas de economia">
      <SavingsGoals
        goals={state.savingsGoals}
        onAdd={addGoal}
        onUpdate={depositToGoal}
        onDelete={deleteGoal}
      />
    </PageShell>
  );
}
