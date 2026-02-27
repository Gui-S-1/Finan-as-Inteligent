import { useState, useEffect } from 'react';
import type { FixedExpense, IncomeFrequency, UserProfile } from '../types/user';

interface OnboardingProps {
  username: string;
  onComplete: (profile: UserProfile) => void;
}

const FREQ_LABELS: Record<IncomeFrequency, string> = {
  monthly: 'Mensal (salario)',
  biweekly: 'Quinzenal',
  weekly: 'Semanal',
  daily: 'Diaria',
};

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const EXPENSE_CATEGORIES = [
  { v: 'housing', l: 'Moradia' },
  { v: 'food', l: 'Alimentacao' },
  { v: 'transport', l: 'Transporte' },
  { v: 'health', l: 'Saude' },
  { v: 'education', l: 'Educacao' },
  { v: 'entertainment', l: 'Lazer' },
  { v: 'services', l: 'Servicos' },
  { v: 'other', l: 'Outro' },
];

export function Onboarding({ username, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Step 0 — Personal info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');

  // Step 1 — Income
  const [incomeFreq, setIncomeFreq] = useState<IncomeFrequency>('monthly');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [payDay, setPayDay] = useState('5');
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]); // seg-sex

  // Step 2 — Fixed expenses
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDay, setExpDay] = useState('10');
  const [expCat, setExpCat] = useState('other');

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  function goNext() {
    setTransitioning(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setTransitioning(false);
    }, 300);
  }

  function goBack() {
    setTransitioning(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setTransitioning(false);
    }, 300);
  }

  function addExpense() {
    if (!expTitle.trim() || !expAmount.trim()) return;
    setExpenses((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: expTitle.trim(),
        amount: parseFloat(expAmount),
        dueDay: parseInt(expDay) || 10,
        category: expCat,
      },
    ]);
    setExpTitle('');
    setExpAmount('');
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function finish() {
    const profile: UserProfile = {
      firstName: firstName.trim() || username,
      lastName: lastName.trim(),
      age: parseInt(age) || 0,
      income: {
        type: incomeFreq,
        amount: parseFloat(incomeAmount) || 0,
        payDay: incomeFreq === 'daily' ? workDays.join(',') : parseInt(payDay) || 5,
        workDays: incomeFreq === 'daily' ? workDays : undefined,
      },
      fixedExpenses: expenses,
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
      aiMemory: [],
    };
    onComplete(profile);
  }

  function toggleWorkDay(d: number) {
    setWorkDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="onboard-screen">
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-grid-bg" />
      </div>

      <div className={`onboard-container ${show ? 'login-visible' : ''}`}>
        {/* Header */}
        <div className="onboard-header">
          <div className="login-logo-wrap login-logo-wrap-sm">
            <img src="/icarus.jpg" alt="Icarus" className="login-logo" />
          </div>
          <h2 className="onboard-title">Bem-vindo, {username}</h2>
          <p className="onboard-sub">Vamos configurar seu perfil financeiro</p>
          {/* Progress bar */}
          <div className="onboard-progress-track">
            <div className="onboard-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="onboard-step-label">Etapa {step + 1} de {totalSteps}</span>
        </div>

        {/* Steps */}
        <div className={`onboard-body ${transitioning ? 'onboard-fade-out' : 'onboard-fade-in'}`}>
          {step === 0 && (
            <div className="onboard-step">
              <h3 className="onboard-step-title">Dados pessoais</h3>
              <div className="onboard-fields">
                <div className="onboard-field">
                  <label>Nome</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Seu primeiro nome"
                    className="login-input"
                  />
                </div>
                <div className="onboard-field">
                  <label>Sobrenome</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Seu sobrenome"
                    className="login-input"
                  />
                </div>
                <div className="onboard-field">
                  <label>Idade</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Sua idade"
                    min="10"
                    max="120"
                    className="login-input"
                  />
                </div>
              </div>
              <div className="onboard-actions">
                <button
                  className="login-btn"
                  onClick={goNext}
                  disabled={!firstName.trim()}
                >
                  Proximo
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="login-btn-arrow">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="onboard-step">
              <h3 className="onboard-step-title">Como voce ganha dinheiro?</h3>
              <div className="onboard-fields">
                <div className="onboard-field">
                  <label>Frequencia de pagamento</label>
                  <div className="onboard-freq-grid">
                    {(Object.keys(FREQ_LABELS) as IncomeFrequency[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`onboard-freq-btn ${incomeFreq === f ? 'onboard-freq-active' : ''}`}
                        onClick={() => setIncomeFreq(f)}
                      >
                        {FREQ_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="onboard-field">
                  <label>
                    {incomeFreq === 'daily'
                      ? 'Quanto ganha por dia?'
                      : incomeFreq === 'weekly'
                        ? 'Quanto ganha por semana?'
                        : incomeFreq === 'biweekly'
                          ? 'Quanto ganha por quinzena?'
                          : 'Quanto ganha por mes?'}
                  </label>
                  <input
                    type="number"
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                    placeholder="Ex: 3500"
                    min="0"
                    step="0.01"
                    className="login-input"
                  />
                </div>

                {incomeFreq === 'daily' ? (
                  <div className="onboard-field">
                    <label>Quais dias voce trabalha?</label>
                    <div className="onboard-weekdays">
                      {WEEK_DAYS.map((d, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`onboard-day-btn ${workDays.includes(i) ? 'onboard-day-active' : ''}`}
                          onClick={() => toggleWorkDay(i)}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <p className="onboard-hint">
                      Renda estimada mensal: R$ {((parseFloat(incomeAmount) || 0) * workDays.length * 4.33).toFixed(2)}
                    </p>
                  </div>
                ) : incomeFreq === 'weekly' ? (
                  <div className="onboard-field">
                    <label>Qual dia da semana recebe?</label>
                    <div className="onboard-weekdays">
                      {WEEK_DAYS.map((d, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`onboard-day-btn ${parseInt(payDay) === i ? 'onboard-day-active' : ''}`}
                          onClick={() => setPayDay(String(i))}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="onboard-field">
                    <label>
                      {incomeFreq === 'biweekly'
                        ? 'Dias do mes que recebe (ex: 5 e 20)'
                        : 'Dia do mes que recebe'}
                    </label>
                    <input
                      type="number"
                      value={payDay}
                      onChange={(e) => setPayDay(e.target.value)}
                      placeholder="Ex: 5"
                      min="1"
                      max="31"
                      className="login-input"
                    />
                  </div>
                )}
              </div>
              <div className="onboard-actions onboard-actions-split">
                <button type="button" className="onboard-back-btn" onClick={goBack}>
                  Voltar
                </button>
                <button
                  className="login-btn"
                  onClick={goNext}
                  disabled={!incomeAmount.trim()}
                >
                  Proximo
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="login-btn-arrow">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboard-step">
              <h3 className="onboard-step-title">Gastos fixos mensais</h3>
              <p className="onboard-hint" style={{ marginBottom: 12 }}>
                Cadastre contas recorrentes como aluguel, luz, internet, etc.
              </p>

              {/* Add form */}
              <div className="onboard-expense-form">
                <input
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Nome (ex: Aluguel)"
                  className="login-input"
                />
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="R$ valor"
                  min="0"
                  step="0.01"
                  className="login-input"
                />
                <input
                  type="number"
                  value={expDay}
                  onChange={(e) => setExpDay(e.target.value)}
                  placeholder="Dia venc."
                  min="1"
                  max="31"
                  className="login-input onboard-exp-day"
                />
                <select
                  value={expCat}
                  onChange={(e) => setExpCat(e.target.value)}
                  className="login-input"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.v} value={c.v}>{c.l}</option>
                  ))}
                </select>
                <button type="button" className="onboard-add-btn" onClick={addExpense}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>

              {/* List */}
              {expenses.length > 0 && (
                <div className="onboard-expense-list">
                  {expenses.map((ex) => (
                    <div key={ex.id} className="onboard-expense-item">
                      <span className="onboard-exp-name">{ex.title}</span>
                      <span className="onboard-exp-val">R$ {ex.amount.toFixed(2)}</span>
                      <span className="onboard-exp-day-tag">dia {ex.dueDay}</span>
                      <button
                        type="button"
                        className="onboard-exp-del"
                        onClick={() => removeExpense(ex.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="onboard-expense-total">
                    Total fixo: R$ {expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}/mes
                  </div>
                </div>
              )}

              <div className="onboard-actions onboard-actions-split">
                <button type="button" className="onboard-back-btn" onClick={goBack}>
                  Voltar
                </button>
                <button className="login-btn" onClick={finish}>
                  Finalizar
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="login-btn-arrow">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <p className="onboard-hint" style={{ marginTop: 8, textAlign: 'center' }}>
                Voce pode alterar esses dados depois. Caso faca compras, entre no app e adicione.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
