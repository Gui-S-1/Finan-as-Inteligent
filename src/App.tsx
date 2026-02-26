import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BillCard } from './components/BillCard';
import { BillForm } from './components/BillForm';
import { CalendarTimeline } from './components/CalendarTimeline';
import { CashFlowTimeline } from './components/CashFlowTimeline';
import { HealthScore } from './components/HealthScore';
import { ArrowDownIcon, ArrowUpIcon, CalendarIcon, PulseIcon, TrashIcon, WalletIcon } from './components/InlineIcons';
import { KpiCard } from './components/KpiCard';
import { MonthlyChart } from './components/MonthlyChart';
import { QuickInsights } from './components/QuickInsights';
import { RecurringIncomePanel } from './components/RecurringIncomePanel';
import { ReminderBanner, requestNotificationPermission, sendBillReminder } from './components/ReminderBanner';
import { SavingsGoals } from './components/SavingsGoals';
import { SmartAdvisor } from './components/SmartAdvisor';
import { TechBackground } from './components/TechBackground';
import { TransactionForm } from './components/TransactionForm';
import { exportCSV } from './lib/exportCSV';
import {
  calculateSnapshot,
  deriveBillStatus,
  formatCurrency,
  formatDate,
  getCurrentMonthKey,
  getMonthLabel,
  isSameMonth,
  sortByDateAsc,
  daysUntil,
} from './lib/finance';
import {
  loadState,
  saveState,
  addTransactionDB,
  deleteTransactionDB,
  addBillDB,
  deleteBillDB,
  updateBillStatusDB,
  addPaymentDB,
  saveBudgetDB,
  deleteAllDataDB,
  deleteAllDataLocal,
} from './lib/storage';
import type { AppState, Bill, Payment, RecurringIncome, SavingsGoal, Transaction } from './types/finance';
import { CATEGORY_LABELS } from './types/finance';

const blankState: AppState = { transactions: [], bills: [], monthlyBudget: 0, recurringIncomes: [], savingsGoals: [] };

