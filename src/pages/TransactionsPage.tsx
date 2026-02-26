import { useApp } from '../context/AppContext';
import { PageShell } from '../components/PageShell';
import { TransactionForm } from '../components/TransactionForm';
import { TrashIcon } from '../components/InlineIcons';
import { formatCurrency, formatDate, getMonthLabel } from '../lib/finance';
import { CATEGORY_LABELS } from '../types/finance';

export function TransactionsPage() {
  const { monthKey, monthTransactions, addTransaction, deleteTransaction } = useApp();

  return (
    <PageShell title="Lancamentos" subtitle={`Movimentacoes — ${getMonthLabel(monthKey)}`}>
      {/* Form */}
      <section className="glass-layer" style={{ padding: 16, borderRadius: 16 }}>
        <TransactionForm onCreate={addTransaction} />
      </section>

      {/* Transactions list */}
      <section className="glass-card list-panel">
        <h2 className="section-title">Lancamentos do Mes ({monthTransactions.length})</h2>
        {monthTransactions.length === 0 ? (
          <p className="empty-text">Sem movimentacoes no periodo selecionado.</p>
        ) : (
          <ul className="line-list">
            {monthTransactions.map((item) => (
              <li key={item.id} className="line-item">
                <div>
                  <strong>{item.title}</strong>
                  <span>{formatDate(item.date)} — {CATEGORY_LABELS[item.category]}</span>
                </div>
                <div className="line-meta">
                  <span>{item.type === 'income' ? 'Entrada' : 'Saida'}</span>
                  <strong>{formatCurrency(item.amount)}</strong>
                  <button className="btn-danger-sm" type="button" onClick={() => deleteTransaction(item.id)} title="Excluir">
                    <TrashIcon className="icon icon-sm" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
