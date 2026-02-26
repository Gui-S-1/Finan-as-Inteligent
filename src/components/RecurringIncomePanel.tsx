import { useState } from 'react';
import { formatCurrency } from '../lib/finance';
import type { RecurringIncome } from '../types/finance';
import { TrashIcon, PlusIcon } from './InlineIcons';

type Props = {
  incomes: RecurringIncome[];
  onAdd: (income: RecurringIncome) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
};

export function RecurringIncomePanel({ incomes, onAdd, onDelete, onToggle }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payDay, setPayDay] = useState('5');
  const [frequency, setFrequency] = useState<RecurringIncome['frequency']>('monthly');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = Number(amount);
    const d = Number(payDay);
    if (!title.trim() || isNaN(a) || a <= 0 || d < 1 || d > 31) return;
    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      amount: a,
      payDay: d,
      frequency,
      active: true,
    });
    setTitle('');
    setAmount('');
    setShowForm(false);
  }

  const totalMonthly = incomes
    .filter((r) => r.active)
    .reduce((s, r) => {
      if (r.frequency === 'monthly') return s + r.amount;
      if (r.frequency === 'biweekly') return s + r.amount * 2;
      return s + r.amount * 4; // weekly
    }, 0);

  return (
    <div className="glass-card income-panel">
      <div className="income-header">
        <div>
          <h2 className="section-title">Fontes de Renda</h2>
          {totalMonthly > 0 && (
            <span className="income-total">Total mensal: {formatCurrency(totalMonthly)}</span>
          )}
        </div>
        <button className="btn-ghost" type="button" onClick={() => setShowForm(!showForm)}>
          <PlusIcon className="icon icon-sm" /> Adicionar
        </button>
      </div>

      {showForm && (
        <form className="income-form" onSubmit={submit}>
          <div className="income-fields">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome (ex: Salario, Freelance...)" />
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor (R$)" />
            <label>
              <span>Dia do pagamento</span>
              <input type="number" min="1" max="31" value={payDay} onChange={(e) => setPayDay(e.target.value)} />
            </label>
            <label>
              <span>Frequencia</span>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringIncome['frequency'])}>
                <option value="monthly">Mensal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="weekly">Semanal</option>
              </select>
            </label>
          </div>
          <button className="btn-primary" type="submit">Cadastrar Renda</button>
        </form>
      )}

      {incomes.length === 0 ? (
        <p className="empty-text">Cadastre seu salario para receber dicas personalizadas de como gastar e economizar.</p>
      ) : (
        <div className="income-list">
          {incomes.map((r) => (
            <div key={r.id} className={`income-item ${!r.active ? 'income-inactive' : ''}`}>
              <button
                className="income-toggle"
                type="button"
                onClick={() => onToggle(r.id)}
                title={r.active ? 'Desativar' : 'Ativar'}
              >
                <div className={`toggle-dot ${r.active ? 'toggle-on' : ''}`} />
              </button>
              <div className="income-info">
                <strong>{r.title}</strong>
                <span>
                  {formatCurrency(r.amount)} · Dia {r.payDay} ·{' '}
                  {r.frequency === 'monthly' ? 'Mensal' : r.frequency === 'biweekly' ? 'Quinzenal' : 'Semanal'}
                </span>
              </div>
              <button className="btn-danger-sm" type="button" onClick={() => onDelete(r.id)}>
                <TrashIcon className="icon icon-sm" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