export default function App() {
  const [state, setState] = useState<AppState>(blankState);
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const remindedRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ─── Initial load (async for Supabase) ──────────── */
  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      setLoading(false);
    });
  }, []);

  /* ─── Persist on change (after initial load) ──────── */
  useEffect(() => {
    if (!loading) saveState(state);
  }, [state, loading]);

  /* ─── Smart reminders on load ─────────────────────── */
  useEffect(() => {
    if (loading || remindedRef.current) return;
    remindedRef.current = true;
    requestNotificationPermission();
    // Send browser notifications for urgent bills
    state.bills.forEach((b) => {
      const d = daysUntil(b.dueDate);
      if (b.status !== 'paid' && d <= 3) sendBillReminder(b);
    });
  }, [loading, state.bills]);

  const snapshot = useMemo(
    () => calculateSnapshot(state.transactions, state.bills, monthKey, state.monthlyBudget),
    [state.transactions, state.bills, monthKey, state.monthlyBudget],
  );

  const monthTransactions = useMemo(
    () => sortByDateAsc(state.transactions.filter((t) => isSameMonth(t.date, monthKey))),
    [state.transactions, monthKey],
  );

  const monthBills = useMemo(
    () => sortByDateAsc(state.bills.filter((b) => isSameMonth(b.dueDate, monthKey))),
    [state.bills, monthKey],
  );

  // All active (non-paid) bills across all months, sorted by due date
  const allActiveBills = useMemo(
    () => sortByDateAsc(state.bills.filter((b) => b.status !== 'paid')),
    [state.bills],
  );

  /* ─── actions (+ Supabase sync) ────────────────── */

  const addTransaction = useCallback((item: Transaction) => {
    setState((s) => ({ ...s, transactions: [...s.transactions, item] }));
    addTransactionDB(item);
    // Auto-navigate to the transaction's month so user sees it
    const txMonth = item.date.slice(0, 7);
    if (txMonth !== monthKey) setMonthKey(txMonth);
    showToast(`Lancamento "${item.title}" adicionado em ${formatDate(item.date)}!`);
  }, [monthKey, showToast]);

  const deleteTransaction = useCallback((id: string) => {
    setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
    deleteTransactionDB(id);
  }, []);

  const addBill = useCallback((item: Bill) => {
    setState((s) => ({ ...s, bills: [...s.bills, item] }));
    addBillDB(item);
    // Auto-navigate to the bill's month so user sees it immediately
    const billMonth = item.dueDate.slice(0, 7);
    if (billMonth !== monthKey) setMonthKey(billMonth);
    showToast(`Conta "${item.title}" agendada para ${formatDate(item.dueDate)}!`);
  }, [monthKey, showToast]);

  const deleteBill = useCallback((id: string) => {
    setState((s) => ({ ...s, bills: s.bills.filter((b) => b.id !== id) }));
    deleteBillDB(id);
  }, []);

  const addPaymentToBill = useCallback((billId: string, payment: Payment) => {
    setState((s) => ({
      ...s,
      bills: s.bills.map((b) => {
        if (b.id !== billId) return b;
        const updated = { ...b, payments: [...b.payments, payment] };
        updated.status = deriveBillStatus(updated);
        updateBillStatusDB(billId, updated.status);
        return updated;
      }),
    }));
    addPaymentDB(billId, payment);
  }, []);

  const setBudget = useCallback((value: number) => {
    setState((s) => ({ ...s, monthlyBudget: value }));
    saveBudgetDB(value);
  }, []);

  const handleDeleteAll = useCallback(() => {
    setState(blankState);
    deleteAllDataLocal();
    deleteAllDataDB();
    setConfirmDelete(false);
  }, []);

  /* ─── Recurring income actions ─────────────────── */
  const addRecurringIncome = useCallback((income: RecurringIncome) => {
    setState((s) => ({ ...s, recurringIncomes: [...s.recurringIncomes, income] }));
    showToast(`Renda "${income.title}" cadastrada! Dia ${income.payDay} de cada mes.`);
  }, [showToast]);

  const deleteRecurringIncome = useCallback((id: string) => {
    setState((s) => ({ ...s, recurringIncomes: s.recurringIncomes.filter((r) => r.id !== id) }));
  }, []);

  const toggleRecurringIncome = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      recurringIncomes: s.recurringIncomes.map((r) =>
        r.id === id ? { ...r, active: !r.active } : r
      ),
    }));
  }, []);

  /* ─── Savings goals actions ────────────────────── */
  const addGoal = useCallback((goal: SavingsGoal) => {
    setState((s) => ({ ...s, savingsGoals: [...s.savingsGoals, goal] }));
    showToast(`Meta "${goal.title}" criada!`);
  }, [showToast]);

  const depositToGoal = useCallback((id: string, amount: number) => {
    setState((s) => ({
      ...s,
      savingsGoals: s.savingsGoals.map((g) =>
        g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g
      ),
    }));
    showToast(`Deposito de ${formatCurrency(amount)} realizado!`);
  }, [showToast]);

  const deleteGoal = useCallback((id: string) => {
    setState((s) => ({ ...s, savingsGoals: s.savingsGoals.filter((g) => g.id !== id) }));
  }, []);

  if (loading) {
    return (
      <div className="app-shell">
        <TechBackground />
        <div className="loading-screen">
          <div className="loading-ring" />
          <span>Carregando dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TechBackground />

      <header className="topbar glass-layer">
        <div>
          <h1 className="headline">NeuroLedger</h1>
          <p className="subline">Controle inteligente de financas — {getMonthLabel(monthKey)}</p>
        </div>
        <div className="topbar-actions">
          <button className="btn-ghost" type="button" onClick={() => exportCSV(state)} title="Exportar CSV">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            CSV
          </button>
          {confirmDelete ? (
            <div className="confirm-row">
              <span className="confirm-text">Apagar tudo?</span>
              <button className="btn-danger" type="button" onClick={handleDeleteAll}>Sim</button>
              <button className="btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>Nao</button>
            </div>
          ) : (
            <button className="btn-ghost btn-ghost-danger" type="button" onClick={() => setConfirmDelete(true)} title="Apagar todos os dados">
              <TrashIcon className="icon icon-sm" /> Apagar Tudo
            </button>
          )}
          <label className="month-picker">
            <CalendarIcon className="icon" />
            <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
          </label>
        </div>
      </header>

      <main className="layout-grid">
        {/* Reminder banner */}
        <ReminderBanner overdueBills={snapshot.overdueBills} upcomingBills={snapshot.upcomingBills} />

        {/* KPI row */}
        <section className="kpi-grid">
          <KpiCard
            label="Entradas"
            value={formatCurrency(snapshot.incomesTotal)}
            series={snapshot.dailyBalanceSeries}
            icon={<ArrowUpIcon className="icon" />}
          />
          <KpiCard
            label="Saidas"
            value={formatCurrency(snapshot.expensesTotal)}
            series={snapshot.dailyBalanceSeries.map((v) => -v)}
            icon={<ArrowDownIcon className="icon" />}
          />
          <KpiCard
            label="Saldo Projetado"
            value={formatCurrency(snapshot.projectedBalance)}
            series={snapshot.dailyBalanceSeries}
            icon={<WalletIcon className="icon" />}
          />
          <KpiCard
            label="Ja Pago (contas)"
            value={formatCurrency(snapshot.billsPaidSoFar)}
            series={[snapshot.billsPaidSoFar, snapshot.billsToPay, snapshot.projectedBalance]}
            icon={<PulseIcon className="icon" />}
          />
        </section>

        {/* Chart + Calendar */}
        <section className="chart-cal-row">
          <MonthlyChart
            incomes={snapshot.incomesTotal + snapshot.billsToReceive}
            expenses={snapshot.expensesTotal + snapshot.billsToPay}
            series={snapshot.dailyBalanceSeries}
          />
          <CalendarTimeline monthKey={monthKey} bills={state.bills} transactions={state.transactions} />
        </section>

        {/* Health Score + Insights */}
        <section className="insights-row">
          <HealthScore snapshot={snapshot} monthlyBudget={state.monthlyBudget} />
          <QuickInsights snapshot={snapshot} monthlyBudget={state.monthlyBudget} onBudgetChange={setBudget} />
        </section>

        {/* Recurring Income + Smart Advisor */}
        <RecurringIncomePanel
          incomes={state.recurringIncomes}
          onAdd={addRecurringIncome}
          onDelete={deleteRecurringIncome}
          onToggle={toggleRecurringIncome}
        />

        {/* Smart Financial Advisor */}
        <SmartAdvisor state={state} snapshot={snapshot} monthKey={monthKey} />

        {/* Cash Flow Timeline */}
        <CashFlowTimeline
          monthKey={monthKey}
          transactions={state.transactions}
          bills={state.bills}
          recurringIncomes={state.recurringIncomes}
        />

        {/* Forms */}
        <section className="forms-grid glass-layer">
          <TransactionForm onCreate={addTransaction} />
          <BillForm onCreate={addBill} />
        </section>

        {/* Bills for current month */}
        <section className="glass-card list-panel">
          <h2 className="section-title">Contas de {getMonthLabel(monthKey)} ({monthBills.length})</h2>
          {monthBills.length === 0 ? (
            <p className="empty-text">Nenhuma conta agendada para este mes.</p>
          ) : (
            <div className="bills-list">
              {monthBills.map((bill) => (
                <BillCard key={bill.id} bill={bill} onAddPayment={addPaymentToBill} onDelete={deleteBill} />
              ))}
            </div>
          )}
        </section>

        {/* All active bills across all months */}
        {allActiveBills.length > 0 && allActiveBills.length !== monthBills.length && (
          <section className="glass-card list-panel">
            <h2 className="section-title">Todas as Contas Pendentes ({allActiveBills.length})</h2>
            <p className="empty-text" style={{ marginBottom: 8 }}>Contas de todos os meses que ainda nao foram pagas.</p>
            <div className="bills-list">
              {allActiveBills.map((bill) => (
                <BillCard key={bill.id} bill={bill} onAddPayment={addPaymentToBill} onDelete={deleteBill} />
              ))}
            </div>
          </section>
        )}

        {/* Transactions list */}
        <section className="glass-card list-panel">
          <h2 className="section-title">Lancamentos do Mes ({monthTransactions.length})</h2>
          {monthTransactions.length === 0 ? (
            <p className="empty-text">Sem movimentacoes no periodo selecionado.</p>
          ) : (
            <ul className="line-list">
              {monthTransactions.map((item) => (
                <li key={item.id} className="line-item">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{formatDate(item.date)} — {CATEGORY_LABELS[item.category]}</span>
                  </div>
                  <div className="line-meta">
                    <span>{item.type === 'income' ? 'Entrada' : 'Saida'}</span>
                    <strong>{formatCurrency(item.amount)}</strong>
                    <button className="btn-danger-sm" type="button" onClick={() => deleteTransaction(item.id)} title="Excluir">
                      <TrashIcon className="icon icon-sm" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {/* Savings Goals */}
        <SavingsGoals
          goals={state.savingsGoals}
          onAdd={addGoal}
          onUpdate={depositToGoal}
          onDelete={deleteGoal}
        />
        <footer className="app-footer">
          <span>NeuroLedger — Dados salvos localmente + Supabase</span>
        </footer>
      </main>

      {/* Toast notification */}
      {toast && <div className="toast-notification">{toast}</div>}
    </div>
  );
}
