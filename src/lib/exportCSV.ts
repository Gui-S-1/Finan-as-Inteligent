import type { AppState } from '../types/finance';
import { CATEGORY_LABELS } from '../types/finance';
import { formatCurrency, formatDate, billPaidTotal, billRemaining } from '../lib/finance';

// Use semicolons as separator — default for Brazilian Excel
const SEP = ';';

function escapeField(value: string): string {
  if (value.includes(SEP) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCSV(state: AppState) {
  const lines: string[] = [];
  const today = new Date();
  const dateStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(today);

  // ─── Header ──────────────────────────────────────
  lines.push(`NEUROLEDGER - RELATORIO FINANCEIRO`);
  lines.push(`Exportado em${SEP}${dateStr}`);
  lines.push(`Meta Mensal${SEP}${formatCurrency(state.monthlyBudget)}`);
  lines.push('');

  // ─── Summary ─────────────────────────────────────
  const totalIn = state.transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = state.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBillsToPay = state.bills.filter((b) => b.type === 'pay').reduce((s, b) => s + b.amount, 0);
  const totalBillsPaid = state.bills.filter((b) => b.type === 'pay').reduce((s, b) => s + billPaidTotal(b), 0);
  const totalBillsPending = state.bills.filter((b) => b.type === 'pay').reduce((s, b) => s + billRemaining(b), 0);

  lines.push('RESUMO GERAL');
  lines.push(`Total de Entradas${SEP}${formatCurrency(totalIn)}`);
  lines.push(`Total de Saidas${SEP}${formatCurrency(totalOut)}`);
  lines.push(`Saldo (lancamentos)${SEP}${formatCurrency(totalIn - totalOut)}`);
  lines.push(`Total de Contas a Pagar${SEP}${formatCurrency(totalBillsToPay)}`);
  lines.push(`Ja Pago (contas)${SEP}${formatCurrency(totalBillsPaid)}`);
  lines.push(`Pendente (contas)${SEP}${formatCurrency(totalBillsPending)}`);
  lines.push('');

  // ─── Transactions ────────────────────────────────
  lines.push('LANCAMENTOS');
  lines.push(['Titulo', 'Tipo', 'Categoria', 'Valor (R$)', 'Data'].join(SEP));

  if (state.transactions.length === 0) {
    lines.push('Nenhum lancamento registrado');
  } else {
    // Sort by date descending (most recent first)
    const sorted = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date));
    sorted.forEach((t) => {
      lines.push([
        escapeField(t.title),
        t.type === 'income' ? 'Entrada' : 'Saida',
        CATEGORY_LABELS[t.category],
        formatCurrency(t.amount),
        formatDate(t.date),
      ].join(SEP));
    });
  }

  lines.push('');

  // ─── Bills ───────────────────────────────────────
  lines.push('CONTAS PROGRAMADAS');
  lines.push(['Titulo', 'Natureza', 'Categoria', 'Valor Total', 'Ja Pago', 'Pendente', 'Vencimento', 'Status'].join(SEP));

  if (state.bills.length === 0) {
    lines.push('Nenhuma conta registrada');
  } else {
    const sortedBills = [...state.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    sortedBills.forEach((b) => {
      const paid = billPaidTotal(b);
      const remaining = billRemaining(b);
      const statusLabel = b.status === 'paid' ? 'Pago' : b.status === 'partial' ? 'Parcial' : 'Pendente';
      lines.push([
        escapeField(b.title),
        b.type === 'pay' ? 'Pagar' : 'Receber',
        CATEGORY_LABELS[b.category],
        formatCurrency(b.amount),
        formatCurrency(paid),
        formatCurrency(remaining),
        formatDate(b.dueDate),
        statusLabel,
      ].join(SEP));
    });
  }

  lines.push('');

  // ─── Payment details per bill ────────────────────
  const billsWithPayments = state.bills.filter((b) => b.payments.length > 0);
  if (billsWithPayments.length > 0) {
    lines.push('HISTORICO DE PAGAMENTOS');
    lines.push(['Conta', 'Data Pagamento', 'Valor Pago', 'Observacao'].join(SEP));
    billsWithPayments.forEach((b) => {
      b.payments.forEach((p) => {
        lines.push([
          escapeField(b.title),
          formatDate(p.date),
          formatCurrency(p.amount),
          escapeField(p.notes || '-'),
        ].join(SEP));
      });
    });
    lines.push('');
  }

  lines.push(`Gerado por NeuroLedger`);

  // UTF-8 BOM + content — ensures Excel reads accents correctly
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neuroledger-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
