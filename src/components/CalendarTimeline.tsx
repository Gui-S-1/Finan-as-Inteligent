import type { Bill, Transaction } from '../types/finance';
import { getDaysInMonth, isSameMonth } from '../lib/finance';

type CalendarTimelineProps = {
  monthKey: string;
  bills: Bill[];
  transactions: Transaction[];
};

export function CalendarTimeline({ monthKey, bills, transactions }: CalendarTimelineProps) {
  const totalDays = getDaysInMonth(monthKey);
  const today = new Date();
  const todayDay = today.getFullYear() === Number(monthKey.slice(0, 4)) && today.getMonth() + 1 === Number(monthKey.slice(5, 7)) ? today.getDate() : -1;

  const monthBills = bills.filter((b) => isSameMonth(b.dueDate, monthKey));
  const monthTx = transactions.filter((t) => isSameMonth(t.date, monthKey));

  /* build day → markers map */
  const dayMarkers = new Map<number, { pay: number; receive: number; income: number; expense: number }>();
  for (let d = 1; d <= totalDays; d++) {
    dayMarkers.set(d, { pay: 0, receive: 0, income: 0, expense: 0 });
  }

  monthBills.forEach((b) => {
    const day = new Date(b.dueDate + 'T00:00:00').getDate();
    const m = dayMarkers.get(day)!;
    if (b.type === 'pay' && b.status !== 'paid') m.pay++;
    if (b.type === 'receive' && b.status !== 'paid') m.receive++;
  });

  monthTx.forEach((t) => {
    const day = new Date(t.date + 'T00:00:00').getDate();
    const m = dayMarkers.get(day)!;
    if (t.type === 'income') m.income++;
    else m.expense++;
  });

  return (
    <div className="glass-card calendar-card">
      <h2 className="section-title">Timeline do Mes</h2>
      <div className="cal-grid">
        {Array.from({ length: totalDays }, (_, i) => {
          const day = i + 1;
          const m = dayMarkers.get(day)!;
          const isToday = day === todayDay;
          const hasActivity = m.pay > 0 || m.receive > 0 || m.income > 0 || m.expense > 0;

          return (
            <div key={day} className={`cal-day${isToday ? ' cal-today' : ''}${hasActivity ? ' cal-active' : ''}`}>
              <span className="cal-num">{String(day).padStart(2, '0')}</span>
              <div className="cal-dots">
                {m.pay > 0 && <span className="cal-dot dot-pay" title={`${m.pay} conta(s) a pagar`} />}
                {m.receive > 0 && <span className="cal-dot dot-receive" title={`${m.receive} a receber`} />}
                {m.income > 0 && <span className="cal-dot dot-income" title={`${m.income} entrada(s)`} />}
                {m.expense > 0 && <span className="cal-dot dot-expense" title={`${m.expense} saida(s)`} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="cal-legend">
        <span><span className="cal-dot dot-pay" /> Pagar</span>
        <span><span className="cal-dot dot-receive" /> Receber</span>
        <span><span className="cal-dot dot-income" /> Entrada</span>
        <span><span className="cal-dot dot-expense" /> Saida</span>
      </div>
    </div>
  );
}
