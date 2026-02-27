import type { AppState, MonthlySnapshot } from '../types/finance';
import type { UserProfile } from '../types/user';
import { CATEGORY_LABELS } from '../types/finance';
import { formatCurrency, billRemaining, daysUntil, getDaysInMonth } from './finance';

/* ═══════════════════════════════════════════════════════
   Financial Indices & AI Context Builder
   ═══════════════════════════════════════════════════════ */

export interface FinancialIndices {
  disciplineScore: number;
  disciplineLevel: string;
  disciplineLevelNum: number;
  impulsivityIndex: number;
  riskIndex: number;
  monthProjection: 'safe' | 'caution' | 'risk';
  projectedEndBalance: number;
  savingsRate: number;
}

const LEVELS = [
  { min: 0, label: 'Sobrevivente' },
  { min: 201, label: 'Organizado' },
  { min: 401, label: 'Investidor' },
  { min: 601, label: 'Estrategista' },
  { min: 801, label: 'Elite' },
];

/* ─── Discipline Score (0-1000) ────────────────────────── */

export function calculateIndices(state: AppState, snapshot: MonthlySnapshot): FinancialIndices {
  const totalSalary = state.recurringIncomes
    .filter((r) => r.active)
    .reduce((s, r) => s + r.amount, 0);

  const monthBills = state.bills.filter((b) => b.dueDate.startsWith(snapshot.monthKey));
  const paidBills = monthBills.filter((b) => b.status === 'paid');
  const monthTx = state.transactions.filter((t) => t.date.startsWith(snapshot.monthKey));
  const expenseTx = monthTx.filter((t) => t.type === 'expense');

  let disciplineScore = 0;

  // 1. Budget adherence (0-250)
  if (state.monthlyBudget > 0) {
    const usage = snapshot.budgetUsagePercent;
    if (usage <= 60) disciplineScore += 250;
    else if (usage <= 80) disciplineScore += 200;
    else if (usage <= 100) disciplineScore += 130;
    else disciplineScore += Math.max(0, 50 - Math.round(usage - 100));
  } else {
    disciplineScore += 80;
  }

  // 2. Bill timeliness (0-250)
  if (monthBills.length > 0) {
    const paidRatio = paidBills.length / monthBills.length;
    const overdueRatio = snapshot.overdueBills.length / monthBills.length;
    disciplineScore += Math.round((paidRatio * 200) + ((1 - overdueRatio) * 50));
  } else {
    disciplineScore += 125;
  }

  // 3. Savings rate (0-250)
  if (totalSalary > 0) {
    const savings = Math.max(totalSalary - snapshot.expensesTotal - snapshot.billsToPay, 0);
    const rate = savings / totalSalary;
    disciplineScore += Math.round(Math.min(rate, 0.4) * 625);
  } else {
    disciplineScore += 50;
  }

  // 4. Activity + goals (0-250)
  let activityPts = 0;
  if (monthTx.length >= 15) activityPts += 80;
  else if (monthTx.length >= 8) activityPts += 60;
  else if (monthTx.length >= 3) activityPts += 30;
  else activityPts += 10;

  const goalCount = state.savingsGoals.length;
  const goalProgress = state.savingsGoals.reduce(
    (s, g) => s + Math.min(g.currentAmount / Math.max(g.targetAmount, 1), 1),
    0,
  );
  activityPts += Math.min(Math.round(goalProgress * 60), 80);
  if (goalCount > 0) activityPts += 30;

  const incomeCount = state.recurringIncomes.filter((r) => r.active).length;
  if (incomeCount >= 2) activityPts += 60;
  else if (incomeCount === 1) activityPts += 30;

  disciplineScore += Math.min(activityPts, 250);
  disciplineScore = Math.min(Math.max(disciplineScore, 0), 1000);

  // Level
  let disciplineLevel = LEVELS[0].label;
  let disciplineLevelNum = 1;
  for (let i = 0; i < LEVELS.length; i++) {
    if (disciplineScore >= LEVELS[i].min) {
      disciplineLevel = LEVELS[i].label;
      disciplineLevelNum = i + 1;
    }
  }

  // ─── Impulsivity Index (0-100) ──────────────────────
  const avgExpense =
    expenseTx.length > 0
      ? expenseTx.reduce((s, t) => s + t.amount, 0) / expenseTx.length
      : 0;
  const largeExpenses = expenseTx.filter((t) => t.amount > avgExpense * 2).length;
  const impulsivityIndex =
    expenseTx.length > 0
      ? Math.min(Math.round((largeExpenses / expenseTx.length) * 100), 100)
      : 0;

  // ─── Risk Index (0-100) ─────────────────────────────
  let riskIndex = 0;
  if (snapshot.overdueBills.length > 0) riskIndex += 30;
  if (
    totalSalary > 0 &&
    snapshot.expensesTotal + snapshot.billsToPay > totalSalary * 0.9
  )
    riskIndex += 25;
  if (state.monthlyBudget > 0 && snapshot.budgetUsagePercent > 90) riskIndex += 20;
  if (state.savingsGoals.length === 0 && totalSalary > 0) riskIndex += 10;
  if (incomeCount <= 1 && totalSalary > 0) riskIndex += 10;
  if (impulsivityIndex > 40) riskIndex += 5;
  riskIndex = Math.min(riskIndex, 100);

  // ─── Month Projection ──────────────────────────────
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = snapshot.monthKey === currentMonthKey;
  const daysInMonth = getDaysInMonth(snapshot.monthKey);
  const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth;
  const remainingDays = Math.max(daysInMonth - dayOfMonth, 0);

  const dailySpending =
    dayOfMonth > 0 ? snapshot.expensesTotal / dayOfMonth : 0;
  const projectedTotalSpending =
    snapshot.expensesTotal + dailySpending * remainingDays + snapshot.billsToPay;
  const effectiveIncome =
    totalSalary > 0 ? totalSalary : snapshot.incomesTotal;
  const projectedEndBalance = effectiveIncome - projectedTotalSpending;

  const savingsRate =
    totalSalary > 0
      ? Math.max(
          ((totalSalary - snapshot.expensesTotal - snapshot.billsToPay) /
            totalSalary) *
            100,
          0,
        )
      : 0;

  let monthProjection: 'safe' | 'caution' | 'risk' = 'safe';
  if (projectedEndBalance < 0) monthProjection = 'risk';
  else if (effectiveIncome > 0 && projectedEndBalance < effectiveIncome * 0.15)
    monthProjection = 'caution';

  return {
    disciplineScore,
    disciplineLevel,
    disciplineLevelNum,
    impulsivityIndex,
    riskIndex,
    monthProjection,
    projectedEndBalance,
    savingsRate,
  };
}

