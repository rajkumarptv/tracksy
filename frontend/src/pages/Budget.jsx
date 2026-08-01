import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip,
} from 'recharts';
import {
  Plus, Calendar, ChevronRight, ChevronDown, Lightbulb,
  TrendingUp, CalendarClock, CalendarDays, CalendarRange, Ban, Target, MoreVertical,
} from 'lucide-react';
import { budgetsAPI, categoriesAPI, transactionsAPI, recurringAPI } from '../services/api';
import { PageLoader } from '../components/ui';
import { useFmt } from '../i18n';
import useAuthStore from '../store/authStore';
import usePremiumStore from '../store/premiumStore';
import useThemeStore from '../store/themeStore';
import styles from './Budget.module.css';

const FREE_BUDGET_LIMIT = 3;

/* ── Palette — derived from the shared dashboard theme ── */
import { THEME } from '../theme';
import { invalidateFinance } from '../lib/cache';
import ThemedSelect from '../components/ThemedSelect';
import { CategoryGlyph } from '../components/icons';
const DS = {
  light: {
    ...THEME.light,
    card: THEME.light.cardBg, shadow: THEME.light.cardShadow,
    overviewBg: THEME.light.flowBg, overviewBorder: THEME.light.flowBorder,
  },
  dark: {
    ...THEME.dark,
    card: THEME.dark.cardBg, shadow: THEME.dark.cardShadow,
    overviewBg: THEME.dark.flowBg, overviewBorder: THEME.dark.flowBorder,
  },
  purple:'#8B5CF6', green:'#22C55E', pink:'#EC4899', orange:'#F59E0B', blue:'#3B82F6',
};

const spring = { type:'spring', stiffness:280, damping:28 };
const containerVar = { hidden:{}, show:{ transition:{ staggerChildren:.07 } } };
const cardVar = { hidden:{ opacity:0, y:22 }, show:{ opacity:1, y:0, transition:spring } };

/* ── Gradient donut ring (74% Used) ── */
function BudgetRing({ pct, t, glow }) {
  const size = 150, stroke = 13, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="budgetRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6"/>
            <stop offset="100%" stopColor={t.green}/>
          </linearGradient>
          <filter id="ringGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={t.green} floodOpacity="0.45"/>
          </filter>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={t.track} strokeWidth={stroke}/>
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none"
          filter={glow ? 'url(#ringGlow)' : undefined}
          stroke="url(#budgetRing)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (clamped/100)*circ }}
          transition={{ duration:1.1, ease:[.2,.8,.2,1], delay:.3 }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:30, fontWeight:800, color:t.text, fontFamily:'Space Grotesk, Inter, sans-serif', letterSpacing:'-1px' }}>
          {Math.round(clamped)}%
        </span>
        <span style={{ fontSize:13, color:t.text2 }}>Used</span>
      </div>
    </div>
  );
}

