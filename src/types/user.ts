/* ═══════════════════════════════════════════════════════
   User & Profile Types
   ═══════════════════════════════════════════════════════ */

export type IncomeFrequency = 'monthly' | 'biweekly' | 'weekly' | 'daily';

export interface IncomeSchedule {
  type: IncomeFrequency;
  amount: number;
  /** For monthly: day of month (1-31). For weekly: 0=dom,1=seg...6=sab. For daily: days worked per week string e.g. "1,2,3,4,5" */
  payDay: number | string;
  /** For daily workers: which weekdays they work (0-6) */
  workDays?: number[];
}

export interface FixedExpense {
  id: string;
  title: string;
  amount: number;
  dueDay: number; // day of month
  category: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  age: number;
  income: IncomeSchedule;
  fixedExpenses: FixedExpense[];
  onboardingComplete: boolean;
  createdAt: string;
  /** AI memory — key events/notes the AI stores */
  aiMemory: string[];
}

export interface UserCredentials {
  username: string;
  passwordHash: string;
}

export interface UserAccount {
  credentials: UserCredentials;
  profile: UserProfile | null;
}

/** Registry of all users (stored in localStorage) */
export interface UsersRegistry {
  users: UserAccount[];
}