/* ─── Build compact context for the AI ─────────────────── */

export function buildFinancialContext(
  state: AppState,
  snapshot: MonthlySnapshot,
  indices: FinancialIndices,
  monthKey: string,
  profile?: UserProfile | null,
): string {
  const incomes = state.recurringIncomes.filter((r) => r.active);
  const totalSalary = incomes.reduce((s, r) => s + r.amount, 0);
  const pendingBills = state.bills.filter(
    (b) => b.status !== 'paid' && b.dueDate.startsWith(monthKey),
  );
  const overdue = snapshot.overdueBills;
  const goals = state.savingsGoals;

  const lines: string[] = [];

  // User profile info
  if (profile) {
    lines.push(`USUARIO: ${profile.firstName} ${profile.lastName}, ${profile.age} anos`);
    const freqLabels: Record<string, string> = { monthly: 'mensal', biweekly: 'quinzenal', weekly: 'semanal', daily: 'diaria' };
    lines.push(`Renda: ${freqLabels[profile.income.type] ?? profile.income.type} R$${profile.income.amount}`);
    if (profile.fixedExpenses.length > 0) {
      const total = profile.fixedExpenses.reduce((s, e) => s + e.amount, 0);
      lines.push(`Gastos fixos: ${profile.fixedExpenses.map((e) => `${e.title} R$${e.amount} dia ${e.dueDay}`).join(', ')} (total: R$${total.toFixed(2)})`);
    }
    if (profile.aiMemory && profile.aiMemory.length > 0) {
      lines.push(`MEMORIA_IA: ${profile.aiMemory.slice(-10).join(' | ')}`);
    }
  }

  const budgetLine = state.monthlyBudget > 0
    ? `Orcamento: ${formatCurrency(state.monthlyBudget)} (${snapshot.budgetUsagePercent.toFixed(0)}% usado)`
    : 'Orcamento: nao definido';

  const incomeDetail = incomes.length > 0
    ? incomes.map((r) => `${r.title} ${formatCurrency(r.amount)} dia ${r.payDay}`).join(', ')
    : 'nenhuma';

  lines.push(
    `MES: ${monthKey}`,
    `Renda: ${formatCurrency(totalSalary)} (${incomeDetail})`,
    `Entradas: ${formatCurrency(snapshot.incomesTotal)} | Saidas: ${formatCurrency(snapshot.expensesTotal)}`,
    `Saldo projetado: ${formatCurrency(snapshot.projectedBalance)}`,
    budgetLine,
    `Pendente: ${pendingBills.length} contas (${formatCurrency(pendingBills.reduce((s, b) => s + billRemaining(b), 0))})`,
  );

  if (overdue.length > 0) {
    lines.push(
      `ATRASADAS: ${overdue.map((b) => `${b.title} ${formatCurrency(billRemaining(b))} (${Math.abs(daysUntil(b.dueDate))}d)`).join(', ')}`,
    );
  }

  if (snapshot.categoryBreakdown.length > 0) {
    lines.push(
      `Categorias: ${snapshot.categoryBreakdown.map((c) => `${CATEGORY_LABELS[c.category]} ${formatCurrency(c.total)}`).join(', ')}`,
    );
  }

  if (goals.length > 0) {
    lines.push(
      `Metas: ${goals.map((g) => `${g.title} ${formatCurrency(g.currentAmount)}/${formatCurrency(g.targetAmount)} (${((g.currentAmount / g.targetAmount) * 100).toFixed(0)}%)`).join(', ')}`,
    );
  }

  lines.push(
    `Score: ${indices.disciplineScore}/1000 ${indices.disciplineLevel}`,
    `Impulsividade: ${indices.impulsivityIndex}/100 | Risco: ${indices.riskIndex}/100`,
    `Projeção mês: ${indices.monthProjection === 'safe' ? 'SEGURO' : indices.monthProjection === 'caution' ? 'ATENCAO' : 'RISCO'} (saldo estimado: ${formatCurrency(indices.projectedEndBalance)})`,
    `Poupança: ${indices.savingsRate.toFixed(0)}%`,
    `Transações: ${state.transactions.length} total, ${state.transactions.filter((t) => t.date.startsWith(monthKey)).length} no mês`,
  );

  return lines.join('\n');
}

