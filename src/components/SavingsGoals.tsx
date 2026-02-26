import { useState } from 'react';
import { formatCurrency } from '../lib/finance';
import type { SavingsGoal } from '../types/finance';
import { TrashIcon, PlusIcon } from './InlineIcons';

type Props = {
  goals: SavingsGoal[];
  onAdd: (goal: SavingsGoal) => void;
  onUpdate: (id: string, amount: number) => void;
  onDelete: (id: string) => void;
};

export function SavingsGoals({ goals, onAdd, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = Number(target);
    if (!title.trim() || isNaN(t) || t <= 0) return;
    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      targetAmount: t,
      currentAmount: 0,
      deadline: deadline || undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setTitle('');
    setTarget('');
    setDeadline('');
    setShowForm(false);
  }

  function handleDeposit(goalId: string) {
    const val = Number(depositAmounts[goalId] || 0);
    if (val > 0) {
      onUpdate(goalId, val);
      setDepositAmounts((prev) => ({ ...prev, [goalId]: '' }));
    }
  }

  return (
    <div className="glass-card goals-card">
      <div className="goals-header">
        <h2 className="section-title">Metas de Economia ({goals.length})</h2>
        <button className="btn-ghost" type="button" onClick={() => setShowForm(!showForm)}>
          <PlusIcon className="icon icon-sm" /> Nova Meta
        </button>
      </div>

      {showForm && (
        <form className="goal-form" onSubmit={submit}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da meta (ex: Reserva, Viagem...)" />
          <input type="number" min="0" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Valor alvo (R$)" />
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <button className="btn-primary" type="submit">Criar Meta</button>
        </form>
      )}

      {goals.length === 0 ? (
        <p className="empty-text">Nenhuma meta criada. Comece definindo uma reserva de emergencia!</p>
      ) : (
        <div className="goals-list">
          {goals.map((g) => {
            const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
            const remaining = Math.max(g.targetAmount - g.currentAmount, 0);
            const isComplete = pct >= 100;

            let monthsLeft = '';
            if (g.deadline) {
              const diff = (new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
              if (diff > 0 && remaining > 0) {
                monthsLeft = `${formatCurrency(remaining / Math.ceil(diff))}/mes`;
              }
            }

            return (
              <div key={g.id} className={`goal-item ${isComplete ? 'goal-complete' : ''}`}>
                <div className="goal-top">
                  <div>
                    <strong>{g.title}</strong>
                    <span className="goal-sub">
                      {formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}
                      {monthsLeft && ` · Precisa: ${monthsLeft}`}
                    </span>
                  </div>
                  <button className="btn-danger-sm" type="button" onClick={() => onDelete(g.id)}>
                    <TrashIcon className="icon icon-sm" />
                  </button>
                </div>

                <div className="goal-progress">
                  <div className="goal-bar-track">
                    <div className="goal-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="goal-pct">{pct.toFixed(0)}%</span>
                </div>

                {!isComplete && (
                  <div className="goal-deposit">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Depositar R$"
                      value={depositAmounts[g.id] || ''}
                      onChange={(e) => setDepositAmounts((prev) => ({ ...prev, [g.id]: e.target.value }))}
                    />
                    <button className="btn-ghost" type="button" onClick={() => handleDeposit(g.id)}>
                      Depositar
                    </button>
                  </div>
                )}

                {isComplete && (
                  <div className="goal-achieved">
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Meta atingida!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
