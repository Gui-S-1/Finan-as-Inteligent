import { useApp } from '../context/AppContext';
import { PageShell } from '../components/PageShell';
import { CashFlowTimeline } from '../components/CashFlowTimeline';
import { RecurringIncomePanel } from '../components/RecurringIncomePanel';

export function CashFlowPage() {
  const { state, monthKey, addRecurringIncome, deleteRecurringIncome, toggleRecurringIncome } = useApp();

  return (
    <PageShell title="Fluxo & Renda" subtitle="Fluxo de caixa e fontes de renda recorrente">
      <CashFlowTimeline
        monthKey={monthKey}
        transactions={state.transactions}
        bills={state.bills}
        recurringIncomes={state.recurringIncomes}
      />
      <RecurringIncomePanel
        incomes={state.recurringIncomes}
        onAdd={addRecurringIncome}
        onDelete={deleteRecurringIncome}
        onToggle={toggleRecurringIncome}
      />
    </PageShell>
  );
}