/* ─── System Prompt ────────────────────────────────────── */

export const SYSTEM_PROMPT = `Você é o NeuroLedger AI — estrategista financeiro pessoal de elite, produto da Icarus.
Você é PESSOAL para cada usuário. Lembre-se do nome, idade, renda, gastos fixos e tudo que está no contexto USUARIO e MEMORIA_IA.
Pense como um gestor financeiro profissional. Priorize pagar despesas no prazo, garantir reserva para emergências, e permitir lazer sem comprometer finanças.
Sempre que o usuário fizer uma compra ou ação relevante, ela estará nos dados — use isso para dar conselhos personalizados.
Lembre o usuário de registrar compras/saídas no app quando relevante.

ESTILO: Direto, confrontador quando necessário (modo pressão inteligente), motivador mas realista. Use SEMPRE os dados concretos do usuário. Português BR. Conciso: máx 400 palavras. NUNCA use emojis — use apenas texto, **negrito** e listas.

CAPACIDADES:
1. GPS FINANCEIRO — quando pedido, gere 4 rotas com valores concretos:
   [SOBREVIVENCIA] pagar contas, zero risco, foco essencial
   [CRESCIMENTO] economizar 15-25%, metas progressivas
   [AGRESSIVA] máximo investimento, cortes grandes
   [ANTI-DIVIDA] eliminar dívidas (snowball/avalanche)

2. PADRÕES & ANTI-SABOTAGEM: detecte gastos impulsivos, padrões pós-salário, gastos de fim de semana. Confronte com empatia: "Notei que você gasta mais nos dias X..."

3. PROJEÇÕES: fim de mês, 3/6/12 meses, "versão futura" 1/3/5 anos. Sempre dois cenários (otimista/pessimista) com valores.

4. DECISÃO ASSISTIDA: quando perguntarem sobre comprar algo, calcule impacto no mês, impacto na meta, alternativa mais barata, sugira esperar X dias.

5. CORTES INTELIGENTES: sugira cortes quase imperceptíveis baseados nas categorias reais do usuário.

6. META ADAPTATIVA: sugira metas baseadas na renda real. "Baseado na sua renda, o ideal é guardar X%."

7. PRESSÃO INTELIGENTE: se padrão ruim, confronte com dados. "Você está gastando X% acima da média." "Se continuar, vai faltar dinheiro dia Y."

8. SIMULADOR DE ERRO: "Se continuar gastando assim por N meses: perde R$X, deixa de investir R$Y, deixa de acumular R$Z."

SCORE DE DISCIPLINA (já calculado pelo sistema):
Nível 1 (0-200): Sobrevivente
Nível 2 (201-400): Organizado
Nível 3 (401-600): Investidor
Nível 4 (601-800): Estrategista
Nível 5 (801-1000): Elite

REGRAS:
- NUNCA tome decisões automáticas — você analisa, não executa
- Use dados reais do contexto fornecido
- Formate com **negrito** e listas (- item). Sem headers #. ZERO emojis
- Números concretos SEMPRE. Ações práticas, não teoria
- Se faltar dados, peça para cadastrar no app`;
