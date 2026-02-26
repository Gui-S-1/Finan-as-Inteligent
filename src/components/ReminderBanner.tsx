import { daysUntil, formatCurrency } from '../lib/finance';
import type { Bill } from '../types/finance';
import { AlertIcon, ClockIcon } from './InlineIcons';

type ReminderBannerProps = {
  overdueBills: Bill[];
  upcomingBills: Bill[];
};

export function ReminderBanner({ overdueBills, upcomingBills }: ReminderBannerProps) {
  const urgentBills = upcomingBills.filter((b) => daysUntil(b.dueDate) <= 3);
  const hasAlerts = overdueBills.length > 0 || urgentBills.length > 0;

  if (!hasAlerts) return null;

  return (
    <div className="reminder-banner glass-card">
      <div className="reminder-glow" />
      {overdueBills.length > 0 && (
        <div className="reminder-section reminder-overdue">
          <AlertIcon className="icon" />
          <div>
            <strong>{overdueBills.length} conta{overdueBills.length > 1 ? 's' : ''} atrasada{overdueBills.length > 1 ? 's' : ''}</strong>
            <div className="reminder-items">
              {overdueBills.slice(0, 3).map((b) => (
                <span key={b.id}>{b.title} — {formatCurrency(b.amount)} ({Math.abs(daysUntil(b.dueDate))}d atras)</span>
              ))}
            </div>
          </div>
        </div>
      )}
      {urgentBills.length > 0 && (
        <div className="reminder-section">
          <ClockIcon className="icon" />
          <div>
            <strong>{urgentBills.length} conta{urgentBills.length > 1 ? 's' : ''} vence{urgentBills.length > 1 ? 'm' : ''} em ate 3 dias</strong>
            <div className="reminder-items">
              {urgentBills.slice(0, 3).map((b) => (
                <span key={b.id}>{b.title} — {formatCurrency(b.amount)} (dia {new Date(b.dueDate + 'T00:00:00').getDate()})</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Request browser notification permission on first call */
let notifRequested = false;
export function requestNotificationPermission() {
  if (notifRequested || !('Notification' in window)) return;
  notifRequested = true;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendBillReminder(bill: Bill) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const days = daysUntil(bill.dueDate);
  const body = days < 0
    ? `${bill.title}: ${formatCurrency(bill.amount)} esta atrasada ${Math.abs(days)} dia(s)!`
    : `${bill.title}: ${formatCurrency(bill.amount)} vence em ${days} dia(s).`;
  new Notification('NeuroLedger — Lembrete', { body, icon: '/vite.svg' });
}
