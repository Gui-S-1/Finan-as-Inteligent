export type TransactionType = 'income' | 'expense';
export type BillType = 'receive' | 'pay';
export type BillStatus = 'pending' | 'partial' | 'paid';

export type Category =
  | 'housing'
  | 'food'
  | 'transport'
  | 'health'
  | 'education'
  | 'entertainment'
  | 'services'
  | 'salary'
  | 'freelance'
  | 'investment'
  | 'other';

export const CATEGORY_LABELS: Record<Category, string> = {
  housing: 'Moradia',
  food: 'Alimentacao',
  transport: 'Transporte',
  health: 'Saude',
  education: 'Educacao',
  entertainment: 'Lazer',
  services: 'Servicos',
  salary: 'Salario',
  freelance: 'Freelance',
  investment: 'Investimento',
  other: 'Outro',
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  date: string;
  type: TransactionType;
  category: Category;
  notes?: string;
}

/** A single partial payment recorded against a Bill */
export interface Payment {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface Bill {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  type: BillType;
  category: Category;
  status: BillStatus;
  payments: Payment[];
}

export interface AppState {
  transactions: Transaction[];
  bills: Bill[];
  monthlyBudget: number;
  recurringIncomes: RecurringIncome[];
  savingsGoals: SavingsGoal[];
}

export interface RecurringIncome {
  id: string;
  title: string;
  amount: number;
  payDay: number;          // dia do mes (1–31)
  frequency: 'monthly' | 'biweekly' | 'weekly';
  active: boolean;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  createdAt: string;
}

export interface MonthlySnapshot {
  monthKey: string;
  incomesTotal: number;
  expensesTotal: number;
  billsToReceive: number;
  billsToPay: number;
  billsPaidSoFar: number;
  projectedBalance: number;
  dailyBalanceSeries: number[];
  overdueBills: Bill[];
  upcomingBills: Bill[];
  budgetUsagePercent: number;
  categoryBreakdown: { category: Category; total: number }[];
}
