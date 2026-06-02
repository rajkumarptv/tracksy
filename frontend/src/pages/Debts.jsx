import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';
import { walletsAPI } from '../services/api';
import { Topbar, PageLoader, EmptyState } from '../components/ui';
import { Plus, CreditCard, TrendingDown, X, ChevronRight, AlertCircle } from 'lucide-react';
import { useFmt as useFmtHook, useT } from '../i18n';

const DEBT_TYPES = ['visa', 'mastercard', 'loan', 'lending'];

const TYPE_META = {
  visa:       { icon: '💳', label: 'Credit Card',   color: '#FF5B5B', bg: 'rgba(255,91,91,.12)'  },
  mastercard: { icon: '💳', label: 'Credit Card',   color: '#FF5B5B', bg: 'rgba(255,91,91,.12)'  },
  loan:       { icon: '📋', label: 'Loan',           color: '#FFB84D', bg: 'rgba(255,184,77,.12)' },
  lending:    { icon: '🤝', label: 'Lent to Someone',color: '#5B8CFF', bg: 'rgba(91,140,255,.12)' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Local helper kept for schedule/table only (not currency display)
function fmtLocal(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Amortization helper ─────────────────────────────────── */
function buildSchedule(principal, annualRate, emiAmount, emiDay, months = 12) {
  const r = annualRate / 100 / 12;
  let bal = principal;
  const rows = [];
  for (let i = 1; i <= months && bal > 0; i++) {
    const interest = bal * r;
    const principalPaid = Math.min(emiAmount - interest, bal);
    bal = Math.max(0, bal - principalPaid);
    const d = new Date();
    d.setMonth(d.getMonth() + i - 1);
    d.setDate(emiDay || 1);
    rows.push({
      month: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      emi: emiAmount,
      interest: parseFloat(interest.toFixed(2)),
      principal: parseFloat(principalPaid.toFixed(2)),
      balance: parseFloat(bal.toFixed(2)),
    });
  }
  return rows;
}

export default function Debts() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fmt = useFmtHook();
  const t = useT();
  const [showModal, setShowModal] = useState(false);
  const [editDebt, setEditDebt] = useState(null);
  const [activeDebt, setActiveDebt] = useState(null);
  const [filterType, setFilterType] = useState('all');

  const { data: allWallets, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsAPI.getAll().then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => walletsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wallets'] }); setActiveDebt(null); },
  });

  if (isLoading) return <PageLoader />;

  const debts = (allWallets || []).filter(w => DEBT_TYPES.includes(w.type));
  const filtered = filterType === 'all' ? debts
    : filterType === 'card' ? debts.filter(w => ['visa','mastercard'].includes(w.type))
    : debts.filter(w => w.type === filterType);

  const totalDebt   = debts.reduce((s, w) => s + Math.abs(parseFloat(w.balance || 0)), 0);
  const cards       = debts.filter(w => ['visa','mastercard'].includes(w.type));
  const loans       = debts.filter(w => w.type === 'loan');
  const estMonthly  = loans.reduce((s, w) => s + parseFloat(w.emi_amount || 0), 0)
                    + cards.reduce((s, w) => s + Math.abs(parseFloat(w.balance || 0)) * 0.02, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Mobile header */}
      <div className="mob-header">
        <div>
          <div className="mob-header-title">{t('debts_title')}</div>
          <div className="mob-header-sub">{t('debts_sub')}</div>
        </div>
      </div>

      {/* Desktop topbar */}
      <div className="mob-hide">
        <Topbar title={t('debts_title')} subtitle={t('debts_sub')}>
          <button className="btn btn-primary btn-sm"
            style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#FF5B5B,#FF79A8)', border:'none', boxShadow:'0 4px 14px rgba(255,91,91,.35)' }}
            onClick={() => { setEditDebt(null); setShowModal(true); }}>
            <Plus size={13} /> {t('debts_add')}
          </button>
        </Topbar>
      </div>

      <div className="mob-content" style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>

        {/* Summary Cards */}
        <div className="mob-summary-scroll" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
          {[
            { label:t('wallet_total_debt'),  value: fmt(totalDebt,{noDecimals:true}),   sub:`${debts.length} active`, icon:<CreditCard size={22} color="#FF5B5B"/>,  bg:'rgba(255,91,91,.1)',   vc:'#FF5B5B' },
            { label:t('debts_credit'),       value: fmt(cards.reduce((s,w)=>s+Math.abs(parseFloat(w.balance||0)),0),{noDecimals:true}), sub:`${cards.length} cards`, icon:<span style={{fontSize:22}}>💳</span>, bg:'rgba(255,91,91,.08)', vc:'var(--text)' },
            { label:t('debts_loans'),        value: fmt(loans.reduce((s,w)=>s+Math.abs(parseFloat(w.balance||0)),0),{noDecimals:true}), sub:`${loans.length} loans`, icon:<span style={{fontSize:22}}>📋</span>, bg:'rgba(255,184,77,.1)',  vc:'var(--text)' },
            { label:'Est. Monthly',          value: fmt(estMonthly,{noDecimals:true}),  sub:'EMIs + min payments',   icon:<TrendingDown size={22} color="#6C63FF"/>, bg:'rgba(108,99,255,.1)', vc:'var(--text)' },
          ].map(({ label, value, sub, icon, bg, vc }) => (
            <div key={label} style={{ background:'var(--surface)', borderRadius:20, padding:'16px 14px', boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:13, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:2 }}>{label}</div>
                <div className="mono" style={{ fontSize:16, fontWeight:800, color:vc, marginBottom:2 }}>{value}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="mob-chips" style={{ display:'flex', gap:8, marginBottom:22 }}>
          {[{v:'all',l:t('debts_all_filter')},{v:'card',l:t('debts_credit')},{v:'loan',l:t('debts_loans')},{v:'lending',l:t('debts_lending')}].map(({ v, l }) => (
            <button key={v} onClick={() => setFilterType(v)}
              style={{ padding:'7px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', border: filterType===v?'1.5px solid var(--accent)':'1.5px solid var(--border)', background: filterType===v?'var(--accent-light)':'var(--surface)', color: filterType===v?'var(--accent)':'var(--text3)', transition:'all .15s', whiteSpace:'nowrap' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Debt list */}
        {filtered.length === 0 ? (
          <div style={{ background:'var(--surface)', borderRadius:20, boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)' }}>
            <EmptyState icon="🎉"
              title={debts.length===0 ? t('debts_empty') : t('debts_empty')}
              description={debts.length===0 ? t('debts_empty_desc') : t('debts_empty_desc')}
              action={debts.length===0 && (
                <button className="btn btn-primary" style={{ background:'linear-gradient(135deg,#FF5B5B,#FF79A8)', border:'none' }} onClick={() => setShowModal(true)}>
                  {t('debts_add')}
                </button>
              )}
            />
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {filtered.map(w => {
              const meta  = TYPE_META[w.type] || TYPE_META.loan;
              const bal   = Math.abs(parseFloat(w.balance || 0));
              const isCard = ['visa','mastercard'].includes(w.type);
              const limit  = parseFloat(w.credit_limit || 0);
              const utilPct = isCard && limit > 0 ? Math.round((bal / limit) * 100) : 0;
              const totalLoan = parseFloat(w.total_loan_amount || bal);
              const paidPct   = !isCard && totalLoan > 0 ? Math.max(0, Math.round(((totalLoan - bal) / totalLoan) * 100)) : 0;

              const utilColor = utilPct > 80 ? '#FF5B5B' : utilPct > 50 ? '#FFB84D' : '#37D67A';
              const utilBg    = utilPct > 80 ? 'rgba(255,91,91,.1)' : utilPct > 50 ? 'rgba(255,184,77,.1)' : 'rgba(55,214,122,.1)';

              return (
                <div key={w.id} style={{
                  background:'var(--surface)', borderRadius:20,
                  boxShadow:'0 4px 24px rgba(108,99,255,.08)',
                  border:'1px solid var(--border-light)',
                  overflow:'hidden', transition:'all .2s ease',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform=''}>

                  {/* ── TOP ACCENT BAR ── */}
                  <div style={{ height:4, background:`linear-gradient(90deg,${meta.color},${meta.color}88)` }}/>

                  <div style={{ padding:'18px 22px' }}>

                    {/* ── ROW 1: Identity + actions ── */}
                    <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>

                      {/* Icon */}
                      <div style={{ width:46, height:46, borderRadius:13, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                        {meta.icon}
                      </div>

                      {/* Name + badges */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:5 }}>
                          {w.name}{w.last_four ? ` *${w.last_four}` : ''}
                        </div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:meta.bg, color:meta.color }}>{meta.label}</span>
                          {isCard && limit > 0 && (
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:utilBg, color:utilColor }}>
                              {utilPct}% utilised
                            </span>
                          )}
                          {!isCard && w.interest_rate && (
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, background:'rgba(255,184,77,.1)', color:'#FFB84D' }}>
                              {w.interest_rate}% p.a.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions — right aligned */}
                      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                        <button onClick={() => setActiveDebt(w)}
                          style={{ background:'var(--accent-light)', border:'1.5px solid var(--accent)', borderRadius:10, cursor:'pointer', padding:'7px 16px', fontSize:12.5, color:'var(--accent)', fontWeight:700, whiteSpace:'nowrap' }}>
                          View Details
                        </button>
                        <button onClick={() => { setEditDebt(w); setShowModal(true); }}
                          style={{ background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:10, cursor:'pointer', padding:'7px 10px', fontSize:14 }}>
                          ✏️
                        </button>
                        <button onClick={() => { if(confirm(`Delete "${w.name}"?`)) deleteMutation.mutate(w.id); }}
                          style={{ background:'var(--red-light)', border:'1.5px solid rgba(255,91,91,.2)', borderRadius:10, cursor:'pointer', padding:'7px 10px', fontSize:14 }}>
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* ── ROW 2: Key data grid ── */}
                    {isCard ? (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
                        {[
                          { label:'Outstanding', value: fmt(bal),                              color:'#FF5B5B' },
                          { label:'Credit Limit', value: limit > 0 ? fmt(limit) : '—',          color:'var(--text)' },
                          { label:'Available',    value: limit > 0 ? fmt(Math.max(0,limit-bal)) : '—', color:'#37D67A' },
                          { label:'Min. Payment', value: `${fmt(bal*0.02)}/mo`,                 color:'#FFB84D' },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ background:'var(--surface2)', borderRadius:12, padding:'10px 12px' }}>
                            <div style={{ fontSize:10.5, color:'var(--text3)', fontWeight:600, marginBottom:4, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
                            <div className="mono" style={{ fontSize:14, fontWeight:800, color }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    ) : w.type === 'loan' ? (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
                        {[
                          { label:'Remaining',   value: fmt(bal),                                               color:'#FFB84D' },
                          { label:'Orig. Loan',  value: w.total_loan_amount ? fmt(w.total_loan_amount) : '—',   color:'var(--text)' },
                          { label:'Monthly EMI', value: w.emi_amount ? fmt(w.emi_amount) : '—',                 color:'var(--text)' },
                          { label:'EMI Due',     value: w.emi_day ? `${w.emi_day}${['st','nd','rd'][w.emi_day-1]||'th'}` : '—', color:'var(--text)' },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ background:'var(--surface2)', borderRadius:12, padding:'10px 12px' }}>
                            <div style={{ fontSize:10.5, color:'var(--text3)', fontWeight:600, marginBottom:4, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
                            <div className="mono" style={{ fontSize:14, fontWeight:800, color }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:14 }}>
                        {[
                          { label:'Amount Lent', value: fmt(bal),     color:'#5B8CFF' },
                          { label:'Status',      value: 'Outstanding', color:'#FFB84D' },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ background:'var(--surface2)', borderRadius:12, padding:'10px 12px' }}>
                            <div style={{ fontSize:10.5, color:'var(--text3)', fontWeight:600, marginBottom:4, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
                            <div className="mono" style={{ fontSize:14, fontWeight:800, color }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── ROW 3: Due date (card) + progress bar ── */}
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      {isCard && w.due_date && (
                        <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,91,91,.07)', borderRadius:9, padding:'5px 12px', border:'1px solid rgba(255,91,91,.15)', flexShrink:0 }}>
                          <span style={{ fontSize:12 }}>📅</span>
                          <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>Due:</span>
                          <span style={{ fontSize:12, fontWeight:800, color:'#FF5B5B' }}>
                            {new Date(w.due_date).toLocaleDateString('en-US',{ month:'short', day:'numeric' })}
                          </span>
                        </div>
                      )}

                      {/* Progress bar */}
                      {isCard && limit > 0 ? (
                        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ flex:1, height:7, background:'var(--surface3)', borderRadius:20, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${utilPct}%`, background:`linear-gradient(90deg,${utilColor},${utilColor}aa)`, borderRadius:20, transition:'width .6s ease' }}/>
                          </div>
                          <span style={{ fontSize:11.5, fontWeight:700, color:utilColor, flexShrink:0 }}>{utilPct}%</span>
                        </div>
                      ) : w.type === 'loan' && w.total_loan_amount ? (
                        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ flex:1, height:7, background:'var(--surface3)', borderRadius:20, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${paidPct}%`, background:'linear-gradient(90deg,#37D67A,#00CEC9)', borderRadius:20, transition:'width .6s ease' }}/>
                          </div>
                          <span style={{ fontSize:11.5, fontWeight:700, color:'#37D67A', flexShrink:0 }}>{paidPct}% paid</span>
                        </div>
                      ) : null}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tips card */}
        {debts.length > 0 && (
          <div style={{ marginTop:24, borderRadius:20, padding:'20px 24px', background:'linear-gradient(135deg,#6C63FF 0%,#5B8CFF 100%)', boxShadow:'0 8px 32px rgba(108,99,255,.3)', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:32, flexShrink:0 }}>💡</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4 }}>Debt Payoff Strategy</div>
              <div style={{ fontSize:12.5, color:'rgba(255,255,255,.8)', lineHeight:1.5 }}>
                Pay off the <strong style={{color:'#fff'}}>highest-interest debt first</strong> (avalanche) to save the most, or clear the <strong style={{color:'#fff'}}>smallest balance first</strong> (snowball) for quick wins.
              </div>
            </div>
            <button onClick={() => navigate('/goals')}
              style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.3)', borderRadius:12, padding:'8px 16px', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              Set a Goal →
            </button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {activeDebt && (
        <DebtDetailModal
          debt={activeDebt}
          onClose={() => setActiveDebt(null)}
          onEdit={() => { setEditDebt(activeDebt); setActiveDebt(null); setShowModal(true); }}
        />
      )}

      {showModal && (
        <DebtModal
          debt={editDebt}
          onClose={() => { setShowModal(false); setEditDebt(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey:['wallets'] }); setShowModal(false); setEditDebt(null); }}
        />
      )}

      {/* Mobile FAB */}
      <button className="mob-fab mob-fab-red" onClick={() => { setEditDebt(null); setShowModal(true); }}>
        <Plus size={26} color="#fff"/>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DETAIL MODAL — Credit Card dashboard OR Loan EMI schedule
══════════════════════════════════════════════════════════ */
function DebtDetailModal({ debt, onClose, onEdit }) {
  const isCard = ['visa','mastercard'].includes(debt.type);
  const meta   = TYPE_META[debt.type] || TYPE_META.loan;
  const bal    = Math.abs(parseFloat(debt.balance || 0));
  const limit  = parseFloat(debt.credit_limit || 0);
  const utilPct = isCard && limit > 0 ? Math.round((bal / limit) * 100) : 0;
  const availPct = 100 - utilPct;

  /* Loan EMI schedule */
  const principal  = bal;
  const rate       = parseFloat(debt.interest_rate || 0);
  const emi        = parseFloat(debt.emi_amount || 0);
  const emiDay     = parseInt(debt.emi_day || 1);
  const schedule   = debt.type === 'loan' && emi > 0 ? buildSchedule(principal, rate, emi, emiDay, 12) : [];
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalPrincipal = schedule.reduce((s, r) => s + r.principal, 0);

  /* Mock utilization trend for credit card */
  const utilTrend = [65,70,60,75,utilPct,utilPct,utilPct,utilPct,utilPct,utilPct,utilPct,utilPct]
    .slice(0, 6)
    .map((v, i) => ({ month: MONTHS[(new Date().getMonth() - 5 + i + 12) % 12], util: v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: isCard ? 680 : 760, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ width:46, height:46, borderRadius:14, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{meta.icon}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>{debt.name}{debt.last_four ? ` *${debt.last_four}` : ''}</div>
            <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:meta.bg, color:meta.color }}>{meta.label}</span>
          </div>
          <button onClick={onEdit} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:9, cursor:'pointer', padding:'6px 14px', fontSize:12.5, fontWeight:600 }}>✏️ Edit</button>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text3)', padding:4 }}><X size={20}/></button>
        </div>

        {isCard ? <CreditCardDashboard bal={bal} limit={limit} utilPct={utilPct} availPct={availPct} debt={debt} utilTrend={utilTrend} />
                : debt.type === 'loan' ? <LoanDashboard bal={bal} debt={debt} schedule={schedule} totalInterest={totalInterest} totalPrincipal={totalPrincipal} />
                : <LendingDetail debt={debt} bal={bal} />}
      </div>
    </div>
  );
}

/* ── Credit Card Dashboard ─────────────────────────────── */
function CreditCardDashboard({ bal, limit, utilPct, availPct, debt, utilTrend }) {
  const pieData = limit > 0
    ? [{ name:'Used', value: bal }, { name:'Available', value: Math.max(0, limit - bal) }]
    : [{ name:'Outstanding', value: bal }];
  const PIE_COLORS = ['#FF5B5B','#37D67A'];

  return (
    <div>
      {/* Key stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'Outstanding',  v:`${fmt(bal)}`,               c:'#FF5B5B' },
          { l:'Credit Limit', v: limit > 0 ? `${fmt(limit)}` : '—',       c:'var(--text)' },
          { l:'Available',    v: limit > 0 ? `${fmt(Math.max(0,limit-bal))}` : '—', c:'#37D67A' },
          { l:'Utilization',  v: limit > 0 ? `${utilPct}%` : '—',           c: utilPct>80?'#FF5B5B':utilPct>50?'#FFB84D':'#37D67A' },
          { l:'Min. Payment', v:`${fmt(bal*0.02)}`,           c:'#FFB84D' },
          { l:'Due Date',     v: debt.due_date ? new Date(debt.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—', c:'var(--text)' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background:'var(--surface2)', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:4 }}>{l}</div>
            <div className="mono" style={{ fontSize:18, fontWeight:800, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Utilization donut + trend */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>

        {/* Donut */}
        <div style={{ background:'var(--surface2)', borderRadius:16, padding:'18px', textAlign:'center' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', marginBottom:12, textTransform:'uppercase', letterSpacing:'.06em' }}>Credit Utilization</div>
          {limit > 0 ? (
            <>
              <div style={{ position:'relative', height:160 }}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                  <div className="mono" style={{ fontSize:20, fontWeight:900, color: utilPct>80?'#FF5B5B':utilPct>50?'#FFB84D':'#37D67A' }}>{utilPct}%</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>used</div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'center', gap:16, fontSize:11, marginTop:8 }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#FF5B5B', display:'inline-block' }}/> Used {fmt(bal)}</span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#37D67A', display:'inline-block' }}/> Free {fmt(Math.max(0,limit-bal))}</span>
              </div>
            </>
          ) : (
            <div style={{ padding:'40px 0', color:'var(--text3)', fontSize:13 }}>Set credit limit to see utilization</div>
          )}
        </div>

        {/* Utilization trend */}
        <div style={{ background:'var(--surface2)', borderRadius:16, padding:'18px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', marginBottom:12, textTransform:'uppercase', letterSpacing:'.06em' }}>Utilization Trend</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={utilTrend} margin={{ top:5, right:5, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF5B5B" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FF5B5B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
              <Tooltip formatter={v => [`${v}%`, 'Utilization']} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, fontSize:12 }}/>
              <Area type="monotone" dataKey="util" stroke="#FF5B5B" strokeWidth={2} fill="url(#utilGrad)" dot={{ r:3, fill:'#FF5B5B' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payoff tip */}
      {utilPct > 30 && (
        <div style={{ background: utilPct>80?'rgba(255,91,91,.08)':utilPct>50?'rgba(255,184,77,.08)':'rgba(55,214,122,.08)', borderRadius:14, padding:'14px 16px', display:'flex', gap:10, alignItems:'flex-start' }}>
          <AlertCircle size={16} color={utilPct>80?'#FF5B5B':utilPct>50?'#FFB84D':'#37D67A'} style={{ flexShrink:0, marginTop:1 }}/>
          <div style={{ fontSize:12.5, color:'var(--text)', lineHeight:1.5 }}>
            {utilPct > 80
              ? <><b>High utilization!</b> Keeping utilization below 30% helps your credit score. Try to pay down {fmt(bal - limit*0.3)} to reach the 30% threshold.</>
              : utilPct > 50
              ? <><b>Moderate utilization.</b> Paying down {fmt(bal - limit*0.3)} would bring you below 30% — ideal for a healthy credit score.</>
              : <><b>Good utilization.</b> You&apos;re within the healthy 30% range. Keep it up!</>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Loan Dashboard ───────────────────────────────────── */
function LoanDashboard({ bal, debt, schedule, totalInterest, totalPrincipal }) {
  const totalLoan = parseFloat(debt.total_loan_amount || bal);
  const paidPct   = totalLoan > 0 ? Math.max(0, Math.round(((totalLoan - bal) / totalLoan) * 100)) : 0;
  const monthsLeft = schedule.length;

  return (
    <div>
      {/* Key stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'Remaining Balance', v:`${fmt(bal)}`,                          c:'#FFB84D' },
          { l:'Original Loan',     v:`${fmt(totalLoan)}`,                    c:'var(--text)' },
          { l:'Already Paid',      v:`${fmt(Math.max(0,totalLoan-bal))}`,    c:'#37D67A' },
          { l:'Interest Rate',     v: debt.interest_rate ? `${debt.interest_rate}% p.a.` : '—', c:'#FF5B5B' },
          { l:'Monthly EMI',       v: debt.emi_amount ? `${fmt(debt.emi_amount)}` : '—', c:'var(--text)' },
          { l:'EMI Due',           v: debt.emi_day ? `${debt.emi_day}${['st','nd','rd'][debt.emi_day-1]||'th'} of month` : '—', c:'var(--text)' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background:'var(--surface2)', borderRadius:14, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:4 }}>{l}</div>
            <div className="mono" style={{ fontSize:18, fontWeight:800, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Repayment progress */}
      <div style={{ background:'var(--surface2)', borderRadius:16, padding:'18px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Repayment Progress</span>
          <span className="mono" style={{ fontSize:13, fontWeight:700, color:'#37D67A' }}>{paidPct}% paid off</span>
        </div>
        <div style={{ height:10, background:'var(--surface3)', borderRadius:20, overflow:'hidden', marginBottom:8 }}>
          <div style={{ height:'100%', width:`${paidPct}%`, background:'linear-gradient(90deg,#37D67A,#00CEC9)', borderRadius:20, transition:'width .8s ease' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)' }}>
          <span>Paid: {fmt(Math.max(0,totalLoan-bal))}</span>
          <span>Remaining: {fmt(bal)}</span>
        </div>
      </div>

      {schedule.length > 0 && (
        <>
          {/* Principal vs interest chart */}
          <div style={{ background:'var(--surface2)', borderRadius:16, padding:'18px', marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', marginBottom:12, textTransform:'uppercase', letterSpacing:'.06em' }}>EMI Breakdown — Next {monthsLeft} Months</div>
            <div style={{ display:'flex', gap:16, marginBottom:12 }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>Total Interest: <b style={{color:'#FF5B5B'}}>{fmt(totalInterest)}</b></span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>Total Principal: <b style={{color:'#37D67A'}}>{fmt(totalPrincipal)}</b></span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={schedule.slice(0,12)} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, fontSize:12 }} formatter={v => `${fmt(v)}`}/>
                <Legend iconSize={8} wrapperStyle={{ fontSize:11 }}/>
                <Bar dataKey="principal" name="Principal" fill="#37D67A" stackId="a" radius={[0,0,4,4]}/>
                <Bar dataKey="interest"  name="Interest"  fill="#FF5B5B" stackId="a" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* EMI Schedule table */}
          <div style={{ background:'var(--surface2)', borderRadius:16, padding:'18px', maxHeight:280, overflowY:'auto' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', marginBottom:12, textTransform:'uppercase', letterSpacing:'.06em' }}>EMI Schedule</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border-light)' }}>
                  {['Month','EMI','Principal','Interest','Balance'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'6px 8px', color:'var(--text3)', fontWeight:600, fontSize:11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((r, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border-light)', background: i%2===0?'transparent':'var(--surface3)' }}>
                    <td style={{ padding:'7px 8px', fontWeight:600, color:'var(--text)' }}>{r.month}</td>
                    <td style={{ padding:'7px 8px' }} className="mono">{fmt(r.emi)}</td>
                    <td style={{ padding:'7px 8px', color:'#37D67A' }} className="mono">{fmt(r.principal)}</td>
                    <td style={{ padding:'7px 8px', color:'#FF5B5B' }} className="mono">{fmt(r.interest)}</td>
                    <td style={{ padding:'7px 8px', color:'var(--text)' }} className="mono">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {schedule.length === 0 && (
        <div style={{ background:'var(--surface2)', borderRadius:14, padding:'20px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
          💡 Enter interest rate and EMI amount to see the full repayment schedule.
        </div>
      )}
    </div>
  );
}

/* ── Lending Detail ───────────────────────────────────── */
function LendingDetail({ debt, bal }) {
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'Amount Lent',  v:`${fmt(bal)}`,  c:'#5B8CFF' },
          { l:'Status',       v:'Outstanding',   c:'#FFB84D' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background:'var(--surface2)', borderRadius:14, padding:'18px' }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:4 }}>{l}</div>
            <div className="mono" style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'rgba(91,140,255,.08)', borderRadius:14, padding:'16px', fontSize:13, color:'var(--text)', lineHeight:1.6 }}>
        💡 <b>Tip:</b> Record repayments as income transactions linked to this account to track how much has been paid back.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ADD / EDIT MODAL
══════════════════════════════════════════════════════════ */
const DEBT_TYPE_OPTS = [
  { value:'visa',       label:'💳 Visa Credit Card',       color:'#FF5B5B' },
  { value:'mastercard', label:'💳 Mastercard',              color:'#FF5B5B' },
  { value:'loan',       label:'📋 Personal / Bank Loan',   color:'#FFB84D' },
  { value:'lending',    label:'🤝 Money Lent to Someone',  color:'#5B8CFF' },
];

function DebtModal({ debt, onClose, onSaved }) {
  const isCard = debt ? ['visa','mastercard'].includes(debt.type) : false;
  const [form, setForm] = useState({
    name:              debt?.name              || '',
    type:              debt?.type              || 'loan',
    balance:           debt ? Math.abs(parseFloat(debt.balance || 0)).toString() : '',
    last_four:         debt?.last_four         || '',
    currency:          debt?.currency          || 'USD',
    credit_limit:      debt?.credit_limit      ? parseFloat(debt.credit_limit).toString() : '',
    due_date:          debt?.due_date          ? debt.due_date.split('T')[0] : '',
    interest_rate:     debt?.interest_rate     ? parseFloat(debt.interest_rate).toString() : '',
    total_loan_amount: debt?.total_loan_amount ? parseFloat(debt.total_loan_amount).toString() : '',
    emi_amount:        debt?.emi_amount        ? parseFloat(debt.emi_amount).toString() : '',
    emi_day:           debt?.emi_day           ? debt.emi_day.toString() : '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isCardType = ['visa','mastercard'].includes(form.type);
  const isLoan     = form.type === 'loan';

  const mutation = useMutation({
    mutationFn: (data) => debt ? walletsAPI.update(debt.id, data) : walletsAPI.create(data),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.message || 'Error saving'),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.balance || isNaN(parseFloat(form.balance))) { setError('Enter a valid balance'); return; }
    if (isCardType && form.credit_limit && parseFloat(form.balance) > parseFloat(form.credit_limit)) {
      setError('Outstanding cannot exceed credit limit'); return;
    }
    setError('');
    const DEBT_TYPES = ['visa','mastercard','loan'];
    const bal = parseFloat(form.balance);
    mutation.mutate({
      name:              form.name.trim(),
      type:              form.type,
      balance:           DEBT_TYPES.includes(form.type) ? -Math.abs(bal) : Math.abs(bal),
      last_four:         form.last_four || null,
      currency:          form.currency,
      credit_limit:      form.credit_limit      ? parseFloat(form.credit_limit)      : null,
      due_date:          form.due_date           || null,
      interest_rate:     form.interest_rate      ? parseFloat(form.interest_rate)     : null,
      total_loan_amount: form.total_loan_amount  ? parseFloat(form.total_loan_amount) : null,
      emi_amount:        form.emi_amount         ? parseFloat(form.emi_amount)        : null,
      emi_day:           form.emi_day            ? parseInt(form.emi_day)             : null,
    });
  };

  const selectedOpt = DEBT_TYPE_OPTS.find(o => o.value === form.type) || DEBT_TYPE_OPTS[2];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-title">{debt ? 'Edit' : 'Add'} Debt</div>

        {error && <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'8px 12px', borderRadius:10, marginBottom:14, fontSize:13 }}>{error}</div>}

        {/* Type selector */}
        <div className="form-group">
          <label className="form-label">Debt Type</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {DEBT_TYPE_OPTS.map(opt => (
              <button key={opt.value} onClick={() => set('type', opt.value)}
                style={{ padding:'10px 14px', borderRadius:12, fontSize:13, fontWeight:600, textAlign:'left', border: form.type===opt.value?`1.5px solid ${opt.color}`:'1.5px solid var(--border)', background: form.type===opt.value?opt.color+'12':'var(--surface)', color: form.type===opt.value?opt.color:'var(--text3)', cursor:'pointer', transition:'all .15s' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Name / Label</label>
            <input className="form-input" value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={isCardType ? 'e.g. Chase Sapphire, HDFC Visa...' : form.type==='lending' ? 'e.g. Lent to John' : 'e.g. Home Loan, Car Loan...'}
              autoFocus />
          </div>

          {/* Credit card fields */}
          {isCardType && (
            <>
              <div className="form-group">
                <label className="form-label">Outstanding Balance ($)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.balance} onChange={e => set('balance',e.target.value)} placeholder="0.00"/>
              </div>
              <div className="form-group">
                <label className="form-label">Total Credit Limit ($)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.credit_limit} onChange={e => set('credit_limit',e.target.value)} placeholder="e.g. 10000"/>
              </div>
              <div className="form-group">
                <label className="form-label">Last 4 Digits</label>
                <input className="form-input" maxLength={4} value={form.last_four} onChange={e => set('last_four',e.target.value.replace(/\D/,''))} placeholder="4321"/>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Due Date</label>
                <input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date',e.target.value)}/>
              </div>
            </>
          )}

          {/* Loan fields */}
          {isLoan && (
            <>
              <div className="form-group">
                <label className="form-label">Remaining Balance ($)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.balance} onChange={e => set('balance',e.target.value)} placeholder="0.00"/>
              </div>
              <div className="form-group">
                <label className="form-label">Original Loan Amount ($)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.total_loan_amount} onChange={e => set('total_loan_amount',e.target.value)} placeholder="e.g. 50000"/>
              </div>
              <div className="form-group">
                <label className="form-label">Interest Rate (% p.a.)</label>
                <input className="form-input" type="number" min="0" max="100" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate',e.target.value)} placeholder="e.g. 8.5"/>
              </div>
              <div className="form-group">
                <label className="form-label">Monthly EMI ($)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.emi_amount} onChange={e => set('emi_amount',e.target.value)} placeholder="e.g. 1500"/>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">EMI Due Date (day of month)</label>
                <input className="form-input" type="number" min="1" max="31" value={form.emi_day} onChange={e => set('emi_day',e.target.value)} placeholder="e.g. 5 (5th of every month)"/>
              </div>
            </>
          )}

          {/* Lending fields */}
          {form.type === 'lending' && (
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label className="form-label">Amount Lent ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.balance} onChange={e => set('balance',e.target.value)} placeholder="0.00"/>
            </div>
          )}
        </div>

        {/* Live preview */}
        {isCardType && form.credit_limit && parseFloat(form.balance) > 0 && (
          <div style={{ background:'var(--surface2)', borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:8 }}>Utilization Preview</div>
            <div style={{ height:8, background:'var(--surface3)', borderRadius:20, overflow:'hidden', marginBottom:6 }}>
              {(() => {
                const pct = Math.min(100, Math.round((parseFloat(form.balance)/parseFloat(form.credit_limit))*100));
                return <div style={{ height:'100%', width:`${pct}%`, background: pct>80?'#FF5B5B':pct>50?'#FFB84D':'#37D67A', borderRadius:20, transition:'width .4s' }}/>;
              })()}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)' }}>
              <span>{Math.min(100,Math.round((parseFloat(form.balance)/parseFloat(form.credit_limit))*100))}% used</span>
              <span>Available: {fmt(Math.max(0,parseFloat(form.credit_limit)-parseFloat(form.balance)))}</span>
            </div>
          </div>
        )}

        {isLoan && form.emi_amount && form.interest_rate && parseFloat(form.balance) > 0 && (
          <div style={{ background:'var(--surface2)', borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:6 }}>EMI Breakdown Preview (first month)</div>
            {(() => {
              const r = parseFloat(form.interest_rate)/100/12;
              const interest = parseFloat(form.balance)*r;
              const principal = parseFloat(form.emi_amount) - interest;
              return (
                <div style={{ display:'flex', gap:16, fontSize:12 }}>
                  <span>Interest: <b style={{color:'#FF5B5B'}}>{fmt(interest)}</b></span>
                  <span>Principal: <b style={{color:'#37D67A'}}>{fmt(Math.max(0,principal))}</b></span>
                  <span>After 1 EMI: <b style={{color:'var(--text)'}}>{fmt(Math.max(0,parseFloat(form.balance)-principal))}</b></span>
                </div>
              );
            })()}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mutation.isPending || !form.name.trim()} onClick={handleSubmit}
            style={{ background:'linear-gradient(135deg,#FF5B5B,#FF79A8)', border:'none', boxShadow:'0 4px 14px rgba(255,91,91,.35)' }}>
            {mutation.isPending ? 'Saving…' : debt ? 'Update Debt' : 'Add Debt'}
          </button>
        </div>
      </div>
    </div>
  );
}
