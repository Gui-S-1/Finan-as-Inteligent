import type { AppState } from '../types/finance';
import { CATEGORY_LABELS } from '../types/finance';
import { formatCurrency, formatDate } from '../lib/finance';

export function exportCSV(state: AppState) {
  const lines: string[] = [];

  // Transactions
  lines.push('--- LANCAMENTOS ---');
  lines.push('Titulo,Tipo,Categoria,Valor,Data');
  state.transactions.forEach((t) => {
    lines.push(
      `"${t.title}",${t.type === 'income' ? 'Entrada' : 'Saida'},${CATEGORY_LABELS[t.category]},${t.amount},${formatDate(t.date)}`
    );
  });

  lines.push('');
  lines.push('--- CONTAS ---');
  lines.push('Titulo,Tipo,Categoria,Valor Total,Vencimento,Status,Pago');
  state.bills.forEach((b) => {
    const paid = b.payments.reduce((s, p) => s + p.amount, 0);
    lines.push(
      `"${b.title}",${b.type === 'pay' ? 'Pagar' : 'Receber'},${CATEGORY_LABELS[b.category]},${b.amount},${formatDate(b.dueDate)},${b.status},${paid}`
    );
  });

  lines.push('');
  lines.push(`Meta mensal: ${formatCurrency(state.monthlyBudget)}`);

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neuroledger-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