/* ── Bar chart custom tick: emoji above label ── */
function CatTick({ x, y, payload, data, color }) {
  const item = data.find(d => d.name === payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={14} textAnchor="middle" fontSize={14}>{item?.emoji}</text>
      <text x={0} y={32} textAnchor="middle" fontSize={10.5} fill={color}>{payload.value}</text>
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function Budget() {
  const qc = useQueryClient();
  const fmt = useFmt();
  const { user } = useAuthStore();
  const { openPremium } = usePremiumStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const t = isDark ? DS.dark : DS.light;

  const [showModal, setShowModal] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [activeType, setActiveType] = useState('expense');
  const isIncome = activeType === 'income';
  const L = isIncome
    ? { total:'Income Target', spent:'Received', totalSpent:'Total Received', ovTitle:'Budget vs Actual' }
    : { total:'Total Budget',  spent:'Spent',    totalSpent:'Total Spent',    ovTitle:'Budget vs Actual' };

  const { data: apiBudgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsAPI.getAll().then(r => r.data.data),
  });
  const { data: recurring } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => recurringAPI.getAll().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const { data: trendTx } = useQuery({
    queryKey: ['budget-trend'],
    queryFn: () => transactionsAPI.getAll({ limit: 1000 }).then(r => r.data.data || []),
    staleTime: 5 * 60 * 1000,
  });

  const budgets = (apiBudgets || []).filter(b => (b.type || 'expense') === activeType);

  const atBudgetLimit = !user?.is_premium && (apiBudgets||[]).length >= FREE_BUDGET_LIMIT;
  const openAddBudget = () => atBudgetLimit ? openPremium() : (setEditBudget(null), setShowModal(true));

  /* ── Totals ── */
  const totalBudget = budgets.reduce((s,b) => s + parseFloat(b.amount||0), 0);
  const totalSpent  = budgets.reduce((s,b) => s + parseFloat(b.spent||0),  0);
  const totalPct    = totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0;
  const remaining   = Math.max(0, totalBudget - totalSpent);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const daysLeft    = daysInMonth - now.getDate();
  const daysElapsed = Math.max(1, now.getDate());
  const dailyAvg    = Math.round(totalSpent / daysElapsed);
  const dailyLeft   = daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining;

  const underCount  = budgets.filter(b => parseFloat(b.spent||0) < parseFloat(b.amount||0)).length;

  /* ── Bar chart data ── */
  const barData = budgets.slice(0,6).map(b => ({
    name: b.name.length > 10 ? b.name.split(' ')[0] : b.name,
    emoji: b.emoji || '💠',
    Budget: parseFloat(b.amount||0),
    Spent:  parseFloat(b.spent||0),
  }));

  /* ── Insights ── */
  const { prevMonthSpent, thisMonthSpent } = useMemo(() => {
    const cur = new Date(now.getFullYear(), now.getMonth(), 1);
    const prev = new Date(now.getFullYear(), now.getMonth()-1, 1);
    let a=0, b=0;
    (trendTx||[]).forEach(tx => {
      if (tx.type !== 'expense') return;
      const d = new Date(tx.transaction_date);
      if (d >= cur) a += parseFloat(tx.amount||0);
      else if (d >= prev && d < cur) b += parseFloat(tx.amount||0);
    });
    return { thisMonthSpent:a, prevMonthSpent:b };
  }, [trendTx]);

  const savedVsLast = Math.max(0, prevMonthSpent - thisMonthSpent);
  const upcomingBills = (recurring||[]).filter(r => r.type === 'expense')
    .reduce((s,r) => s + parseFloat(r.amount||0), 0);

  const insightTiles = [
    savedVsLast > 0
      ? { Icon:TrendingUp,   color:t.green,  title:"You're saving more!", body:<>You've spent <b style={{ color:t.green }}>{fmt(savedVsLast,{noDecimals:true})}</b> less than last month.</> }
      : { Icon:TrendingUp,   color:t.green,  title:'Spending pace',       body:<>Daily average is <b style={{ color:t.green }}>{fmt(dailyAvg,{noDecimals:true})}</b> this month.</> },
    { Icon:CalendarClock, color:DS.purple, title:'Upcoming Bills', body: upcomingBills > 0
        ? <><b style={{ color:DS.purple }}>{fmt(upcomingBills,{noDecimals:true})}</b> in recurring bills due this cycle.</>
        : <>No recurring bills set up yet.</> },
    { Icon:Target, color:DS.orange, title:'Budget Goal', body:<>You're on track to save <b style={{ color:DS.orange }}>{fmt(remaining,{noDecimals:true})}</b> this month.</> },
  ];

  if (isLoading) return <PageLoader />;

  return (
    <div className={styles.page} style={{ background:t.bg }}>
      <motion.div className={styles.inner} variants={containerVar} initial="hidden" animate="show">

        {/* ── Header ── */}
        <motion.div className={styles.header} variants={cardVar}>
          <div>
            <h1 className={styles.h1} style={{ color:t.text }}>Budget</h1>
            <div className={styles.sub} style={{ color:t.text2 }}>Plan smart. Spend wise. Achieve more.</div>
          </div>
          <div className={styles.headerBtns}>
            <button className={styles.circleBtn} style={{ background:t.card, border:`1px solid ${t.border}` }}>
              <Calendar size={19} color={t.text2}/>
            </button>
            <motion.button className={styles.circleBtn} whileTap={{ scale:.9 }}
              style={{ background:'linear-gradient(180deg,#8B5CF6,#6D28D9)', border:'none', boxShadow:'0 8px 24px rgba(124,58,237,.35)' }}
              onClick={openAddBudget}>
              <Plus size={22} color="#fff"/>
            </motion.button>
          </div>
        </motion.div>

        {/* ── Expense / Income tabs ── */}
        <motion.div variants={cardVar}
          style={{ display:'flex', gap:6, padding:5, borderRadius:14, background:t.surface, border:`1px solid ${t.border}` }}>
          {[{ k:'expense', label:'Expenses' }, { k:'income', label:'Income' }].map(tab => {
            const on = activeType === tab.k;
            const accent = tab.k === 'income' ? t.green : DS.purple;
            return (
              <button key={tab.k} onClick={()=>setActiveType(tab.k)}
                style={{ position:'relative', flex:1, padding:'10px 0', border:'none', cursor:'pointer',
                  borderRadius:10, fontSize:14, fontWeight:700, background:'transparent',
                  color: on ? '#fff' : t.text2 }}>
                {on && <motion.span layoutId="budgetTab" transition={spring}
                  style={{ position:'absolute', inset:0, borderRadius:10, background:accent, zIndex:0 }}/>}
                <span style={{ position:'relative', zIndex:1 }}>{tab.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* ── Overview card ── */}
        <motion.div className={styles.overview} variants={cardVar}
          style={{ background:t.overviewBg, border:t.overviewBorder, boxShadow:t.glowShadow }}>
          <div className={styles.overviewHead}>
            <button className={styles.monthPill} style={{ color:t.text }}>
              This Month <ChevronDown size={15} color={t.text3}/>
            </button>
            <ChevronRight size={17} color={t.text3}/>
          </div>

          <div className={styles.overviewBody}>
            {/* left */}
            <div className={styles.overviewLeft}>
              <div style={{ fontSize:13.5, color:t.text2 }}>{L.total}</div>
              <div className={styles.bigAmount} style={{ color:t.text }}>{fmt(totalBudget,{noDecimals:true})}</div>
              <div style={{ fontSize:13.5, color:t.text2, marginTop:10 }}>Days Left</div>
              <div style={{ fontSize:19, fontWeight:800, color:DS.purple, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{daysLeft} Days</div>
            </div>

            {/* ring */}
            <BudgetRing pct={totalPct} t={t} glow={isDark}/>

            {/* right */}
            <div className={styles.overviewRight}>
              <div className={styles.statRow}>
                <span className={styles.dot} style={{ background:DS.purple }}/>
                <span style={{ flex:1, fontSize:13.5, color:t.text2 }}>{L.spent}</span>
                <span style={{ fontSize:14.5, fontWeight:800, color:t.text, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(totalSpent,{noDecimals:true})}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.dot} style={{ background:t.green }}/>
                <span style={{ flex:1, fontSize:13.5, color:t.text2 }}>Remaining</span>
                <span style={{ fontSize:14.5, fontWeight:800, color:t.text, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(remaining,{noDecimals:true})}</span>
              </div>
              <div style={{ height:1, background:t.border, margin:'10px 0' }}/>
              <div className={styles.statRow}>
                <span style={{ flex:1, fontSize:13.5, color:t.text2 }}>Daily Average</span>
                <span style={{ fontSize:14, fontWeight:700, color:t.text, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(dailyAvg,{noDecimals:true})}</span>
              </div>
              <div className={styles.statRow}>
                <span style={{ flex:1, fontSize:13.5, color:t.text2 }}>Daily Left</span>
                <span style={{ fontSize:14, fontWeight:700, color:t.green, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(dailyLeft,{noDecimals:true})}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Budget vs Actual ── */}
        <motion.div className={styles.card} variants={cardVar}
          style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.glowShadow }}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle} style={{ color:t.text }}>Budget vs Actual</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button className={styles.monthChip} style={{ background:t.surface, border:`1px solid ${t.border}`, color:t.text2 }}>
                This Month <ChevronDown size={13}/>
              </button>
              <MoreVertical size={16} color={t.text3}/>
            </div>
          </div>

          <div className={styles.legendTotals}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span className={styles.dot} style={{ background:DS.purple }}/>
                <span style={{ fontSize:12.5, color:t.text2 }}>{L.total}</span>
              </div>
              <div style={{ fontSize:19, fontWeight:800, color:t.text, fontFamily:'Space Grotesk, Inter, sans-serif', marginTop:2 }}>{fmt(totalBudget,{noDecimals:true})}</div>
            </div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span className={styles.dot} style={{ background:t.green }}/>
                <span style={{ fontSize:12.5, color:t.text2 }}>{L.totalSpent}</span>
              </div>
              <div style={{ fontSize:19, fontWeight:800, color:t.text, fontFamily:'Space Grotesk, Inter, sans-serif', marginTop:2 }}>{fmt(totalSpent,{noDecimals:true})}</div>
            </div>
          </div>

          <div style={{ height:220, marginTop:8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top:8, right:4, left:0, bottom:22 }} barGap={4}>
                <CartesianGrid strokeDasharray="4 6" stroke={t.grid} vertical={false}/>
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0}
                  tick={<CatTick data={barData} color={t.text3}/>} height={44}/>
                <YAxis tickLine={false} axisLine={false} width={40}
                  tick={{ fontSize:10.5, fill:t.text3 }}
                  tickFormatter={v => v >= 1000 ? `₹${Math.round(v/1000)}K` : `₹${v}`}/>
                <Tooltip cursor={{ fill:'rgba(139,92,246,.06)' }}
                  contentStyle={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:12, fontSize:12 }}
                  labelStyle={{ color:t.text2 }} itemStyle={{ fontWeight:700 }}
                  formatter={v => fmt(v,{noDecimals:true})}/>
                <Bar dataKey="Budget" fill={DS.purple} radius={[5,5,0,0]} animationDuration={900}/>
                <Bar dataKey="Spent"  fill={t.green}  radius={[5,5,0,0]} animationDuration={900} animationBegin={150}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* insight strip */}
          <div className={styles.insightStrip} style={{ background:t.insightBg }}>
            <div className={styles.bulb} style={{ background:DS.purple }}>
              <Lightbulb size={17} color="#fff"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:t.text }}>Good going!</div>
              <div style={{ fontSize:12.5, color:t.text2, marginTop:1 }}>
                You're under budget in {underCount} of {budgets.length} categories.
              </div>
            </div>
            <ChevronRight size={17} color={t.text3}/>
          </div>
        </motion.div>

        {/* ── Budget by Category ── */}
        <motion.div className={styles.card} variants={cardVar}
          style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle} style={{ color:t.text }}>{isIncome ? 'Income by Source' : 'Budget by Category'}</span>
            <button className={styles.linkBtn} style={{ color:DS.purple }} onClick={openAddBudget}>{isIncome ? 'Edit Income' : 'Edit Budget'}</button>
          </div>

          <div className={styles.catList}>
            {budgets.map((b,i) => {
              const amt = parseFloat(b.amount||0), sp = parseFloat(b.spent||0);
              const pct = amt > 0 ? Math.round((sp/amt)*100) : 0;
              const over = sp > amt;
              return (
                <motion.div key={b.id} className={styles.catRow}
                  initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} transition={{ delay:.25+i*.06 }}
                  onClick={()=>{ if (!b.demo) { setEditBudget(b); setShowModal(true); } }}>
                  <div className={styles.catIcon} style={{ background:b.color||DS.purple }}>
                    <CategoryGlyph name={b.name} emoji={b.emoji} size={18} color="#fff"/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 }}>
                      <span style={{ fontSize:14.5, fontWeight:700, color:t.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.name}</span>
                      <span style={{ fontSize:13.5, color:t.text2, whiteSpace:'nowrap', fontFamily:'Space Grotesk, Inter, sans-serif' }}>
                        <b style={{ color:t.text }}>{fmt(sp,{noDecimals:true})}</b> / {fmt(amt,{noDecimals:true})}
                      </span>
                    </div>
                    <div className={styles.catTrack} style={{ background:t.track }}>
                      <motion.div style={{ height:'100%', borderRadius:99, background:b.color||DS.purple }}
                        initial={{ width:0 }} animate={{ width:`${Math.min(100,pct)}%` }}
                        transition={{ duration:.8, delay:.35+i*.06, ease:[.2,.8,.2,1] }}/>
                    </div>
                  </div>
                  <span style={{ fontSize:13.5, fontWeight:800, color: over ? '#EF4444' : t.green, width:38, textAlign:'right', flexShrink:0 }}>{pct}%</span>
                  <ChevronRight size={16} color={t.text3} style={{ flexShrink:0 }}/>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Budget Insights ── */}
        <motion.div className={styles.card} variants={cardVar}
          style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle} style={{ color:t.text }}>Budget Insights</span>
            <button className={styles.linkBtn} style={{ color:DS.purple }}>View All</button>
          </div>
          <div className={styles.tiles}>
            {insightTiles.map(({ Icon, color, title, body }, i) => (
              <motion.div key={i} className={styles.tile}
                style={{ background:t.surface, border:`1px solid ${t.border}` }}
                initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.35+i*.09 }}
                whileHover={{ y:-3 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div className={styles.tileIcon} style={{ background:color }}>
                    <Icon size={18} color="#fff"/>
                  </div>
                  <ChevronRight size={16} color={t.text3}/>
                </div>
                <div style={{ fontSize:14.5, fontWeight:700, color:t.text, marginTop:12 }}>{title}</div>
                <div style={{ fontSize:12.5, color:t.text2, marginTop:4, lineHeight:1.5 }}>{body}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {budgets.length === 0 && (
          <motion.div variants={cardVar}
            style={{ textAlign:'center', padding:'40px 20px', background:t.card, border:`1px solid ${t.border}`, borderRadius:20, boxShadow:t.shadow }}>
            <div style={{ fontSize:38, marginBottom:12 }}>🎯</div>
            <div style={{ fontSize:16, fontWeight:700, color:t.text }}>{isIncome ? 'No income targets yet' : 'No budgets yet'}</div>
            <div style={{ fontSize:13, color:t.text2, marginTop:4, marginBottom:16 }}>
              {isIncome ? 'Set expected income per source to track your earnings' : 'Set monthly limits per category to stay on track'}
            </div>
            <button onClick={openAddBudget}
              style={{ padding:'12px 22px', borderRadius:14, border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
                background:'linear-gradient(180deg,#8B5CF6,#6D28D9)', color:'#fff', boxShadow:'0 8px 24px rgba(124,58,237,.35)' }}>
              {isIncome ? '+ Add Income Target' : '+ Create Budget'}
            </button>
          </motion.div>
        )}
      </motion.div>

      {showModal && (
        <BudgetModal
          budget={editBudget}
          initialType={activeType}
          onClose={() => { setShowModal(false); setEditBudget(null); }}
          onSaved={() => { invalidateFinance(qc); setShowModal(false); setEditBudget(null); }}
        />
      )}
    </div>
  );
}

/* ═══ Existing modal (unchanged) ═════════════════════════════════════════ */
function BudgetModal({ budget, initialType='expense', onClose, onSaved }) {
  const [form, setForm] = useState({
    name:       budget?.name       || '',
    amount:     budget?.amount     || '',
    emoji:      budget?.emoji      || '📌',
    color:      budget?.color      || '#8B5CF6',
    category_id:budget?.category_id|| '',
    period:     budget?.period     || 'monthly',
    start_date: budget?.start_date || new Date().toISOString().split('T')[0],
    type:       budget?.type       || initialType,
  });
  const isIncome = form.type === 'income';
  const [error, setError] = useState('');

  const { data: categories } = useQuery({ queryKey:['categories'], queryFn:() => categoriesAPI.getAll().then(r=>r.data.data) });

  const mutation = useMutation({
    mutationFn: (data) => budget ? budgetsAPI.update(budget.id,data) : budgetsAPI.create(data),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.message || 'Error saving budget'),
  });

  const PRESET_COLORS = ['#8B5CF6','#3B82F6','#22C55E','#F59E0B','#EC4899','#FF79A8','#00C896','#A29BFE'];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{budget ? 'Edit' : 'New'} {isIncome ? 'Income Target' : 'Budget'}</div>
        {error && <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'8px 12px', borderRadius:10, marginBottom:14, fontSize:13 }}>{error}</div>}

        {!budget && (
          <div style={{ display:'flex', gap:6, padding:4, borderRadius:12, background:'var(--surface)', border:'1px solid var(--border)', marginBottom:14 }}>
            {[{ k:'expense', label:'Expense' }, { k:'income', label:'Income' }].map(o => (
              <button key={o.k} type="button" onClick={()=>setForm(f=>({...f, type:o.k, category_id:''}))}
                style={{ flex:1, padding:'9px 0', border:'none', cursor:'pointer', borderRadius:9, fontSize:13.5, fontWeight:700,
                  background: form.type===o.k ? (o.k==='income' ? '#22C55E' : '#8B5CF6') : 'transparent',
                  color: form.type===o.k ? '#fff' : 'var(--text2)' }}>{o.label}</button>
            ))}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">{isIncome ? 'Income Source' : 'Budget Name'}</label>
          <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Food & Groceries"/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input className="form-input" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="500"/>
          </div>
          <div className="form-group">
            <label className="form-label">Period</label>
            <ThemedSelect value={form.period} onChange={v=>setForm(f=>({...f,period:v}))}
              options={[
                { value:'monthly', label:'Monthly', icon:<CalendarDays size={16} color="#8B5CF6"/> },
                { value:'weekly',  label:'Weekly',  icon:<CalendarRange size={16} color="#8B5CF6"/> },
                { value:'yearly',  label:'Yearly',  icon:<Calendar size={16} color="#8B5CF6"/> },
              ]}/>
          </div>
          <div className="form-group">
            <label className="form-label">Emoji</label>
            <input className="form-input" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="📌" style={{ fontSize:20, textAlign:'center' }}/>
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Color</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  style={{ width:28, height:28, borderRadius:8, background:c, border: form.color===c ? '3px solid var(--text)' : '2px solid transparent', cursor:'pointer', outline:'none' }}/>
              ))}
              <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                style={{ width:30, height:30, borderRadius:8, cursor:'pointer', border:'1px solid var(--border)', padding:2 }}/>
            </div>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Category (optional)</label>
            <ThemedSelect value={form.category_id} onChange={v=>setForm(f=>({...f,category_id:v}))}
              placeholder="No category link"
              options={[
                { value:'', label:'No category link', icon:<Ban size={16} color="#9896B2"/> },
                ...(categories||[]).filter(c=>c.type===form.type||c.type==='both').map(c=>({ value:c.id, label:c.name, icon:<CategoryGlyph name={c.name} emoji={c.emoji} icon={c.icon} size={16}/> })),
              ]}/>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:8, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={()=>mutation.mutate(form)}
            style={{ background:'linear-gradient(135deg,#8B5CF6,#3B82F6)', border:'none', boxShadow:'0 4px 14px rgba(139,92,246,.35)' }}>
            {mutation.isPending ? 'Saving…' : budget ? 'Update' : (isIncome ? 'Add Income Target' : 'Create Budget')}
          </button>
        </div>
      </div>
    </div>
  );
}
