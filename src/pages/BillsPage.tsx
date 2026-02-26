import { useApp } from '../context/AppContext';
import { PageShell } from '../components/PageShell';
import { BillForm } from '../components/BillForm';
import { BillCard } from '../components/BillCard';
import { getMonthLabel } from '../lib/finance';

export function BillsPage() {
  const { monthKey, monthBills, allActiveBills, addBill, addPaymentToBill, deleteBill } = useApp();

  return (
    <PageShell title="Contas" subtitle={`Gerenciar contas — ${getMonthLabel(monthKey)}`}>
      {/* Form */}
      <section className="glass-layer" style={{ padding: 16, borderRadius: 16 }}>
        <BillForm onCreate={addBill} />
      </section>

      {/* Month bills */}
      <section className="glass-card list-panel">
        <h2 className="section-title">Contas de {getMonthLabel(monthKey)} ({monthBills.length})</h2>
        {monthBills.length === 0 ? (
          <p className="empty-text">Nenhuma conta agendada para este mes.</p>
        ) : (
          <div className="bills-list">
            {monthBills.map((bill) => (
              <BillCard key={bill.id} bill={bill} onAddPayment={addPaymentToBill} onDelete={deleteBill} />
            ))}
          </div>
        )}
      </section>

      {/* All active bills */}
      {allActiveBills.length > 0 && allActiveBills.length !== monthBills.length && (
        <section className="glass-card list-panel">
          <h2 className="section-title">Todas as Contas Pendentes ({allActiveBills.length})</h2>
          <p className="empty-text" style={{ marginBottom: 8 }}>Contas de todos os meses que ainda nao foram pagas.</p>
          <div className="bills-list">
            {allActiveBills.map((bill) => (
              <BillCard key={bill.id} bill={bill} onAddPayment={addPaymentToBill} onDelete={deleteBill} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
