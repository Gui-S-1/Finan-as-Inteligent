import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppContext } from './context/AppContext';
import { NavDock } from './components/NavDock';
import { TechBackground } from './components/TechBackground';
import { requestNotificationPermission, sendBillReminder } from './components/ReminderBanner';
import { DashboardPage } from './pages/DashboardPage';
import { BillsPage } from './pages/BillsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { AdvisorPage } from './pages/AdvisorPage';
import { SandboxPage } from './pages/SandboxPage';
import { CashFlowPage } from './pages/CashFlowPage';
import { GoalsPage } from './pages/GoalsPage';
import { exportCSV } from './lib/exportCSV';
import {
  calculateSnapshot,
  deriveBillStatus,
  formatCurrency,
  formatDate,
  getCurrentMonthKey,
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

  const allActiveBills = useMemo(
    () => sortByDateAsc(state.bills.filter((b) => b.status !== 'paid')),
    [state.bills],
  );

  /* ─── Actions (+ Supabase sync) ────────────────── */

  const addTransaction = useCallback((item: Transaction) => {
    setState((s) => ({ ...s, transactions: [...s.transactions, item] }));
    addTransactionDB(item);
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

  const exportData = useCallback(() => exportCSV(state), [state]);

  /* ─── Context value ────────────────────────────── */
  const ctx = useMemo(() => ({
    state, monthKey, setMonthKey, snapshot,
    monthTransactions, monthBills, allActiveBills,
    confirmDelete, setConfirmDelete,
    addTransaction, deleteTransaction, addBill, deleteBill,
    addPaymentToBill, setBudget, handleDeleteAll,
    addRecurringIncome, deleteRecurringIncome, toggleRecurringIncome,
    addGoal, depositToGoal, deleteGoal,
    showToast, exportData,
  }), [
    state, monthKey, snapshot, monthTransactions, monthBills, allActiveBills, confirmDelete,
    addTransaction, deleteTransaction, addBill, deleteBill,
    addPaymentToBill, setBudget, handleDeleteAll,
    addRecurringIncome, deleteRecurringIncome, toggleRecurringIncome,
    addGoal, depositToGoal, deleteGoal, showToast, exportData,
  ]);

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
    <AppContext.Provider value={ctx}>
      <div className="app-shell">
        <TechBackground />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/contas" element={<BillsPage />} />
          <Route path="/lancamentos" element={<TransactionsPage />} />
          <Route path="/consultor" element={<AdvisorPage />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          <Route path="/fluxo" element={<CashFlowPage />} />
          <Route path="/metas" element={<GoalsPage />} />
        </Routes>
        <NavDock />
        {toast && <div className="toast-notification">{toast}</div>}
      </div>
    </AppContext.Provider>
  );
}
