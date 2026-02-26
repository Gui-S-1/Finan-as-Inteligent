import { useState } from 'react';
import type { Category, Transaction, TransactionType } from '../types/finance';
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../types/finance';

type TransactionFormProps = {
  onCreate: (value: Transaction) => void;
};

export function TransactionForm({ onCreate }: TransactionFormProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<Category>('other');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !date) return;

    onCreate({
      id: crypto.randomUUID(),
      title: title.trim(),
      amount: parsedAmount,
      date,
      type,
      category,
    });

    setTitle('');
    setAmount('');
  }

  return (
    <form className="form-panel" onSubmit={submit}>
      <h3 className="panel-title">Novo Lancamento</h3>
      <div className="field-grid">
        <label>
          <span>Titulo</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Salario, aluguel..." />
        </label>
        <label>
          <span>Valor (R$)</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </label>
        <label>
          <span>Data</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <span>Tipo</span>
          <select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="income">Entrada</option>
            <option value="expense">Saida</option>
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
      <button className="btn-primary" type="submit">Adicionar</button>
    </form>
  );
}
