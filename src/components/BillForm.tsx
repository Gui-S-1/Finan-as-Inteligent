import { useState } from 'react';
import type { Bill, BillType, Category } from '../types/finance';
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../types/finance';

type BillFormProps = {
  onCreate: (value: Bill) => void;
};

export function BillForm({ onCreate }: BillFormProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<BillType>('pay');
  const [category, setCategory] = useState<Category>('services');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !dueDate) return;

    onCreate({
      id: crypto.randomUUID(),
      title: title.trim(),
      amount: parsedAmount,
      dueDate,
      type,
      category,
      status: 'pending',
      payments: [],
    });

    setTitle('');
    setAmount('');
  }

  return (
    <form className="form-panel" onSubmit={submit}>
      <h3 className="panel-title">Conta Programada</h3>
      <div className="field-grid">
        <label>
          <span>Titulo</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cartao, internet..." />
        </label>
        <label>
          <span>Valor Total (R$)</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </label>
        <label>
          <span>Vencimento</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label>
          <span>Natureza</span>
          <select value={type} onChange={(e) => setType(e.target.value as BillType)}>
            <option value="pay">Pagar</option>
            <option value="receive">Receber</option>
          </select>
        </label>
        <label className="span-2">
          <span>Categoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>
      </div>
      <button className="btn-primary" type="submit">Agendar</button>
    </form>
  );
}
