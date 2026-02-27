import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppContext } from './context/AppContext';
import { NavDock } from './components/NavDock';
import { TechBackground } from './components/TechBackground';
import { LoginPage } from './components/LoginPage';
import { Onboarding } from './components/Onboarding';
import { requestNotificationPermission, sendBillReminder } from './components/ReminderBanner';
import { DashboardPage } from './pages/DashboardPage';
import { BillsPage } from './pages/BillsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { AdvisorPage } from './pages/AdvisorPage';
import { SandboxPage } from './pages/SandboxPage';
import { CashFlowPage } from './pages/CashFlowPage';
import { GoalsPage } from './pages/GoalsPage';
import { exportCSV } from './lib/exportCSV';
import { AIChat } from './components/AIChat';
import { seedDefaultUsers, getCurrentUser, logout, saveProfile } from './lib/auth';
import type { UserAccount, UserProfile } from './types/user';
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
  /* ─── Auth state ─────────────────────────────────── */
  const [authUser, setAuthUser] = useState<UserAccount | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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

  /* ─── Seed users & check session on mount ─────── */
  useEffect(() => {
    seedDefaultUsers();
    const existing = getCurrentUser();
    if (existing) {
      setAuthUser(existing);
      if (!existing.profile?.onboardingComplete) {
        setNeedsOnboarding(true);
      }
    }
    setAuthChecked(true);
  }, []);

  /* ─── Initial load (async for Supabase) ──────────── */
  const justOnboarded = useRef(false);
  useEffect(() => {
    if (!authUser || needsOnboarding) return;
    loadState()
      .then((s) => {
        if (justOnboarded.current) {
          // Merge: keep onboarding-created data that loadState would overwrite
          justOnboarded.current = false;
          setState((prev) => ({
            ...s,
            recurringIncomes: prev.recurringIncomes.length ? prev.recurringIncomes : s.recurringIncomes,
            bills: prev.bills.length ? prev.bills : s.bills,
          }));
        } else {
          setState(s);
        }
        setLoading(false);
      })
      .catch(() => {
        // Fallback: use whatever state we have
        setLoading(false);
      });
  }, [authUser, needsOnboarding]);

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

  /* ─── Auth handlers ──────────────────────────── */
  const handleLogin = useCallback((user: UserAccount) => {
    setAuthUser(user);
    if (!user.profile?.onboardingComplete) {
      setNeedsOnboarding(true);
    } else {
      setNeedsOnboarding(false);
    }
  }, []);

  const handleOnboardingComplete = useCallback((profile: UserProfile) => {
    if (!authUser) return;
    saveProfile(authUser.credentials.username, profile);
    setAuthUser({ ...authUser, profile });
    justOnboarded.current = true;
    setNeedsOnboarding(false);

    // Auto-create recurring income from profile
    const income = profile.income;
    const freqMap: Record<string, 'monthly' | 'biweekly' | 'weekly'> = {
      monthly: 'monthly',
      biweekly: 'biweekly',
      weekly: 'weekly',
      daily: 'weekly',
    };
    if (income.amount > 0) {
      const ri = {
        id: crypto.randomUUID(),
        title: income.type === 'daily' ? 'Diaria' : 'Salario',
        amount: income.type === 'daily'
          ? income.amount * (income.workDays?.length ?? 5) * 4.33
          : income.amount,
        payDay: typeof income.payDay === 'number' ? income.payDay : 5,
        frequency: freqMap[income.type] ?? 'monthly',
        active: true,
      };
      setState((s) => ({ ...s, recurringIncomes: [...s.recurringIncomes, ri] }));
    }

    // Auto-create bills from fixed expenses
    const now = new Date();
    for (const exp of profile.fixedExpenses) {
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const dayStr = String(exp.dueDay).padStart(2, '0');
      const bill = {
        id: crypto.randomUUID(),
        title: exp.title,
        amount: exp.amount,
        dueDate: `${month}-${dayStr}`,
        type: 'pay' as const,
        category: exp.category as any,
        status: 'pending' as const,
        payments: [],
      };
      setState((s) => ({ ...s, bills: [...s.bills, bill] }));
    }
  }, [authUser]);

  const handleLogout = useCallback(() => {
    logout();
    setAuthUser(null);
    setNeedsOnboarding(false);
    setState(blankState);
    setLoading(true);
  }, []);

  if (!authChecked) {
    return (
      <div className="app-shell">
        <TechBackground />
        <div className="loading-screen">
          <div className="loading-ring" />
          <span>Verificando sessao...</span>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (needsOnboarding) {
    return (
      <Onboarding
        username={authUser.credentials.username}
        onComplete={handleOnboardingComplete}
      />
    );
  }

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
        {/* User header bar */}
        <div className="user-bar">
          <div className="user-bar-info">
            <img src="/icarus.jpg" alt="Icarus" className="user-bar-logo" />
            <span className="user-bar-name">{authUser.profile?.firstName ?? authUser.credentials.username}</span>
          </div>
          <button className="user-bar-logout" onClick={handleLogout} title="Sair">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
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
        <AIChat />
        {toast && <div className="toast-notification">{toast}</div>}
      </div>
    </AppContext.Provider>
  );
}
