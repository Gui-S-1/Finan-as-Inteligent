import { createContext, useContext } from 'react';
import type { AppState, Bill, MonthlySnapshot, Payment, RecurringIncome, SavingsGoal, Transaction } from '../types/finance';

export interface AppContextType {
  state: AppState;
  monthKey: string;
  setMonthKey: (key: string) => void;
  snapshot: MonthlySnapshot;
  monthTransactions: Transaction[];
  monthBills: Bill[];
  allActiveBills: Bill[];
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  addTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addBill: (b: Bill) => void;
  deleteBill: (id: string) => void;
  addPaymentToBill: (billId: string, payment: Payment) => void;
  setBudget: (v: number) => void;
  handleDeleteAll: () => void;
  addRecurringIncome: (i: RecurringIncome) => void;
  deleteRecurringIncome: (id: string) => void;
  toggleRecurringIncome: (id: string) => void;
  addGoal: (g: SavingsGoal) => void;
  depositToGoal: (id: string, amount: number) => void;
  deleteGoal: (id: string) => void;
  showToast: (msg: string) => void;
  exportData: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
