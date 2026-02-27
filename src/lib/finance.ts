import type { Bill, Category, MonthlySnapshot, Transaction } from '../types/finance';

/* ─── helpers ──────────────────────────────────────────── */

export function getCurrentMonthKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function isSameMonth(dateISO: string, monthKey: string): boolean {
  return dateISO.slice(0, 7) === monthKey;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ─── bill helpers ──────────────────────────────────────── */

export function billPaidTotal(bill: Bill): number {
  return bill.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function billRemaining(bill: Bill): number {
  return Math.max(bill.amount - billPaidTotal(bill), 0);
}

export function billProgressPercent(bill: Bill): number {
  if (bill.amount <= 0) return 100;
  return Math.min((billPaidTotal(bill) / bill.amount) * 100, 100);
}

export function deriveBillStatus(bill: Bill): Bill['status'] {
  const paid = billPaidTotal(bill);
  if (paid >= bill.amount) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

export function isBillOverdue(bill: Bill): boolean {
  return bill.status !== 'paid' && bill.dueDate < todayISO();
}

/* ─── snapshot ──────────────────────────────────────────── */

export function calculateSnapshot(
  transactions: Transaction[],
  bills: Bill[],
  monthKey: string,
  monthlyBudget: number,
): MonthlySnapshot {
  const monthTransactions = transactions.filter((t) => isSameMonth(t.date, monthKey));
  const monthBills = bills.filter((b) => isSameMonth(b.dueDate, monthKey));

  const incomesTotal = monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const expensesTotal = monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const billsToReceive = monthBills
    .filter((b) => b.type === 'receive' && b.status !== 'paid')
    .reduce((s, b) => s + billRemaining(b), 0);
  const billsToPay = monthBills
    .filter((b) => b.type === 'pay' && b.status !== 'paid')
    .reduce((s, b) => s + billRemaining(b), 0);
  const billsPaidSoFar = monthBills
    .filter((b) => b.type === 'pay')
    .reduce((s, b) => s + billPaidTotal(b), 0);

  const projectedBalance = incomesTotal - expensesTotal + billsToReceive - billsToPay;

  const today = todayISO();
  const overdueBills = monthBills.filter(
    (b) => b.status !== 'paid' && b.dueDate < today,
  );
  const upcomingBills = monthBills
    .filter((b) => b.status !== 'paid' && b.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalSpent = expensesTotal + billsPaidSoFar;
  const budgetUsagePercent = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;

  /* category breakdown (expenses + bills-to-pay) */
  const catMap = new Map<Category, number>();
  monthTransactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount));
  monthBills
    .filter((b) => b.type === 'pay')
    .forEach((b) => catMap.set(b.category, (catMap.get(b.category) ?? 0) + b.amount));
  const categoryBreakdown = [...catMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  return {
    monthKey,
    incomesTotal,
    expensesTotal,
    billsToReceive,
    billsToPay,
    billsPaidSoFar,
    projectedBalance,
    dailyBalanceSeries: buildDailyBalanceSeries(monthTransactions, monthBills, monthKey),
    overdueBills,
    upcomingBills,
    budgetUsagePercent,
    categoryBreakdown,
  };
}

/* ─── daily series ──────────────────────────────────────── */

export function buildDailyBalanceSeries(
  transactions: Transaction[],
  bills: Bill[],
  monthKey: string,
): number[] {
  const [year, month] = monthKey.split('-').map(Number);
  const totalDays = new Date(year, month, 0).getDate();

  const map = new Map<number, number>();

  transactions.forEach((t) => {
    const day = new Date(t.date + 'T00:00:00').getDate();
    const signed = t.type === 'income' ? t.amount : -t.amount;
    map.set(day, (map.get(day) ?? 0) + signed);
  });

  bills.forEach((b) => {
    if (b.status === 'paid') return;
    const day = new Date(b.dueDate + 'T00:00:00').getDate();
    const signed = b.type === 'receive' ? billRemaining(b) : -billRemaining(b);
    map.set(day, (map.get(day) ?? 0) + signed);
  });

  let running = 0;
  const result: number[] = [];
  for (let d = 1; d <= totalDays; d++) {
    running += map.get(d) ?? 0;
    result.push(running);
  }
  return result;
}

/* ─── sorting ──────────────────────────────────────────── */

export function sortByDateAsc<T extends { date?: string; dueDate?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aV = new Date(a.date ?? a.dueDate ?? '').getTime();
    const bV = new Date(b.date ?? b.dueDate ?? '').getTime();
    return aV - bV;
  });
}

/* ─── formatters ───────────────────────────────────────── */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDay(value: string): string {
  return new Date(`${value}T00:00:00`).getDate().toString().padStart(2, '0');
}

export function daysUntil(dateISO: string): number {
  const target = new Date(`${dateISO}T00:00:00`).getTime();
  const now = new Date(todayISO() + 'T00:00:00').getTime();
  return Math.ceil((target - now) / 86400000);
}

export function getDaysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
}
