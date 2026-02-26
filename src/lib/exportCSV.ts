import type { AppState } from '../types/finance';
import { CATEGORY_LABELS } from '../types/finance';
import { formatCurrency, formatDate, billPaidTotal, billRemaining, daysUntil } from '../lib/finance';

// ──────────────────────────────────────────────────────
// Premium HTML Report Generator — opens beautifully in
// browser AND prints perfectly on paper (Save as PDF)
// ──────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function exportCSV(state: AppState) {
  const today = new Date();
  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(today);

  // ─── Calculate all metrics ────────────────────
  const totalIn  = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBillsAmount  = state.bills.filter(b => b.type === 'pay').reduce((s, b) => s + b.amount, 0);
  const totalBillsPaid    = state.bills.filter(b => b.type === 'pay').reduce((s, b) => s + billPaidTotal(b), 0);
  const totalBillsPending = state.bills.filter(b => b.type === 'pay').reduce((s, b) => s + billRemaining(b), 0);
  const totalSalary = state.recurringIncomes.filter(r => r.active).reduce((s, r) => s + r.amount, 0);
  const saldo = totalIn - totalOut;
  const goals = state.savingsGoals ?? [];

  // Category breakdown
  const catMap = new Map<string, number>();
  state.transactions.filter(t => t.type === 'expense').forEach(t => catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount));
  state.bills.filter(b => b.type === 'pay').forEach(b => catMap.set(b.category, (catMap.get(b.category) ?? 0) + b.amount));
  const catEntries = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
  const catTotal = catEntries.reduce((s, [, v]) => s + v, 0);

  // Sort
  const sortedTx    = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date));
  const sortedBills = [...state.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NeuroLedger — Relatorio Financeiro</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
:root{--bg:#0a0a0a;--bg2:#111;--text:#e8e8e8;--soft:#888;--faint:#555;--border:rgba(255,255,255,.08);--glow:rgba(255,255,255,.04);--accent:rgba(255,255,255,.12)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;color:var(--text);background:var(--bg);line-height:1.6;padding:0}
@media print{:root{--bg:#fff;--bg2:#f8f8f8;--text:#111;--soft:#555;--faint:#999;--border:#ddd;--glow:#f0f0f0;--accent:#e0e0e0}body{padding:0}.no-print{display:none!important}.report{box-shadow:none;max-width:100%}.section{break-inside:avoid}}
.report{max-width:900px;margin:0 auto;padding:40px 36px}
.header{text-align:center;padding:32px 0 24px;border-bottom:1px solid var(--border);margin-bottom:28px}
.logo{font-size:2.2rem;font-weight:800;letter-spacing:.03em;background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(255,255,255,.4));-webkit-background-clip:text;background-clip:text;color:transparent}
@media print{.logo{color:#111;background:none;-webkit-background-clip:unset}}
.subtitle{color:var(--soft);font-size:.82rem;margin-top:6px;font-weight:300}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
.kpi{padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--glow);text-align:center}
.kpi-label{font-size:.68rem;color:var(--soft);text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.kpi-value{font-size:1.2rem;font-weight:700;margin-top:4px}
.kpi-pos{color:rgba(255,255,255,.95)} .kpi-neg{color:var(--soft)}
@media print{.kpi-pos{color:#1a8}.kpi-neg{color:#b55}}
.section{margin-bottom:28px}
.section-head{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:12px}
.section-title{font-size:.92rem;font-weight:700;letter-spacing:.03em}
.section-count{font-size:.72rem;color:var(--soft);padding:2px 10px;border:1px solid var(--border);border-radius:999px}
table{width:100%;border-collapse:collapse;font-size:.78rem}
thead th{text-align:left;font-weight:600;font-size:.68rem;color:var(--soft);text-transform:uppercase;letter-spacing:.06em;padding:8px 10px;border-bottom:1px solid var(--border);background:var(--glow)}
tbody td{padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
tbody tr:hover{background:var(--glow)} tbody tr:last-child td{border-bottom:none}
.tr{text-align:right} .tc{text-align:center} .tm{color:var(--soft)}
.badge{display:inline-block;font-size:.62rem;padding:2px 8px;border-radius:999px;border:1px solid var(--border);font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.b-paid{border-color:rgba(255,255,255,.2)} .b-pend{color:var(--soft)} .b-part{border-color:rgba(255,255,255,.15)} .b-over{border-color:rgba(255,255,255,.3)}
@media print{.b-paid{color:#1a8;border-color:#1a8}.b-over{color:#c44;border-color:#c44}}
.pbar{width:60px;height:5px;border-radius:99px;background:var(--accent);display:inline-block;vertical-align:middle;overflow:hidden}
.pfill{height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(255,255,255,.3),rgba(255,255,255,.8))}
@media print{.pfill{background:linear-gradient(90deg,#aaa,#333)}}
.cat-grid{display:grid;gap:6px}
.cat-row{display:grid;grid-template-columns:110px 1fr 80px 50px;align-items:center;gap:8px;font-size:.76rem}
.cat-name{color:var(--soft)} .cat-bar{height:6px;border-radius:99px;background:var(--accent);overflow:hidden}
.cat-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(255,255,255,.2),rgba(255,255,255,.75))}
@media print{.cat-fill{background:linear-gradient(90deg,#ddd,#555)}}
.cat-val{text-align:right;font-weight:500} .cat-pct{text-align:right;color:var(--soft);font-size:.68rem}
.inc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.inc-card{padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--glow)}
.inc-card strong{font-size:.84rem;display:block} .inc-card span{font-size:.72rem;color:var(--soft)}
.goal-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}
.goal-row:last-child{border-bottom:none}
.goal-info{flex:1} .goal-info strong{font-size:.82rem;display:block} .goal-info span{font-size:.72rem;color:var(--soft)}
.footer{text-align:center;padding:24px 0;border-top:1px solid var(--border);margin-top:20px}
.footer span{font-size:.68rem;color:var(--faint);letter-spacing:.04em}
.action-bar{display:flex;gap:10px;justify-content:center;margin-bottom:24px}
.btn{font-family:inherit;font-size:.82rem;padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:var(--glow);color:var(--text);cursor:pointer;transition:background 200ms}
.btn:hover{background:var(--accent)}
@media(max-width:700px){.kpi-grid{grid-template-columns:1fr 1fr}.cat-row{grid-template-columns:80px 1fr 60px 40px}}
</style>
</head>
<body>
<div class="report">
  <div class="header">
    <div class="logo">NeuroLedger</div>
    <p class="subtitle">Relat&oacute;rio Financeiro Completo &mdash; ${dateStr}</p>
  </div>
  <div class="action-bar no-print">
    <button class="btn" onclick="window.print()">&#128438; Imprimir / Salvar PDF</button>
    <button class="btn" onclick="window.close()">Fechar</button>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Entradas</div><div class="kpi-value kpi-pos">${formatCurrency(totalIn)}</div></div>
    <div class="kpi"><div class="kpi-label">Sa&iacute;das</div><div class="kpi-value kpi-neg">${formatCurrency(totalOut)}</div></div>
    <div class="kpi"><div class="kpi-label">Saldo L&iacute;quido</div><div class="kpi-value ${saldo >= 0 ? 'kpi-pos' : 'kpi-neg'}">${formatCurrency(saldo)}</div></div>
    <div class="kpi"><div class="kpi-label">Renda Mensal</div><div class="kpi-value">${totalSalary > 0 ? formatCurrency(totalSalary) : 'N/A'}</div></div>
  </div>

  <div class="section">
    <div class="section-head"><span class="section-title">Resumo Financeiro</span></div>
    <table><tbody>
      <tr><td>Total de Entradas (lan&ccedil;amentos)</td><td class="tr">${formatCurrency(totalIn)}</td></tr>
      <tr><td>Total de Sa&iacute;das (lan&ccedil;amentos)</td><td class="tr">${formatCurrency(totalOut)}</td></tr>
      <tr><td>Contas a Pagar (total)</td><td class="tr">${formatCurrency(totalBillsAmount)}</td></tr>
      <tr><td>Contas J&aacute; Pagas</td><td class="tr">${formatCurrency(totalBillsPaid)}</td></tr>
      <tr><td>Contas Pendentes</td><td class="tr">${formatCurrency(totalBillsPending)}</td></tr>
      <tr><td>Meta Mensal de Gastos</td><td class="tr">${state.monthlyBudget > 0 ? formatCurrency(state.monthlyBudget) : 'N&atilde;o definida'}</td></tr>
      ${totalSalary > 0 ? `<tr><td>Potencial de Economia</td><td class="tr">${formatCurrency(Math.max(totalSalary - totalOut - totalBillsPending, 0))}</td></tr>` : ''}
    </tbody></table>
  </div>

  ${state.recurringIncomes.length > 0 ? `
  <div class="section">
    <div class="section-head"><span class="section-title">Fontes de Renda</span><span class="section-count">${state.recurringIncomes.length} fonte(s)</span></div>
    <div class="inc-grid">${state.recurringIncomes.map(r => `
      <div class="inc-card"><strong>${esc(r.title)}</strong><span>${formatCurrency(r.amount)} &middot; Dia ${r.payDay} &middot; ${r.frequency === 'monthly' ? 'Mensal' : r.frequency === 'biweekly' ? 'Quinzenal' : 'Semanal'}${!r.active ? ' (Inativo)' : ''}</span></div>
    `).join('')}</div>
  </div>` : ''}

  ${catEntries.length > 0 ? `
  <div class="section">
    <div class="section-head"><span class="section-title">Gastos por Categoria</span><span class="section-count">Total: ${formatCurrency(catTotal)}</span></div>
    <div class="cat-grid">${catEntries.map(([cat, val]) => {
      const pct = catTotal > 0 ? ((val / catTotal) * 100) : 0;
      return `<div class="cat-row"><span class="cat-name">${CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}</span><div class="cat-bar"><div class="cat-fill" style="width:${pct}%"></div></div><span class="cat-val">${formatCurrency(val)}</span><span class="cat-pct">${pct.toFixed(0)}%</span></div>`;
    }).join('')}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-head"><span class="section-title">Lan&ccedil;amentos</span><span class="section-count">${state.transactions.length} registro(s)</span></div>
    ${state.transactions.length === 0 ? '<p style="color:var(--soft);font-size:.82rem">Nenhum lan&ccedil;amento registrado.</p>' : `
    <table>
      <thead><tr><th>Data</th><th>Descri&ccedil;&atilde;o</th><th>Categoria</th><th>Tipo</th><th class="tr">Valor</th></tr></thead>
      <tbody>${sortedTx.map(t => `<tr><td class="tm">${formatDate(t.date)}</td><td>${esc(t.title)}</td><td class="tm">${CATEGORY_LABELS[t.category]}</td><td><span class="badge">${t.type === 'income' ? 'Entrada' : 'Sa&iacute;da'}</span></td><td class="tr">${formatCurrency(t.amount)}</td></tr>`).join('')}
      <tr style="font-weight:700;border-top:2px solid var(--border)"><td colspan="4">Subtotal Entradas / Sa&iacute;das</td><td class="tr">${formatCurrency(totalIn)} / ${formatCurrency(totalOut)}</td></tr>
      </tbody>
    </table>`}
  </div>

  <div class="section">
    <div class="section-head"><span class="section-title">Contas Programadas</span><span class="section-count">${state.bills.length} conta(s)</span></div>
    ${state.bills.length === 0 ? '<p style="color:var(--soft);font-size:.82rem">Nenhuma conta registrada.</p>' : `
    <table>
      <thead><tr><th>Venc.</th><th>Descri&ccedil;&atilde;o</th><th>Categoria</th><th class="tr">Total</th><th class="tr">Pago</th><th class="tr">Pendente</th><th class="tc">Progresso</th><th class="tc">Status</th></tr></thead>
      <tbody>${sortedBills.map(b => {
        const paid = billPaidTotal(b); const rem = billRemaining(b);
        const pct = b.amount > 0 ? Math.min((paid / b.amount) * 100, 100) : 100;
        const overdue = b.status !== 'paid' && daysUntil(b.dueDate) < 0;
        const sl = b.status === 'paid' ? 'Pago' : b.status === 'partial' ? 'Parcial' : overdue ? 'Atrasado' : 'Pendente';
        const bc = b.status === 'paid' ? 'b-paid' : overdue ? 'b-over' : b.status === 'partial' ? 'b-part' : 'b-pend';
        return `<tr><td class="tm">${formatDate(b.dueDate)}</td><td>${esc(b.title)}</td><td class="tm">${CATEGORY_LABELS[b.category]}</td><td class="tr">${formatCurrency(b.amount)}</td><td class="tr">${formatCurrency(paid)}</td><td class="tr">${formatCurrency(rem)}</td><td class="tc"><div class="pbar"><div class="pfill" style="width:${pct}%"></div></div> ${pct.toFixed(0)}%</td><td class="tc"><span class="badge ${bc}">${sl}</span></td></tr>`;
      }).join('')}
      <tr style="font-weight:700;border-top:2px solid var(--border)"><td colspan="3">Totais</td><td class="tr">${formatCurrency(totalBillsAmount)}</td><td class="tr">${formatCurrency(totalBillsPaid)}</td><td class="tr">${formatCurrency(totalBillsPending)}</td><td colspan="2"></td></tr>
      </tbody>
    </table>`}
  </div>

  ${state.bills.some(b => b.payments.length > 0) ? `
  <div class="section">
    <div class="section-head"><span class="section-title">Hist&oacute;rico de Pagamentos</span></div>
    <table>
      <thead><tr><th>Conta</th><th>Data Pgto</th><th class="tr">Valor</th><th>Obs</th></tr></thead>
      <tbody>${state.bills.filter(b => b.payments.length > 0).flatMap(b => b.payments.map(p => `<tr><td>${esc(b.title)}</td><td class="tm">${formatDate(p.date)}</td><td class="tr">${formatCurrency(p.amount)}</td><td class="tm">${esc(p.notes || '-')}</td></tr>`)).join('')}</tbody>
    </table>
  </div>` : ''}

  ${goals.length > 0 ? `
  <div class="section">
    <div class="section-head"><span class="section-title">Metas de Economia</span></div>
    ${goals.map(g => {
      const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
      return `<div class="goal-row"><div class="goal-info"><strong>${esc(g.title)}</strong><span>${formatCurrency(g.currentAmount)} de ${formatCurrency(g.targetAmount)}${g.deadline ? ` &middot; Prazo: ${formatDate(g.deadline)}` : ''}</span></div><div style="width:100px"><div class="pbar" style="width:100px"><div class="pfill" style="width:${pct}%"></div></div></div><span style="font-size:.78rem;font-weight:600;min-width:40px;text-align:right">${pct.toFixed(0)}%</span></div>`;
    }).join('')}
  </div>` : ''}

  <div class="footer"><span>Gerado automaticamente por NeuroLedger &mdash; ${dateStr}</span></div>
</div>
</body></html>`;

  // Open the premium report in a new browser tab
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
