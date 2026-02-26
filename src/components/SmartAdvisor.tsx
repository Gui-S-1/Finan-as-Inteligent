import { formatCurrency, formatDate, billRemaining, billPaidTotal, daysUntil, getDaysInMonth } from '../lib/finance';
import type { AppState, MonthlySnapshot, Category } from '../types/finance';
import { CATEGORY_LABELS } from '../types/finance';

type Props = {
  state: AppState;
  snapshot: MonthlySnapshot;
  monthKey: string;
};

interface Tip {
  icon: string;       // SVG path
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
}

// ──────────────────────────────────────────────────────────
// Mega-intelligent financial advisor engine
// 20+ analysis strategies, context-aware & action-oriented
// ──────────────────────────────────────────────────────────

function buildTips(state: AppState, snap: MonthlySnapshot, monthKey: string): Tip[] {
  const tips: Tip[] = [];
  const incomes = state.recurringIncomes.filter((r) => r.active);
  const totalSalary = incomes.reduce((s, r) => s + r.amount, 0);
  const pendingBills = state.bills.filter((b) => b.status !== 'paid' && b.dueDate.startsWith(monthKey));
  const totalPending = pendingBills.reduce((s, b) => s + billRemaining(b), 0);

  const dayOfMonth = new Date().getDate();
  const daysInMonth = getDaysInMonth(monthKey);
  const remainingDays = Math.max(daysInMonth - dayOfMonth, 1);
  const monthBills = state.bills.filter((b) => b.dueDate.startsWith(monthKey));
  const allExpenses = snap.expensesTotal + monthBills.filter(b => b.type === 'pay').reduce((s, b) => s + billPaidTotal(b), 0);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. DAILY ALLOWANCE — quanto pode gastar por dia
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (state.monthlyBudget > 0) {
    const remaining = Math.max(state.monthlyBudget - allExpenses - totalPending, 0);
    const dailyAllowance = remaining / remainingDays;
    tips.push({
      icon: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4',
      title: `Seu gasto diario ideal: ${formatCurrency(dailyAllowance)}`,
      body: `Restam ${formatCurrency(remaining)} do orcamento para ${remainingDays} dias. Gaste no maximo ${formatCurrency(dailyAllowance)} por dia para fechar o mes no azul.`,
      priority: dailyAllowance < 30 ? 'high' : 'low',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. REGRA 50/30/20 — breakdown com valores reais
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (totalSalary > 0) {
    const needs = totalSalary * 0.5;
    const wants = totalSalary * 0.3;
    const savings = totalSalary * 0.2;

    const needsCats: Category[] = ['housing', 'food', 'transport', 'health'];
    const wantsCats: Category[] = ['entertainment', 'services', 'education'];
    
    const actualNeeds = snap.categoryBreakdown
      .filter(c => needsCats.includes(c.category))
      .reduce((s, c) => s + c.total, 0);
    const actualWants = snap.categoryBreakdown
      .filter(c => wantsCats.includes(c.category))
      .reduce((s, c) => s + c.total, 0);
    
    const needsOk = actualNeeds <= needs;
    const wantsOk = actualWants <= wants;

    let verdict = '';
    if (!needsOk && !wantsOk) {
      verdict = `Necessidades (${formatCurrency(actualNeeds)}) e desejos (${formatCurrency(actualWants)}) estao acima do ideal. Corte ${formatCurrency(actualNeeds - needs)} em necessidades e ${formatCurrency(actualWants - wants)} em desejos.`;
    } else if (!needsOk) {
      verdict = `Necessidades (${formatCurrency(actualNeeds)}) excedem o limite de ${formatCurrency(needs)}. Renegocie aluguel, plano de saude ou transporte.`;
    } else if (!wantsOk) {
      verdict = `Desejos (${formatCurrency(actualWants)}) excedem o limite de ${formatCurrency(wants)}. Revise assinaturas e lazer.`;
    } else {
      verdict = `Parabens! Necessidades ${formatCurrency(actualNeeds)} e desejos ${formatCurrency(actualWants)} dentro do ideal.`;
    }

    tips.push({
      icon: 'M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2z',
      title: `Regra 50/30/20: Necessidades ${formatCurrency(needs)} | Desejos ${formatCurrency(wants)} | Poupanca ${formatCurrency(savings)}`,
      body: verdict,
      priority: !needsOk || !wantsOk ? 'medium' : 'low',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. SALARY VS BILLS TIMING ANALYSIS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (incomes.length > 0) {
    const payDays = incomes.map((r) => r.payDay).sort((a, b) => a - b);
    const billsDueBefore = pendingBills.filter((b) => {
      const day = new Date(b.dueDate + 'T00:00:00').getDate();
      return day < payDays[0];
    });
    if (billsDueBefore.length > 0) {
      const beforeTotal = billsDueBefore.reduce((s, b) => s + billRemaining(b), 0);
      tips.push({
        icon: 'M12 2v10l4.5 2.5',
        title: `${billsDueBefore.length} conta(s) vencem ANTES do salario`,
        body: `Seu salario cai no dia ${payDays[0]}, mas ${billsDueBefore.map(b => b.title).join(', ')} vence(m) antes. Reserve ${formatCurrency(beforeTotal)} do mes anterior ou renegocie as datas de vencimento.`,
        priority: 'high',
      });
    }

    // Payment scheduling
    const afterPayDay = pendingBills.filter((b) => {
      const day = new Date(b.dueDate + 'T00:00:00').getDate();
      return day >= payDays[0];
    });
    if (afterPayDay.length > 0) {
      // Sort by due date — pay earliest first
      const sorted = [...afterPayDay].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      tips.push({
        icon: 'M9 12l2 2 4-4',
        title: 'Ordem de pagamento apos salario',
        body: `No dia ${payDays[0]} voce recebe ${formatCurrency(totalSalary)}. Pague nesta ordem: ${sorted.slice(0, 4).map((b, i) => `${i + 1}) ${b.title} (${formatCurrency(billRemaining(b))})`).join(', ')}.`,
        priority: 'medium',
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. BUDGET PACE ANALYSIS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (state.monthlyBudget > 0) {
    const used = snap.budgetUsagePercent;
    const idealPct = (dayOfMonth / daysInMonth) * 100;

    if (used > idealPct + 15) {
      const excessAmount = ((used - idealPct) / 100) * state.monthlyBudget;
      tips.push({
        icon: 'M13 16h-1v-4h-1m2-4h.01',
        title: 'Voce esta gastando rapido demais!',
        body: `Ja usou ${used.toFixed(0)}% do orcamento (${formatCurrency(allExpenses + totalPending)}), mas so passaram ${idealPct.toFixed(0)}% do mes. Voce precisa cortar ${formatCurrency(excessAmount)} ou redistribuir gastos para os proximos ${remainingDays} dias.`,
        priority: 'high',
      });
    } else if (used < idealPct - 10) {
      tips.push({
        icon: 'M5 13l4 4L19 7',
        title: 'Otimo controle de gasto!',
        body: `Voce usou ${used.toFixed(0)}% do orcamento com ${idealPct.toFixed(0)}% do mes passado. Disponivel: ${formatCurrency(state.monthlyBudget * (1 - used / 100))}. Continue assim!`,
        priority: 'low',
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. SAVINGS POTENTIAL ANALYSIS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (totalSalary > 0) {
    const totalExpenses = snap.expensesTotal + totalPending;
    const leftover = totalSalary - totalExpenses;
    const savingsPct = (leftover / totalSalary) * 100;

    if (leftover > 0) {
      const yearSavings = leftover * 12;
      tips.push({
        icon: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z',
        title: `Potencial: guardar ${formatCurrency(leftover)}/mes (${savingsPct.toFixed(0)}%)`,
        body: `Em 12 meses voce acumularia ${formatCurrency(yearSavings)}. ${savingsPct >= 20 ? 'Excelente! Acima dos 20% recomendados.' : `Meta: aumente de ${savingsPct.toFixed(0)}% para 20% cortando ${formatCurrency(totalSalary * 0.2 - leftover)} em gastos.`}`,
        priority: savingsPct >= 20 ? 'low' : 'medium',
      });
    } else {
      tips.push({
        icon: 'M18.364 5.636a9 9 0 11-12.728 0',
        title: `ALERTA: gastos superam renda em ${formatCurrency(Math.abs(leftover))}`,
        body: `Gastos de ${formatCurrency(totalExpenses)} vs renda de ${formatCurrency(totalSalary)}. Corte imediatamente nas categorias menos essenciais. Priorize moradia, alimentacao e saude.`,
        priority: 'high',
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. CATEGORY-SPECIFIC DEEP ANALYSIS (top 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (snap.categoryBreakdown.length > 0 && totalSalary > 0) {
    const adviceMap: Partial<Record<Category, string>> = {
      housing: 'Considere renegociar aluguel, dividir moradia ou buscar opcoes mais baratas. Moradia idealmente nao deve superar 30% da renda.',
      food: 'Cozinhe em casa, planeje refeicoes semanalmente, compre no atacado e evite delivery frequente. Pode economizar ate 40%.',
      transport: 'Avalie transporte publico, carona compartilhada ou bicicleta. Combustivel e estacionamento sao gastos ocultos altos.',
      entertainment: 'Revise assinaturas de streaming e apps. Cancele as que nao usa. Busque lazer gratuito como parques e eventos comunitarios.',
      services: 'Renegocie plano de celular, internet e seguros. Compare precos anualmente. Muitos servicos tem descontos por fidelidade.',
      health: 'Verifique se seu plano de saude tem o melhor custo-beneficio. Considere genéricos e programas de desconto em farmacias.',
      education: 'Investimento excelente! Verifique se existem bolsas, descontos ou materiais gratuitos online (Coursera, Khan Academy).',
    };

    snap.categoryBreakdown.slice(0, 3).forEach((cat) => {
      const pct = ((cat.total / totalSalary) * 100);
      const advice = adviceMap[cat.category] || 'Monitore este gasto e busque otimizar sempre que possivel.';
      const isHigh = pct > 25;
      tips.push({
        icon: 'M4 6h16M4 12h10M4 18h16',
        title: `${CATEGORY_LABELS[cat.category]}: ${formatCurrency(cat.total)} (${pct.toFixed(0)}% da renda)`,
        body: isHigh
          ? `ACIMA do ideal. ${advice}`
          : `Dentro de um nivel saudavel. ${advice}`,
        priority: isHigh ? 'medium' : 'low',
      });
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. OVERDUE BILLS — urgency with cost estimation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (snap.overdueBills.length > 0) {
    const total = snap.overdueBills.reduce((s, b) => s + billRemaining(b), 0);
    const daysLate = snap.overdueBills.map(b => Math.abs(daysUntil(b.dueDate)));
    const maxLate = Math.max(...daysLate);
    // Estimate penalty (2% + R$2/day is common in Brazil)
    const estimatedPenalty = snap.overdueBills.reduce((s, b) => {
      const late = Math.abs(daysUntil(b.dueDate));
      return s + (billRemaining(b) * 0.02) + (late * 2);
    }, 0);
    tips.push({
      icon: 'M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.71-3L13.71 4a2 2 0 00-3.42 0L3.36 16a2 2 0 001.71 3z',
      title: `URGENTE: ${formatCurrency(total)} em atraso (ate ${maxLate} dias)`,
      body: `Pague AGORA: ${snap.overdueBills.map(b => b.title).join(', ')}. Multa estimada: ${formatCurrency(estimatedPenalty)}. Cada dia de atraso custa mais. Priorize a de maior valor.`,
      priority: 'high',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. UPCOMING 7 DAYS WARNING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const upcoming = pendingBills
    .filter((b) => daysUntil(b.dueDate) > 0 && daysUntil(b.dueDate) <= 7)
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate));
  if (upcoming.length > 0) {
    const upTotal = upcoming.reduce((s, b) => s + billRemaining(b), 0);
    tips.push({
      icon: 'M8 7V3m8 4V3m-4 18v-4m0 0l-3 3m3-3l3 3',
      title: `${upcoming.length} conta(s) nos proximos 7 dias: ${formatCurrency(upTotal)}`,
      body: upcoming.map(b => `${b.title}: ${formatCurrency(billRemaining(b))} em ${daysUntil(b.dueDate)} dia(s)`).join(' | '),
      priority: 'medium',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. DEBT-FREE DATE PROJECTION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (totalPending > 0 && totalSalary > 0) {
    const monthlyCapacity = Math.max(totalSalary - snap.expensesTotal, 0);
    if (monthlyCapacity > 0) {
      const monthsToPayOff = Math.ceil(totalPending / monthlyCapacity);
      const debtDate = new Date();
      debtDate.setMonth(debtDate.getMonth() + monthsToPayOff);
      const debtDateStr = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(debtDate);
      tips.push({
        icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
        title: monthsToPayOff <= 1 ? 'Voce zera as contas este mes!' : `Livre de dividas em ${debtDateStr}`,
        body: monthsToPayOff <= 1
          ? `Com sobra de ${formatCurrency(monthlyCapacity)}/mes, voce paga os ${formatCurrency(totalPending)} pendentes este mes. Excelente!`
          : `Devendo ${formatCurrency(totalPending)} com capacidade de ${formatCurrency(monthlyCapacity)}/mes, voce precisa de ~${monthsToPayOff} mes(es). Aumente a capacidade cortando gastos.`,
        priority: monthsToPayOff > 3 ? 'medium' : 'low',
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10. SAVINGS GOALS PROGRESS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const goals = state.savingsGoals ?? [];
  goals.forEach((g) => {
    if (g.currentAmount >= g.targetAmount) return;
    const remaining = g.targetAmount - g.currentAmount;
    const pct = ((g.currentAmount / g.targetAmount) * 100).toFixed(0);
    
    if (g.deadline) {
      const dLeft = daysUntil(g.deadline);
      if (dLeft > 0) {
        const monthsLeft = Math.max(Math.ceil(dLeft / 30), 1);
        const monthlyNeeded = remaining / monthsLeft;
        tips.push({
          icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
          title: `Meta "${g.title}": deposite ${formatCurrency(monthlyNeeded)}/mes`,
          body: `${pct}% atingido. Faltam ${formatCurrency(remaining)} em ${monthsLeft} mes(es). ${totalSalary > 0 && monthlyNeeded > totalSalary * 0.2 ? 'ATENCAO: isso supera 20% da renda, considere estender o prazo.' : 'Valor viavel! Mantenha disciplina.'}`,
          priority: monthlyNeeded > totalSalary * 0.3 ? 'high' : 'medium',
        });
      } else {
        tips.push({
          icon: 'M12 9v2m0 4h.01',
          title: `Meta "${g.title}" expirou com ${pct}% completado`,
          body: `Faltam ${formatCurrency(remaining)}. Reveja o prazo ou intensifique os depositos.`,
          priority: 'high',
        });
      }
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11. EMERGENCY FUND ADVICE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (totalSalary > 0 && goals.length === 0) {
    tips.push({
      icon: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2z',
      title: 'Crie uma reserva de emergencia',
      body: `Especialistas recomendam 6 meses de renda: ${formatCurrency(totalSalary * 6)}. Comece guardando ${formatCurrency(totalSalary * 0.1)}/mes (10%). Em 60 meses voce tera a reserva completa.`,
      priority: 'medium',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 12. INCOME DIVERSIFICATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (incomes.length === 1 && totalSalary > 0) {
    tips.push({
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M12 14a4 4 0 100-8 4 4 0 000 8z',
      title: 'Diversifique suas fontes de renda',
      body: `Voce depende 100% de uma unica fonte (${incomes[0].title}). Considere freelance, investimentos passivos ou renda extra. Uma segunda fonte, mesmo pequena, reduz o risco financeiro drasticamente.`,
      priority: 'low',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 13. PARTIAL PAYMENT STRATEGY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const partialBills = monthBills.filter(b => b.status === 'partial');
  if (partialBills.length > 0) {
    const totalRemaining = partialBills.reduce((s, b) => s + billRemaining(b), 0);
    tips.push({
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
      title: `${partialBills.length} conta(s) com pagamento parcial`,
      body: `Faltam ${formatCurrency(totalRemaining)} para quitar: ${partialBills.map(b => `${b.title} (${formatCurrency(billRemaining(b))})`).join(', ')}. Complete esses pagamentos antes de novas dividas.`,
      priority: 'medium',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 14. SPENDING VELOCITY (compared to previous half)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (dayOfMonth >= 15 && state.transactions.filter(t => t.date.startsWith(monthKey)).length >= 5) {
    const monthTx = state.transactions.filter(t => t.type === 'expense' && t.date.startsWith(monthKey));
    const firstHalf = monthTx.filter(t => new Date(t.date + 'T00:00:00').getDate() <= 15).reduce((s, t) => s + t.amount, 0);
    const secondHalf = monthTx.filter(t => new Date(t.date + 'T00:00:00').getDate() > 15).reduce((s, t) => s + t.amount, 0);
    
    if (firstHalf > 0 && secondHalf > firstHalf * 0.8) {
      tips.push({
        icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
        title: 'Gastos acelerando na 2a quinzena',
        body: `1a quinzena: ${formatCurrency(firstHalf)} | 2a quinzena ja: ${formatCurrency(secondHalf)}. Voce esta gastando mais rapido agora. Desacelere para nao estourar o orcamento.`,
        priority: 'medium',
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 15. BILL CONCENTRATION RISK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (pendingBills.length >= 3) {
    // Check if many bills are on the same week
    const weekMap = new Map<number, typeof pendingBills>();
    pendingBills.forEach(b => {
      const day = new Date(b.dueDate + 'T00:00:00').getDate();
      const week = Math.ceil(day / 7);
      weekMap.set(week, [...(weekMap.get(week) ?? []), b]);
    });
    const heaviestWeek = [...weekMap.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (heaviestWeek && heaviestWeek[1].length >= 3) {
      const weekTotal = heaviestWeek[1].reduce((s, b) => s + billRemaining(b), 0);
      tips.push({
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        title: `${heaviestWeek[1].length} contas na mesma semana: ${formatCurrency(weekTotal)}`,
        body: `Semana ${heaviestWeek[0]} concentra muitos vencimentos. Considere redistribuir as datas de vencimento para evitar picos de pagamento.`,
        priority: 'medium',
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 16. FINANCIAL HEALTH SCORE EXPLANATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (totalSalary > 0) {
    const totalExpenses = snap.expensesTotal + totalPending;
    const ratio = totalExpenses / totalSalary;
    let healthMsg = '';
    if (ratio < 0.5) healthMsg = 'EXCELENTE: Voce gasta menos de 50% da renda. Aproveite para investir e construir patrimonio.';
    else if (ratio < 0.7) healthMsg = 'BOM: Gastos entre 50-70% da renda. Ha margem para economia, busque otimizar.';
    else if (ratio < 0.9) healthMsg = 'ATENCAO: Gastos entre 70-90% da renda. Margem de seguranca baixa. Corte supérfluos.';
    else if (ratio < 1) healthMsg = 'CRITICO: Gastos acima de 90% da renda. Qualquer imprevisto pode gerar dividas.';
    else healthMsg = 'EMERGENCIA: Voce gasta mais do que ganha. Acao imediata necessaria!';
    
    tips.push({
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      title: `Saude financeira: ${(ratio * 100).toFixed(0)}% da renda comprometida`,
      body: healthMsg,
      priority: ratio > 0.9 ? 'high' : ratio > 0.7 ? 'medium' : 'low',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 17. SMART SUBSCRIPTION DETECTION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const servicesBills = monthBills.filter(b => b.category === 'services' || b.category === 'entertainment');
  if (servicesBills.length >= 2) {
    const subTotal = servicesBills.reduce((s, b) => s + b.amount, 0);
    const annual = subTotal * 12;
    tips.push({
      icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
      title: `${servicesBills.length} assinaturas/servicos: ${formatCurrency(subTotal)}/mes`,
      body: `Voce gasta ${formatCurrency(annual)}/ano em servicos e assinaturas. Revise: ainda usa todos? Existem planos mais baratos ou gratuitos?`,
      priority: totalSalary > 0 && subTotal > totalSalary * 0.1 ? 'medium' : 'low',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 18. POSITIVE REINFORCEMENT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const paidBills = monthBills.filter(b => b.status === 'paid');
  if (paidBills.length > 0 && paidBills.length >= monthBills.length * 0.5) {
    tips.push({
      icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
      title: `Parabens! ${paidBills.length} de ${monthBills.length} contas pagas`,
      body: `Voce ja quitou ${((paidBills.length / monthBills.length) * 100).toFixed(0)}% das contas do mes. ${monthBills.length - paidBills.length > 0 ? `Faltam apenas ${monthBills.length - paidBills.length} conta(s).` : 'Todas as contas estao em dia!'}`,
      priority: 'low',
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 19. INVESTMENT SUGGESTION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (totalSalary > 0) {
    const freeAmount = Math.max(totalSalary - snap.expensesTotal - totalPending, 0);
    if (freeAmount >= totalSalary * 0.15) {
      tips.push({
        icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
        title: `${formatCurrency(freeAmount)} livres — considere investir`,
        body: `Com ${((freeAmount / totalSalary) * 100).toFixed(0)}% sobrando, considere: Tesouro Direto (seguro), CDB (liquidez), ou fundos. Dinheiro parado perde valor com a inflacao (~6% ao ano).`,
        priority: 'low',
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 20. NO DATA YET — encourage input
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (tips.length === 0) {
    tips.push({
      icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
      title: 'Adicione dados para dicas personalizadas',
      body: 'Cadastre seu salario, contas e lancamentos. Quanto mais dados, mais inteligente o consultor fica!',
      priority: 'low',
    });
  }

  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2 };
  return tips.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ──────────────────────────────────────────────────────────
// Allocation Plan Builder — builds a step-by-step plan from
// real recurring incomes & pending bills/expenses
// ──────────────────────────────────────────────────────────

interface PlanRow {
  date: string;
  source: string;
  received: number;
  destinations: string;
  freeAfter: number;
}

function buildAllocationPlan(state: AppState, monthKey: string): PlanRow[] | null {
  const incomes = state.recurringIncomes.filter((r) => r.active);
  if (incomes.length === 0) return null;

  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build income events for this month
  const incomeEvents = incomes.map((r) => {
    const day = Math.min(r.payDay, daysInMonth);
    const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
    return { date: dateStr, title: r.title, amount: r.amount };
  }).sort((a, b) => a.date.localeCompare(b.date));

  // Get pending bills for this month + next month
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  const relevantBills = state.bills
    .filter((b) =>
      b.status !== 'paid' &&
      (b.dueDate.startsWith(monthKey) || b.dueDate.startsWith(nextMonth)),
    )
    .map((b) => ({ id: b.id, title: b.title, date: b.dueDate, remaining: billRemaining(b) }))
    .filter((b) => b.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (relevantBills.length === 0) return null;

  // Allocate incomes to bills
  const billLeft = new Map<string, number>();
  relevantBills.forEach((b) => billLeft.set(b.id, b.remaining));

  let runningFree = 0;
  const rows: PlanRow[] = [];

  incomeEvents.forEach((inc) => {
    let budget = inc.amount;
    const dests: string[] = [];

    // Pay bills in order of due date
    relevantBills.forEach((bill) => {
      const rem = billLeft.get(bill.id) ?? 0;
      if (rem <= 0 || budget <= 0) return;
      const pay = Math.min(rem, budget);
      billLeft.set(bill.id, rem - pay);
      budget -= pay;
      dests.push(`${formatCurrency(pay)} p/ ${bill.title}`);
    });

    runningFree += budget;
    if (budget > 0) {
      dests.push(`${formatCurrency(budget)} livre`);
    }

    rows.push({
      date: inc.date,
      source: inc.title,
      received: inc.amount,
      destinations: dests.join(' + '),
      freeAfter: runningFree,
    });
  });

  return rows;
}

const priorityClass: Record<string, string> = {
  high: 'tip-high',
  medium: 'tip-medium',
  low: 'tip-low',
};

export function SmartAdvisor({ state, snapshot, monthKey }: Props) {
  const tips = buildTips(state, snapshot, monthKey);
  const plan = buildAllocationPlan(state, monthKey);

  if (tips.length === 0) {
    return (
      <div className="glass-card advisor-card">
        <h2 className="section-title">Consultor Financeiro</h2>
        <p className="empty-text">Adicione seu salario e contas para receber dicas personalizadas.</p>
      </div>
    );
  }

  return (
    <div className="glass-card advisor-card">
      <div className="advisor-header">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h2 className="section-title">Consultor Financeiro ({tips.length} dicas)</h2>
      </div>

      {/* ─── Allocation Plan (from real data) ─── */}
      {plan && plan.length > 0 && (
        <div className="advisor-plan">
          <div className="ap-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="18" height="18">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3>Plano de Distribuicao — Melhor Rota</h3>
          </div>
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Entrada</th>
                  <th>Destino</th>
                  <th className="ap-tr">Livre Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((row, i) => (
                  <tr key={i}>
                    <td className="ap-tm">{formatDate(row.date)}</td>
                    <td>
                      <strong>{formatCurrency(row.received)}</strong>
                      <span className="ap-src">{row.source}</span>
                    </td>
                    <td>{row.destinations}</td>
                    <td className="ap-tr">
                      <strong>{formatCurrency(row.freeAfter)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ap-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
              <path d="M13 16h-1v-4h-1m2-4h.01" />
            </svg>
            Este plano e gerado automaticamente com base nas suas rendas e contas. Use o Sandbox abaixo para testar cenarios alternativos.
          </p>
        </div>
      )}

      <div className="advisor-tips">
        {tips.map((tip, i) => (
          <div key={i} className={`tip-card ${priorityClass[tip.priority]}`}>
            <div className="tip-icon-wrap">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d={tip.icon} />
              </svg>
            </div>
            <div className="tip-body">
              <strong>{tip.title}</strong>
              <p>{tip.body}</p>
            </div>
            <span className={`tip-badge tip-badge-${tip.priority}`}>
              {tip.priority === 'high' ? 'Urgente' : tip.priority === 'medium' ? 'Atencao' : 'Dica'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
