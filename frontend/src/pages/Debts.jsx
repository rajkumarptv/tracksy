import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';
import { walletsAPI } from '../services/api';
import { Topbar, PageLoader, EmptyState } from '../components/ui';
import {
  Plus, CreditCard, TrendingDown, X, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, HandCoins, CalendarClock, Percent, LayoutGrid, Landmark,
} from 'lucide-react';
import { useFmt as useFmtHook, useT } from '../i18n';
import useThemeStore from '../store/themeStore';
import { THEME } from '../theme';
import styles from './Accounts.module.css';
import { invalidateFinance } from '../lib/cache';

const DEBT_TYPES = ['visa','mastercard','home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','bnpl','family_borrow','emi','lending'];

const TYPE_META = {
  visa:          { icon: '💳', label: 'Credit Card',    color: '#EC4899', bg: 'rgba(236,72,153,.12)' },
  mastercard:    { icon: '💳', label: 'Credit Card',    color: '#EC4899', bg: 'rgba(236,72,153,.12)' },
  home_loan:     { icon: '🏠', label: 'Home Loan',      color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  vehicle_loan:  { icon: '🚗', label: 'Vehicle Loan',   color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  personal_loan: { icon: '💼', label: 'Personal Loan',  color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  gold_loan:     { icon: '🪙', label: 'Gold Loan',      color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  education_loan:{ icon: '🎓', label: 'Education Loan', color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  loan:          { icon: '📋', label: 'Loan',           color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
  bnpl:          { icon: '🛍️', label: 'BNPL',           color: '#8B5CF6', bg: 'rgba(139,92,246,.12)' },
  family_borrow: { icon: '👪', label: 'Borrowed',       color: '#8B5CF6', bg: 'rgba(139,92,246,.12)' },
  emi:           { icon: '📅', label: 'EMI',            color: '#8B5CF6', bg: 'rgba(139,92,246,.12)' },
  lending:       { icon: '🤝', label: 'Money Lent',     color: '#3B82F6', bg: 'rgba(59,130,246,.12)' },
};

/* Group definitions for the overview donut + list (validated donut order:
   pink → blue → orange → purple → teal for CVD-safe adjacency) */
const DEBT_GROUPS = [
  { key:'cards',   title:'Credit Cards', types:['visa','mastercard'], color:{ light:'#EC4899', dark:'#FF4D8D' }, Icon:CreditCard },
  { key:'lent',    title:'Money Lent',   types:['lending'],           color:{ light:'#3B82F6', dark:'#4F8DFF' }, Icon:HandCoins  },
  { key:'loans',   title:'Loans',        types:['home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan'], color:{ light:'#F59E0B', dark:'#FF9D00' }, Icon:Landmark },
  { key:'bnpl',    title:'BNPL & EMI',   types:['bnpl','family_borrow','emi'], color:{ light:'#8B5CF6', dark:'#8B5CF6' }, Icon:CalendarClock },
];

const springD = { type:'spring', stiffness:280, damping:28 };
const containerVarD = { hidden:{}, show:{ transition:{ staggerChildren:.07 } } };
const cardVarD = { hidden:{ opacity:0, y:22 }, show:{ opacity:1, y:0, transition:springD } };

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
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const t = isDark ? THEME.dark : THEME.light;

  const [showModal, setShowModal] = useState(false);
  const [editDebt, setEditDebt] = useState(null);
  const [activeDebt, setActiveDebt] = useState(null);
  const [filter, setFilter] = useState('all');
  const [collapsed, setCollapsed] = useState({});

  const { data: allWallets, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsAPI.getAll().then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => walletsAPI.delete(id),
    onSuccess: () => { invalidateFinance(qc); setActiveDebt(null); },
  });

  const apiDebts = (allWallets || []).filter(w => DEBT_TYPES.includes(w.type));
  const debts = apiDebts;

  /* ── Groups + totals ── */
  const grouped = useMemo(() => DEBT_GROUPS.map(g => {
    const items = debts.filter(w => g.types.includes(w.type));
    const total = items.reduce((s,w) => s + Math.abs(parseFloat(w.balance||0)), 0);
    return { ...g, items, total, clr: isDark ? g.color.dark : g.color.light };
  }).filter(g => g.items.length > 0), [debts, isDark]);

  const totalDebt  = debts.filter(w => w.type !== 'lending').reduce((s,w) => s + Math.abs(parseFloat(w.balance||0)), 0);
  const totalLent  = debts.filter(w => w.type === 'lending').reduce((s,w) => s + Math.abs(parseFloat(w.balance||0)), 0);
  const estMonthly = debts.reduce((s,w) => {
    if (['visa','mastercard'].includes(w.type)) return s + Math.abs(parseFloat(w.balance||0)) * 0.02;
    return s + parseFloat(w.emi_amount || 0);
  }, 0);
  const highestRate = debts.reduce((m,w) => Math.max(m, parseFloat(w.interest_rate||0)), 0);
  const highestRateDebt = debts.find(w => parseFloat(w.interest_rate||0) === highestRate);

  const donutData = grouped.map(g => ({ name:g.title, value:g.total, color:g.clr }));
  const donutTotal = donutData.reduce((s,d) => s + d.value, 0);

  const chips = [
    { key:'all', label:`All (${debts.length})`, Icon:LayoutGrid },
    ...grouped.map(g => ({ key:g.key, label:`${g.title} (${g.items.length})`, Icon:g.Icon })),
  ];
  const visibleGroups = filter === 'all' ? grouped : grouped.filter(g => g.key === filter);

  if (isLoading) return <PageLoader />;

  return (
    <div className={styles.page} style={{ background:t.bg }}>
      <motion.div className={styles.inner} variants={containerVarD} initial="hidden" animate="show">

        {/* ── Header ── */}
        <motion.div className={styles.header} variants={cardVarD}>
          <div>
            <h1 className={styles.h1} style={{ color:t.text }}>Debts &amp; Liabilities</h1>
            <div className={styles.sub} style={{ color:t.text2 }}>Track, plan and become debt-free.</div>
          </div>
          <div className={styles.headerBtns}>
            <button className={styles.circleBtn} style={{ background:t.cardBg, border:`1px solid ${t.border}` }}
              onClick={() => navigate('/debt-reduction')}>
              <TrendingDown size={19} color={t.text2}/>
            </button>
            <motion.button className={styles.circleBtn} whileTap={{ scale:.9 }}
              style={{ background:'linear-gradient(180deg,#EC4899,#BE185D)', border:'none', boxShadow:'0 8px 24px rgba(236,72,153,.35)' }}
              onClick={() => { setEditDebt(null); setShowModal(true); }}>
              <Plus size={22} color="#fff"/>
            </motion.button>
          </div>
        </motion.div>

        {/* ── Overview card ── */}
        <motion.div className={styles.overview} variants={cardVarD}
          style={{ background:t.flowBg, border:t.flowBorder, boxShadow:t.glowShadow }}>
          <div className={styles.overviewLeft}>
            <div style={{ fontSize:14, color:t.text2, fontWeight:500 }}>Total Outstanding</div>
            <div className={styles.bigAmount} style={{ color:t.red }}>−{fmt(totalDebt,{noDecimals:true})}</div>
            <div style={{ fontSize:14, color:t.text2 }}>Across {debts.length} account{debts.length!==1?'s':''}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
              <div>
                <div style={{ fontSize:10.5, color:t.text3, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>Est. Monthly Payments</div>
                <div style={{ fontSize:16, fontWeight:800, color:t.text, fontFamily:'Space Grotesk, Inter, sans-serif', marginTop:2 }}>{fmt(estMonthly,{noDecimals:true})}</div>
              </div>
              {totalLent > 0 && (
                <div>
                  <div style={{ fontSize:10.5, color:t.text3, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>Money Lent Out</div>
                  <div style={{ fontSize:16, fontWeight:800, color:t.green, fontFamily:'Space Grotesk, Inter, sans-serif', marginTop:2 }}>{fmt(totalLent,{noDecimals:true})}</div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.overviewDivider} style={{ background:t.divider }}/>

          <div className={styles.overviewRight}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:14, fontWeight:600, color:t.text2 }}>Debt Breakdown</span>
              <ChevronRight size={16} color={t.text3}/>
            </div>
            <div className={styles.donutRow}>
              <div className={styles.donutBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius="68%" outerRadius="96%"
                      paddingAngle={2} strokeWidth={0} animationDuration={900}>
                      {donutData.map((d,i) => <Cell key={i} fill={d.color}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.legend}>
                {donutData.map((d,i) => (
                  <motion.div key={i} className={styles.legendRow}
                    initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} transition={{ delay:.3+i*.08 }}>
                    <span className={styles.legendDot} style={{ background:d.color }}/>
                    <span className={styles.legendName} style={{ color:t.text }}>{d.name}</span>
                    <span className={styles.legendVal} style={{ color:t.text }}>{fmt(d.value,{noDecimals:true})}</span>
                    <span className={styles.legendPct} style={{ color:t.text3 }}>{donutTotal>0?Math.round((d.value/donutTotal)*100):0}%</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Filter chips ── */}
        <motion.div className={styles.chips} variants={cardVarD}>
          {chips.map(({ key, label, Icon }) => {
            const active = filter === key;
            return (
              <motion.button key={key} whileTap={{ scale:.94 }} className={styles.chip}
                style={{
                  background: active ? (isDark?'rgba(236,72,153,.16)':'#FDF2F8') : t.cardBg,
                  border: `1.5px solid ${active ? '#EC4899' : t.border}`,
                  color: active ? (isDark?'#F9A8D4':'#EC4899') : t.text2,
                }}
                onClick={() => setFilter(key)}>
                <Icon size={15}/> {label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Group cards ── */}
        {visibleGroups.map(g => {
          const isCollapsed = collapsed[g.key];
          const GIcon = g.Icon;
          const isLent = g.key === 'lent';
          return (
            <motion.div key={g.key} className={styles.groupCard} variants={cardVarD}
              style={{ background:t.cardBg, border:`1px solid ${t.border}`, boxShadow:t.cardShadow }}>

              <div className={styles.groupHead} onClick={() => setCollapsed(p => ({ ...p, [g.key]:!p[g.key] }))}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div className={styles.groupIcon} style={{ background:`${g.clr}1f` }}>
                    <GIcon size={19} color={g.clr}/>
                  </div>
                  <span style={{ fontSize:16, fontWeight:700, color:t.text }}>{g.title}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:13, color:t.text2 }}>{isLent ? 'To Receive' : 'Outstanding'}</span>
                  <span style={{ fontSize:15, fontWeight:800, color: isLent ? t.green : g.clr, fontFamily:'Space Grotesk, Inter, sans-serif' }}>
                    {isLent ? '' : '−'}{fmt(g.total,{noDecimals:true})}
                  </span>
                  <div className={styles.collapseBtn} style={{ background:t.surface }}>
                    {isCollapsed ? <ChevronDown size={15} color={t.text2}/> : <ChevronUp size={15} color={t.text2}/>}
                  </div>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div key="body"
                    initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                    transition={{ duration:.25, ease:[.2,.8,.2,1] }}
                    style={{ overflow:'hidden' }}>
                    {g.items.map(w => {
                      const meta = TYPE_META[w.type] || { icon:'💳', label:'Debt', color:'#EC4899' };
                      const bal = Math.abs(parseFloat(w.balance||0));
                      const emi = parseFloat(w.emi_amount||0);
                      const rate = parseFloat(w.interest_rate||0);
                      const subBits = [];
                      if (w.last_four) subBits.push(`•••• ${w.last_four}`);
                      if (emi > 0) subBits.push(`EMI ${fmt(emi,{noDecimals:true})}${w.emi_day ? ` · due ${w.emi_day}${['st','nd','rd'][w.emi_day-1]||'th'}` : ''}`);
                      if (rate > 0) subBits.push(`${rate}% p.a.`);
                      if (subBits.length === 0) subBits.push(meta.label);
                      return (
                        <motion.div key={w.id} className={styles.row}
                          style={{ borderTop:`1px solid ${t.divider}` }}
                          whileHover={{ backgroundColor:t.hover }}
                          onClick={() => !w.demo && setActiveDebt(w)}>
                          <div className={styles.rowIcon} style={{ background:meta.color }}>
                            <span style={{ fontSize:18 }}>{meta.icon}</span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                              <span className={styles.rowName} style={{ color:t.text }}>{w.name}</span>
                              <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:20, background:`${meta.color}1f`, color:meta.color, whiteSpace:'nowrap', flexShrink:0 }}>{meta.label}</span>
                            </div>
                            <div style={{ fontSize:12.5, color:t.text2, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {subBits.join(' · ')}
                            </div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:15, fontWeight:800, color: isLent ? t.green : t.red, fontFamily:'Space Grotesk, Inter, sans-serif' }}>
                              {isLent ? '' : '−'}{fmt(bal,{noDecimals:true})}
                            </div>
                            <div style={{ fontSize:12, color:t.text3, marginTop:2 }}>{isLent ? 'to receive' : 'outstanding'}</div>
                          </div>
                          <ChevronRight size={17} color={t.text3} style={{ flexShrink:0 }}/>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* ── Insights tiles ── */}
        <motion.div className={styles.groupCard} variants={cardVarD}
          style={{ background:t.cardBg, border:`1px solid ${t.border}`, boxShadow:t.cardShadow, padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={{ fontSize:16, fontWeight:700, color:t.text }}>Debt Insights</span>
            <button onClick={() => navigate('/debt-reduction')}
              style={{ background:'none', border:'none', fontSize:13.5, fontWeight:700, color:t.purple, cursor:'pointer', fontFamily:'inherit' }}>
              Payoff Planner
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
            {[
              { Icon:CalendarClock, color:t.purple, title:'Monthly Commitment', body:<>You pay about <b style={{ color:t.purple }}>{fmt(estMonthly,{noDecimals:true})}</b> in EMIs &amp; card dues every month.</> },
              { Icon:Percent, color:t.orange, title:'Highest Interest', body: highestRate > 0
                  ? <><b style={{ color:t.orange }}>{highestRateDebt?.name}</b> charges {highestRate}% p.a. — pay this off first.</>
                  : <>Add interest rates to your debts to get payoff advice.</> },
              { Icon:TrendingDown, color:t.green, title:'Debt-Free Plan', body:<>Use the <b style={{ color:t.green }}>Payoff Planner</b> to build an avalanche or snowball strategy.</> },
            ].map(({ Icon, color, title, body }, i) => (
              <motion.div key={i}
                style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, padding:14, cursor:'pointer', minWidth:0 }}
                initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.35+i*.09 }}
                whileHover={{ y:-3 }}
                onClick={() => navigate('/debt-reduction')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ width:38, height:38, borderRadius:999, background:color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon size={18} color={isDark && color===t.green ? '#04220F' : '#fff'}/>
                  </div>
                  <ChevronRight size={16} color={t.text3}/>
                </div>
                <div style={{ fontSize:14.5, fontWeight:700, color:t.text, marginTop:12 }}>{title}</div>
                <div style={{ fontSize:12.5, color:t.text2, marginTop:4, lineHeight:1.5 }}>{body}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {debts.length === 0 && (
          <motion.div variants={cardVarD}
            style={{ textAlign:'center', padding:'40px 20px', background:t.cardBg, border:`1px solid ${t.border}`, borderRadius:20, boxShadow:t.cardShadow }}>
            <div style={{ fontSize:38, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:16, fontWeight:700, color:t.text }}>No debts — you're all clear!</div>
            <div style={{ fontSize:13, color:t.text2, marginTop:4, marginBottom:16 }}>Add a credit card or loan to track repayments here</div>
            <button onClick={() => { setEditDebt(null); setShowModal(true); }}
              style={{ padding:'12px 22px', borderRadius:14, border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
                background:'linear-gradient(180deg,#EC4899,#BE185D)', color:'#fff', boxShadow:'0 8px 24px rgba(236,72,153,.35)' }}>
              + Add Liability
            </button>
          </motion.div>
        )}
      </motion.div>

      {activeDebt && (
        <DebtDetailModal debt={activeDebt} onClose={() => setActiveDebt(null)}
          onEdit={() => { setEditDebt(activeDebt); setActiveDebt(null); setShowModal(true); }}/>
      )}
      {showModal && (
        <DebtModal debt={editDebt}
          onClose={() => { setShowModal(false); setEditDebt(null); }}
          onSaved={() => { invalidateFinance(qc); setShowModal(false); setEditDebt(null); }}/>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
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
  const PIE_COLORS = ['#EC4899','#22C55E'];

  return (
    <div>
      {/* Key stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { l:'Outstanding',  v:`${fmt(bal)}`,               c:'#EC4899' },
          { l:'Credit Limit', v: limit > 0 ? `${fmt(limit)}` : '—',       c:'var(--text)' },
          { l:'Available',    v: limit > 0 ? `${fmt(Math.max(0,limit-bal))}` : '—', c:'#22C55E' },
          { l:'Utilization',  v: limit > 0 ? `${utilPct}%` : '—',           c: utilPct>80?'#EC4899':utilPct>50?'#F59E0B':'#22C55E' },
          { l:'Min. Payment', v:`${fmt(bal*0.02)}`,           c:'#F59E0B' },
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
                  <div className="mono" style={{ fontSize:20, fontWeight:900, color: utilPct>80?'#EC4899':utilPct>50?'#F59E0B':'#22C55E' }}>{utilPct}%</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>used</div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'center', gap:16, fontSize:11, marginTop:8 }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#EC4899', display:'inline-block' }}/> Used {fmt(bal)}</span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#22C55E', display:'inline-block' }}/> Free {fmt(Math.max(0,limit-bal))}</span>
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
                  <stop offset="5%" stopColor="#EC4899" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#EC4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
              <Tooltip formatter={v => [`${v}%`, 'Utilization']} contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, fontSize:12 }}/>
              <Area type="monotone" dataKey="util" stroke="#EC4899" strokeWidth={2} fill="url(#utilGrad)" dot={{ r:3, fill:'#EC4899' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payoff tip */}
      {utilPct > 30 && (
        <div style={{ background: utilPct>80?'rgba(236,72,153,.08)':utilPct>50?'rgba(245,158,11,.08)':'rgba(34,197,94,.08)', borderRadius:14, padding:'14px 16px', display:'flex', gap:10, alignItems:'flex-start' }}>
          <AlertCircle size={16} color={utilPct>80?'#EC4899':utilPct>50?'#F59E0B':'#22C55E'} style={{ flexShrink:0, marginTop:1 }}/>
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
          { l:'Remaining Balance', v:`${fmt(bal)}`,                          c:'#F59E0B' },
          { l:'Original Loan',     v:`${fmt(totalLoan)}`,                    c:'var(--text)' },
          { l:'Already Paid',      v:`${fmt(Math.max(0,totalLoan-bal))}`,    c:'#22C55E' },
          { l:'Interest Rate',     v: debt.interest_rate ? `${debt.interest_rate}% p.a.` : '—', c:'#EC4899' },
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
          <span className="mono" style={{ fontSize:13, fontWeight:700, color:'#22C55E' }}>{paidPct}% paid off</span>
        </div>
        <div style={{ height:10, background:'var(--surface3)', borderRadius:20, overflow:'hidden', marginBottom:8 }}>
          <div style={{ height:'100%', width:`${paidPct}%`, background:'linear-gradient(90deg,#22C55E,#00CEC9)', borderRadius:20, transition:'width .8s ease' }}/>
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
              <span style={{ fontSize:12, color:'var(--text3)' }}>Total Interest: <b style={{color:'#EC4899'}}>{fmt(totalInterest)}</b></span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>Total Principal: <b style={{color:'#22C55E'}}>{fmt(totalPrincipal)}</b></span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={schedule.slice(0,12)} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, fontSize:12 }} formatter={v => `${fmt(v)}`}/>
                <Legend iconSize={8} wrapperStyle={{ fontSize:11 }}/>
                <Bar dataKey="principal" name="Principal" fill="#22C55E" stackId="a" radius={[0,0,4,4]}/>
                <Bar dataKey="interest"  name="Interest"  fill="#EC4899" stackId="a" radius={[4,4,0,0]}/>
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
                    <td style={{ padding:'7px 8px', color:'#22C55E' }} className="mono">{fmt(r.principal)}</td>
                    <td style={{ padding:'7px 8px', color:'#EC4899' }} className="mono">{fmt(r.interest)}</td>
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
          { l:'Amount Lent',  v:`${fmt(bal)}`,  c:'#3B82F6' },
          { l:'Status',       v:'Outstanding',   c:'#F59E0B' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background:'var(--surface2)', borderRadius:14, padding:'18px' }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:4 }}>{l}</div>
            <div className="mono" style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'rgba(59,130,246,.08)', borderRadius:14, padding:'16px', fontSize:13, color:'var(--text)', lineHeight:1.6 }}>
        💡 <b>Tip:</b> Record repayments as income transactions linked to this account to track how much has been paid back.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ADD / EDIT MODAL
══════════════════════════════════════════════════════════ */
const DEBT_TYPE_OPTS = [
  { value:'visa',       label:'💳 Visa Credit Card',       color:'#EC4899' },
  { value:'mastercard', label:'💳 Mastercard',              color:'#EC4899' },
  { value:'loan',       label:'📋 Personal / Bank Loan',   color:'#F59E0B' },
  { value:'lending',    label:'🤝 Money Lent to Someone',  color:'#3B82F6' },
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
                return <div style={{ height:'100%', width:`${pct}%`, background: pct>80?'#EC4899':pct>50?'#F59E0B':'#22C55E', borderRadius:20, transition:'width .4s' }}/>;
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
                  <span>Interest: <b style={{color:'#EC4899'}}>{fmt(interest)}</b></span>
                  <span>Principal: <b style={{color:'#22C55E'}}>{fmt(Math.max(0,principal))}</b></span>
                  <span>After 1 EMI: <b style={{color:'var(--text)'}}>{fmt(Math.max(0,parseFloat(form.balance)-principal))}</b></span>
                </div>
              );
            })()}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mutation.isPending || !form.name.trim()} onClick={handleSubmit}
            style={{ background:'linear-gradient(135deg,#EC4899,#FF79A8)', border:'none', boxShadow:'0 4px 14px rgba(236,72,153,.35)' }}>
            {mutation.isPending ? 'Saving…' : debt ? 'Update Debt' : 'Add Debt'}
          </button>
        </div>
      </div>
    </div>
  );
}
