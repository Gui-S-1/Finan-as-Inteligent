import type { AppState, Bill, Payment, Transaction } from '../types/finance';
import { supabase } from './supabase';
import { deriveBillStatus } from './finance';

/* ──────────────────────────────────────────────────────
   Hybrid storage: Supabase (primary) + localStorage (cache/fallback)
   ────────────────────────────────────────────────────── */

const LS_KEY = 'neuro-ledger-v2';

const blank: AppState = { transactions: [], bills: [], monthlyBudget: 0 };

/* ─── localStorage helpers ────────────────────────────── */

function lsLoad(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return blank;
    const p = JSON.parse(raw) as Partial<AppState>;
    return {
      transactions: Array.isArray(p.transactions) ? p.transactions : [],
      bills: Array.isArray(p.bills)
        ? p.bills.map((b: any) => ({
            ...b,
            payments: Array.isArray(b.payments) ? b.payments : [],
            status: b.status ?? (b.paid ? 'paid' : 'pending'),
            category: b.category ?? 'other',
          }))
        : [],
      monthlyBudget: typeof p.monthlyBudget === 'number' ? p.monthlyBudget : 0,
    };
  } catch {
    return blank;
  }
}

function lsSave(s: AppState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

/* ─── Supabase helpers ────────────────────────────────── */

async function sbAvailable(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('settings').select('key').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/* ─── Public API ──────────────────────────────────────── */

export async function loadState(): Promise<AppState> {
  // Always load from localStorage first (instant)
  const local = lsLoad();

  if (!(await sbAvailable())) return local;

  try {
    const [txRes, billRes, payRes, settRes] = await Promise.all([
      supabase!.from('transactions').select('*'),
      supabase!.from('bills').select('*'),
      supabase!.from('payments').select('*'),
      supabase!.from('settings').select('*'),
    ]);

    const transactions: Transaction[] = (txRes.data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      amount: Number(r.amount),
      date: r.date,
      type: r.type,
      category: r.category ?? 'other',
      notes: r.notes ?? undefined,
    }));

    const payments: Payment[] = (payRes.data ?? []).map((r: any) => ({
      id: r.id,
      amount: Number(r.amount),
      date: r.date,
      notes: r.notes ?? undefined,
      _billId: r.bill_id,
    }));

    const bills: Bill[] = (billRes.data ?? []).map((r: any) => {
      const bp = payments.filter((p: any) => p._billId === r.id).map(({ _billId, ...rest }: any) => rest);
      const b: Bill = {
        id: r.id,
        title: r.title,
        amount: Number(r.amount),
        dueDate: r.due_date,
        type: r.type,
        category: r.category ?? 'other',
        status: r.status ?? 'pending',
        payments: bp,
      };
      b.status = deriveBillStatus(b);
      return b;
    });

    const budgetRow = (settRes.data ?? []).find((r: any) => r.key === 'monthlyBudget');
    const monthlyBudget = budgetRow ? Number(budgetRow.value) : local.monthlyBudget;

    const state: AppState = { transactions, bills, monthlyBudget };
    lsSave(state); // cache
    return state;
  } catch {
    return local;
  }
}

export async function saveState(s: AppState) {
  lsSave(s);
  // Supabase sync happens via granular operations below
}

/* ─── Granular Supabase operations ────────────────────── */

export async function addTransactionDB(t: Transaction) {
  if (!supabase) return;
  await supabase.from('transactions').upsert({
    id: t.id, title: t.title, amount: t.amount,
    date: t.date, type: t.type, category: t.category, notes: t.notes ?? null,
  });
}

export async function deleteTransactionDB(id: string) {
  if (!supabase) return;
  await supabase.from('transactions').delete().eq('id', id);
}

export async function addBillDB(b: Bill) {
  if (!supabase) return;
  await supabase.from('bills').upsert({
    id: b.id, title: b.title, amount: b.amount,
    due_date: b.dueDate, type: b.type, category: b.category, status: b.status,
  });
}

export async function deleteBillDB(id: string) {
  if (!supabase) return;
  // payments cascade-deleted
  await supabase.from('bills').delete().eq('id', id);
}

export async function updateBillStatusDB(id: string, status: string) {
  if (!supabase) return;
  await supabase.from('bills').update({ status }).eq('id', id);
}

export async function addPaymentDB(billId: string, p: Payment) {
  if (!supabase) return;
  await supabase.from('payments').upsert({
    id: p.id, bill_id: billId, amount: p.amount, date: p.date, notes: p.notes ?? null,
  });
}

export async function saveBudgetDB(value: number) {
  if (!supabase) return;
  await supabase.from('settings').upsert({ key: 'monthlyBudget', value: String(value) });
}

export async function deleteAllDataDB() {
  if (!supabase) return;
  await Promise.all([
    supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
  ]);
  await supabase.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('settings').delete().neq('key', '');
}

export function deleteAllDataLocal() {
  localStorage.removeItem(LS_KEY);
}
