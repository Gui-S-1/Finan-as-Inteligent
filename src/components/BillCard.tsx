import { useState } from 'react';
import type { Bill, Payment } from '../types/finance';
import { CATEGORY_LABELS } from '../types/finance';
import { billPaidTotal, billProgressPercent, billRemaining, daysUntil, formatCurrency, formatDate } from '../lib/finance';
import { CheckIcon, ChevronIcon, PlusIcon, TrashIcon } from './InlineIcons';

type BillCardProps = {
  bill: Bill;
  onAddPayment: (billId: string, payment: Payment) => void;
  onDelete: (billId: string) => void;
};

export function BillCard({ bill, onAddPayment, onDelete }: BillCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));

  const progress = billProgressPercent(bill);
  const remaining = billRemaining(bill);
  const paid = billPaidTotal(bill);
  const days = daysUntil(bill.dueDate);
  const isOverdue = bill.status !== 'paid' && days < 0;

  function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(payAmount);
    if (Number.isNaN(val) || val <= 0) return;
    onAddPayment(bill.id, {
      id: crypto.randomUUID(),
      amount: val,
      date: payDate,
    });
    setPayAmount('');
  }

  return (
    <div className={`bill-card${isOverdue ? ' bill-overdue' : ''}${bill.status === 'paid' ? ' bill-done' : ''}`}>
      {/* top accent glow */}
      <div className="bill-accent" style={{ width: `${progress}%` }} />

      <div className="bill-header" onClick={() => setExpanded(!expanded)} role="button" tabIndex={0}>
        <div className="bill-info">
          <strong>{bill.title}</strong>
          <span className="bill-cat">{CATEGORY_LABELS[bill.category]}</span>
        </div>
        <div className="bill-amounts">
          <span className="bill-total">{formatCurrency(bill.amount)}</span>
          <span className="bill-status-badge">
            {bill.status === 'paid' ? 'Quitado' : bill.status === 'partial' ? 'Parcial' : 'Pendente'}
          </span>
        </div>
        <ChevronIcon className={`icon chevron-icon${expanded ? ' chevron-open' : ''}`} />
      </div>

      {/* Progress bar */}
      <div className="bill-progress-row">
        <div className="bill-progress-track">
          <div className="bill-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="bill-progress-label">{progress.toFixed(0)}%</span>
      </div>

      {/* Summary line */}
      <div className="bill-summary">
        <span>Venc: {formatDate(bill.dueDate)}</span>
        {bill.status !== 'paid' && (
          <span>{days >= 0 ? `${days}d restante${days !== 1 ? 's' : ''}` : `${Math.abs(days)}d atrasado`}</span>
        )}
        <span>Pago: {formatCurrency(paid)}</span>
        <span>Resta: {formatCurrency(remaining)}</span>
      </div>

      {expanded && (
        <div className="bill-detail">
          {/* Payment history */}
          {bill.payments.length > 0 && (
            <div className="bill-payments">
              <h4 className="detail-title">Pagamentos registrados</h4>
              <ul className="payment-list">
                {bill.payments.map((p) => (
                  <li key={p.id} className="payment-item">
                    <CheckIcon className="icon icon-sm" />
                    <span>{formatDate(p.date)}</span>
                    <strong>{formatCurrency(p.amount)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Add payment form */}
          {bill.status !== 'paid' && (
            <form className="add-payment-form" onSubmit={submitPayment}>
              <h4 className="detail-title">Registrar pagamento</h4>
              <div className="pay-fields">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remaining}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Ate ${formatCurrency(remaining)}`}
                />
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                <button className="btn-ghost" type="submit">
                  <PlusIcon className="icon icon-sm" /> Pagar
                </button>
              </div>
            </form>
          )}

          <button className="btn-danger" type="button" onClick={() => onDelete(bill.id)}>
            <TrashIcon className="icon icon-sm" /> Excluir conta
          </button>
        </div>
      )}
    </div>
  );
}
