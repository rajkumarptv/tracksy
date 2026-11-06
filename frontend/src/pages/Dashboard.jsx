import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  Landmark, ChevronRight, ChevronDown, Bell, Search, Eye,
  ArrowDown, ArrowUp, Activity, ArrowLeftRight, Wallet,
  ListChecks, Percent, Sparkles, PiggyBank, CalendarDays, Check, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { dashboardAPI, walletsAPI, goalsAPI, recurringAPI, forecastAPI } from '../services/api';
import { track } from '../lib/analytics';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { useFmt } from '../i18n';
import { MerchantLogo, CategoryIcon } from '../components/icons';
import AmountToggle from '../components/AmountToggle';
import styles from './Dashboard.module.css';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const now = new Date();

import { THEME } from '../theme';

/* ── Format ₹ in lakh shorthand for chart axis: 140000 → ₹1.40L ──────── */
function lakh(v) {
  if (v >= 100000) return `₹${(v/100000).toFixed(2)}L`;
  if (v >= 1000)   return `₹${Math.round(v/1000)}K`;
  return `₹${v}`;
}

/* ── Framer motion variants ──────────────────────────────────────────── */
const containerVar = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const cardVar = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show:   { opacity: 1, y: 0, scale: 1, transition: { type:'spring', stiffness: 260, damping: 26 } },
};

/* ── Animated number count-up ────────────────────────────────────────── */
function CountUp({ value, fmt }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = value || 0;
    if (target === 0) { setDisplay(0); return; }
    const dur = 900;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(target * ease);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(display, { noDecimals: true })}</>;
}

/* ── Chart tooltip ───────────────────────────────────────────────────── */
function BalTip({ active, payload, label, fmt, c }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: c.cardBg, border:`1px solid ${c.grid}`, borderRadius:12, padding:'8px 12px', boxShadow:'0 8px 24px rgba(15,23,42,.14)' }}>
      <div style={{ fontSize:11, color:c.text3, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:700, color:c.green }}>{fmt(payload[0].value||0,{noDecimals:true})}</div>
    </div>
  );
}

/* ── Period helpers ──────────────────────────────────────────────────── */
const PERIOD_LABEL = {
  week:'This Week',   lastweek:'Last Week',
  month:'This Month', lastmonth:'Last Month',
  year:'This Year',   lastyear:'Last Year',
};
const PERIOD_KEYS = ['week','lastweek','month','lastmonth','year','lastyear'];
const periodUnit   = (p) => p.includes('year') ? 'year' : p.includes('week') ? 'week' : 'month';
const periodOffset = (p) => p.startsWith('last') ? -1 : 0;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/* Range for a period key. `extra` shifts by additional whole units
   (e.g. -1 for the immediately previous comparable period). */
function periodRange(period, extra = 0) {
  const unit = periodUnit(period);
  const off  = periodOffset(period) + extra;
  const b = new Date();
  if (off) {
    if (unit === 'week') b.setDate(b.getDate() + off * 7);
    else if (unit === 'year') b.setFullYear(b.getFullYear() + off);
    else b.setMonth(b.getMonth() + off);
  }
  const y = b.getFullYear(), m = b.getMonth(), d = b.getDate();
  if (unit === 'week') {
    const dow = (b.getDay() + 6) % 7;                  // Monday = 0
    return { start: new Date(y, m, d - dow), end: new Date(y, m, d - dow + 6) };
  }
  if (unit === 'year') return { start: new Date(y,0,1), end: new Date(y,11,31) };
  return { start: new Date(y, m, 1), end: new Date(y, m+1, 0) };   // month
}

/* ── Period selector dropdown (Week / Month / Year) ──────────────────── */
function PeriodPill({ period, setPeriod, c, isDark }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <button className={styles.periodPill} onClick={()=>setOpen(o=>!o)} style={{
        background: c.cardBg,
        border: `1.5px solid ${open ? c.purple : c.border}`,
        color: c.text2,
      }}>
        {PERIOD_LABEL[period]} <ChevronDown size={13} style={{ transform: open?'rotate(180deg)':'none', transition:'transform .15s' }}/>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div onClick={()=>setOpen(false)} style={{ position:'fixed', inset:0, zIndex:90 }}/>
            <motion.div
              initial={{ opacity:0, y:-6, scale:.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-6, scale:.97 }}
              transition={{ duration:.14 }}
              style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:91, minWidth:140,
                background:c.cardBg, border:`1px solid ${c.border||'rgba(255,255,255,.1)'}`, borderRadius:12,
                boxShadow:'0 12px 32px rgba(15,23,42,.18)', overflow:'hidden', padding:5 }}>
              {PERIOD_KEYS.map((p, i) => {
                const sel = p === period;
                return (
                  <button key={p} onClick={()=>{ setPeriod(p); setOpen(false); }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'9px 11px', borderRadius:9, border:'none', cursor:'pointer', textAlign:'left',
                      marginTop: i%2===0 && i>0 ? 4 : 0,
                      borderTop: i%2===0 && i>0 ? `1px solid ${c.divider||'rgba(255,255,255,.06)'}` : 'none',
                      paddingTop: i%2===0 && i>0 ? 11 : 9,
                      background: sel ? (isDark?'rgba(29,78,216,.16)':'#EFF6FF') : 'transparent',
                      color: sel ? (isDark?'#93C5FD':c.purple) : c.text, fontSize:13, fontWeight: sel?700:500, fontFamily:'inherit' }}>
                    {PERIOD_LABEL[p]} {sel && <Check size={14}/>}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DEV-ONLY demo data — realistic day-by-day transactions so the balance graph
   visibly rises and falls. Enabled only in dev with ?demo=1 (never in prod).
═══════════════════════════════════════════════════════════════════════ */
function buildDemo() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const isoAt = (day) => new Date(y, m, day, 10, 0, 0).toISOString();
  const tx = [];
  let id = 1;
  const add = (day, type, amount, name, cat) => tx.push({
    id: 'demo' + id++, type, amount, description: name, payment_name: name,
    category_name: cat, transaction_date: isoAt(day), wallet_id: 'w1',
  });

  // Salary in early, mid-month freelance, plus daily-ish spending of varying size
  add(1, 'income', 85000, 'Monthly Salary', 'Salary');
  add(2, 'expense', 38000, 'Apartment Rent', 'Rent & Bills');
  const spends = [
    [3,4200,'Groceries','Groceries'],[4,1250,'Swiggy','Food & Dining'],[5,899,'Fuel','Transport'],
    [6,15600,'Electronics','Shopping'],[8,2100,'Dining Out','Food & Dining'],[9,640,'Cab','Transport'],
    [10,3499,'Pharmacy','Health'],[11,1199,'Movie & Snacks','Entertainment'],[13,5400,'Clothes','Shopping'],
    [15,760,'Coffee','Food & Dining'],[16,2890,'Groceries','Groceries'],[18,1450,'Fuel','Transport'],
    [20,999,'Subscriptions','Entertainment'],[22,4300,'Weekend Trip','Travel'],[24,1780,'Groceries','Groceries'],
    [26,650,'Snacks','Food & Dining'],[28,2200,'Gift','Gifts'],
  ];
  spends.forEach(([d, a, n, c]) => add(d, 'expense', a, n, c));
  add(14, 'income', 18000, 'Freelance Project', 'Freelance');
  add(21, 'income', 6500, 'Cashback & Interest', 'Income');
  // A couple of transfers to/from bank
  tx.push({ id:'demoT1', type:'transfer', amount:10000, transfer_direction:'out', description:'Transfer → Savings', payment_name:'Transfer', transaction_date:isoAt(12), wallet_id:'w1' });
  tx.push({ id:'demoT2', type:'transfer', amount:5000,  transfer_direction:'in',  description:'Transfer ← ICICI',   payment_name:'Transfer', transaction_date:isoAt(23), wallet_id:'w1' });

  const income  = tx.filter(t => t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = tx.filter(t => t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const spendableEnd = 47850; // resulting current bank+cash balance
  return {
    summary:      { income, expense, total_balance: spendableEnd - 121000 },
    prevSummary:  { income: 79000, expense: 71000 },
    catBreakdown: [
      { name:'Rent & Bills', value:38000 }, { name:'Shopping', value:21000 },
      { name:'Food & Dining', value:5650 }, { name:'Travel', value:4300 },
      { name:'Health', value:3499 }, { name:'Transport', value:2989 },
    ],
    wallets: [
      { id:'w1', name:'HDFC Savings', type:'bank', balance:39850, last_four:'4021' },
      { id:'w2', name:'Cash Wallet',  type:'cash', balance:8000 },
      { id:'w3', name:'Gold Loan',    type:'gold_loan', balance:-121000 },
    ],
    recentTx: tx.reverse(),
    recurring: [], goals: [],
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const fmt = useFmt();
  const isDark = theme === 'dark';
  const c = isDark ? THEME.dark : THEME.light;

  const [includedIds, setIncludedIds] = useState([]); // [] = all accounts included
  const [searchTerm, setSearchTerm] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'year'

  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;

  /* Date range for the whole dashboard, driven by the period selector.
     The backend filters `transaction_date < end_date`, so end_date must be the
     day AFTER the period's last day to keep the last day inclusive. */
  const unit = periodUnit(period);
  const nextDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const { start: rStart, end: rEnd } = periodRange(period);
  const range = { start_date: iso(rStart), end_date: iso(nextDay(rEnd)) };
  const { start: pStart, end: pEnd } = periodRange(period, -1);
  const prevRange = { start_date: iso(pStart), end_date: iso(nextDay(pEnd)) };

  /* ── Queries (all keyed by period so they refetch on change) ── */
  const { data: summaryRaw } = useQuery({
    queryKey:['dash-summary-cur', period],
    queryFn: () => dashboardAPI.summary(range).then(r=>r.data.data),
  });
  const { data: prevSummaryRaw } = useQuery({
    queryKey:['dash-summary-prev', period],
    queryFn: () => dashboardAPI.summary(prevRange).then(r=>r.data.data),
  });
  const { data: catBreakdownRaw } = useQuery({
    queryKey:['cat-breakdown', period],
    queryFn: () => dashboardAPI.categoryBreakdown(range).then(r=>r.data.data),
  });
  const { data: walletsRaw } = useQuery({ queryKey:['wallets'], queryFn:()=>walletsAPI.getAll().then(r=>r.data.data) });
  const { data: recentTxRaw } = useQuery({
    queryKey:['recent-tx-dash', period],
    queryFn: () => dashboardAPI.recentTransactions({ ...range, limit:1000 }).then(r=>r.data.data),
  });
  const { data: goalsRaw } = useQuery({
    queryKey:['goals'],
    queryFn: () => goalsAPI.getAll().then(r=>r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  // 60-day cash-flow forecast: powers the shortfall warning and the exact upcoming-payment dates
  const { data: forecast } = useQuery({
    queryKey:['forecast', 60],
    queryFn: () => forecastAPI.cashflow({ days: 60 }).then(r=>r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const { data: recurringRaw } = useQuery({
    queryKey:['recurring'],
    queryFn: () => recurringAPI.getAll().then(r=>r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  // Authoritative daily balance history (from the transactions ledger)
  const histWalletId = includedIds.length === 1 ? includedIds[0] : undefined;
  const { data: balanceHist } = useQuery({
    queryKey:['balance-history', period, histWalletId],
    queryFn: () => dashboardAPI.balanceHistory({
      start_date: range.start_date, end_date: iso(rEnd), scope:'spendable',
      ...(histWalletId ? { wallet_id: histWalletId } : {}),
    }).then(r => r.data.data),
  });

  // DEV-only demo (never in production): visit /?demo=1 on the dev server
  const DEMO = useMemo(() => (
    import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')
      ? buildDemo() : null
  ), []);
  const summary      = DEMO ? DEMO.summary      : summaryRaw;
  const prevSummary  = DEMO ? DEMO.prevSummary  : prevSummaryRaw;
  const catBreakdown = DEMO ? DEMO.catBreakdown : catBreakdownRaw;
  const wallets      = DEMO ? DEMO.wallets      : walletsRaw;
  const recentTx     = DEMO ? DEMO.recentTx     : recentTxRaw;
  const goals        = DEMO ? DEMO.goals        : goalsRaw;
  const recurring    = DEMO ? DEMO.recurring    : recurringRaw;

  /* ── Account filter (multi-select, inline in the balance card) ── */
  const LIABILITY_TYPES = ['visa','mastercard','home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','bnpl','family_borrow','emi','lending'];
  const accounts = (wallets||[]).filter(w => !LIABILITY_TYPES.includes(w.type));

  // Effective included set: empty state means "all accounts included"
  const effIncluded = includedIds.length
    ? new Set(includedIds.map(String))
    : new Set(accounts.map(a => String(a.id)));
  const isFiltered = accounts.length > 0 && effIncluded.size < accounts.length;
  const activeAccounts = accounts.filter(a => effIncluded.has(String(a.id)));

  const toggleAcc = (id) => setIncludedIds(() => {
    const eff = new Set(effIncluded);
    const sid = String(id);
    eff.has(sid) ? eff.delete(sid) : eff.add(sid);
    const arr = [...eff];
    // never allow "none" and collapse "all" back to the [] sentinel
    if (arr.length === 0 || arr.length === accounts.length) return [];
    return arr;
  });
  const selectAll = () => setIncludedIds([]);

  /* Transactions scoped to the included accounts (or all) */
  const scopedTx = useMemo(() => {
    if (!isFiltered) return recentTx || [];
    return (recentTx || []).filter(tx =>
      effIncluded.has(String(tx.wallet_id)) || effIncluded.has(String(tx.to_wallet_id))
    );
  }, [recentTx, isFiltered, includedIds]);

  /* ── Derived numbers (real data only, for the selected period) ── */
  const hasData = (recentTx || []).length > 0;

  // Income/expense: from the period summary, or from the filtered accounts' tx
  const accIncome  = scopedTx.filter(t=>t.type==='income').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const accExpense = scopedTx.filter(t=>t.type==='expense').reduce((s,t)=>s+parseFloat(t.amount||0),0);

  const income  = isFiltered ? accIncome  : parseFloat(summary?.income  || 0);
  const expense = isFiltered ? accExpense : parseFloat(summary?.expense || 0);
  // Available balance = spendable money only (bank + cash), so loans/cards
  // don't drag the headline into confusing negatives.
  const SPENDABLE_TYPES = ['bank','cash'];
  const balance = (isFiltered ? activeAccounts : (wallets || []))
    .filter(w => SPENDABLE_TYPES.includes(w.type))
    .reduce((s, w) => s + parseFloat(w.balance || 0), 0);
  const net     = income - expense;

  // Change vs the previous equivalent period (last week / month / year)
  const prevIncome  = parseFloat(prevSummary?.income  || 0);
  const prevExpense = parseFloat(prevSummary?.expense || 0);
  const prevNet     = prevIncome - prevExpense;
  const hasPrev     = !!prevSummary && (prevIncome !== 0 || prevExpense !== 0);
  // % change vs the previous period; "New" when there's no comparable history
  const balChg  = hasPrev && prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : null;
  const balUp   = balChg == null ? true : balChg >= 0;
  const prevLabel = unit === 'week' ? 'vs last week' : unit === 'year' ? 'vs last year' : 'vs last month';

  const txCount = scopedTx.length;
  // KPI: avg daily spend across the elapsed days of the period
  const elapsedDays = Math.max(1, Math.floor((Math.min(now, rEnd) - rStart) / 86400000) + 1);
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;
  const dailyAvgSpend = Math.round(expense / elapsedDays);

  /* ── Search → open Transactions with the query ── */
  const runSearch = () => {
    const q = searchTerm.trim();
    navigate(q ? `/transactions?search=${encodeURIComponent(q)}` : '/transactions');
  };

  /* ── Balance area chart — daily END balance of spendable (bank+cash) accounts.
     Each tx moves the spendable balance: income/transfer-in +, expense/transfer-out −,
     but only when it touches a spendable account. Transfers between two spendable
     accounts net to zero (an out on one, an in on the other). ── */
  const balanceSeries = useMemo(() => {
    const spendableIds = new Set(
      (wallets || []).filter(w => ['bank','cash'].includes(w.type)).map(w => String(w.id))
    );
    const delta = (tx) => {
      if (!spendableIds.has(String(tx.wallet_id))) return 0;
      const a = parseFloat(tx.amount || 0);
      if (tx.type === 'income')  return a;
      if (tx.type === 'expense') return -a;
      if (tx.type === 'transfer') return tx.transfer_direction === 'in' ? a : -a;
      return 0;
    };
    const net = scopedTx.reduce((s, tx) => s + delta(tx), 0);
    const startBal = balance - net; // balance = current spendable → walk back to period start

    if (unit === 'year') {
      const monthly = new Array(12).fill(0);
      scopedTx.forEach(tx => {
        const d = new Date(tx.transaction_date);
        if (d.getFullYear() !== rStart.getFullYear()) return;
        monthly[d.getMonth()] += delta(tx);
      });
      let run = startBal;
      return monthly.map((v,i)=>{ run += v; return { name: MONTHS[i], value: run }; });
    }

    // week / month → daily buckets across the range
    const days = [];
    for (let d = new Date(rStart); d <= rEnd; d.setDate(d.getDate()+1)) days.push(new Date(d));
    const daily = days.map(()=>0);
    scopedTx.forEach(tx => {
      const dt = new Date(tx.transaction_date);
      const idx = days.findIndex(d => d.toDateString() === dt.toDateString());
      if (idx < 0) return;
      daily[idx] += delta(tx);
    });
    let run = startBal;
    return days.map((d,i)=>{ run += daily[i]; return { name:`${d.getDate()} ${MONTHS[d.getMonth()]}`, value: run }; });
  }, [scopedTx, balance, period, wallets]);

  /* Prefer the authoritative backend balance history; fall back to the
     client-side reconstruction (and always use it in ?demo mode). */
  const chartData = useMemo(() => {
    if (DEMO || !Array.isArray(balanceHist) || balanceHist.length === 0) return balanceSeries;
    if (unit === 'year') {
      // one point per month → last balance of each month
      const byMonth = {};
      balanceHist.forEach(p => { byMonth[new Date(p.date).getMonth()] = p.balance; });
      let last = balanceHist[0].balance;
      return MONTHS.map((name, i) => { if (byMonth[i] != null) last = byMonth[i]; return { name, value: last }; });
    }
    // Stop the line at today — days still to come have no balance yet.
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return balanceHist.map(p => {
      const d = new Date(p.date);
      return { name: `${d.getDate()} ${MONTHS[d.getMonth()]}`, value: String(p.date).slice(0, 10) > today ? null : p.balance };
    });
  }, [balanceHist, balanceSeries, unit, DEMO]);

  const xTicks = useMemo(() => {
    if (!chartData.length) return [];
    if (unit === 'year') return ['Jan','Apr','Jul','Oct','Dec'];
    if (unit === 'week') return chartData.map(p=>p.name); // all 7 days
    const n = chartData.length;
    return [0, Math.floor(n*0.25), Math.floor(n*0.5), Math.floor(n*0.75), n-1].map(i=>chartData[i]?.name);
  }, [chartData, period]);

  /* ── Spending categories (real data only) ── */
  const spendCats = useMemo(() => {
    const raw = (catBreakdown||[]).filter(x=>x.value>0);
    if (raw.length === 0) return [];
    const top = raw.slice(0,4);
    const restVal = raw.slice(4).reduce((s,x)=>s+x.value,0);
    const list = restVal > 0 ? [...top, { name:'Others', value:restVal, emoji:'🎯' }] : top;
    const PALETTE = ['#2A78D6','#EB6834','#1BAF7A','#EDA100','#E87BA4','#1D4ED8','#008300','#0D9488'];
    return list.map((x,i)=>({ ...x, color: PALETTE[i % PALETTE.length] }));
  }, [catBreakdown, c]);
  const spendTotal = spendCats.reduce((s,x)=>s+x.value,0);

  /* ── Notifications — real, data-derived (no fake counts) ── */
  const notifications = useMemo(() => {
    const list = [];
    const totalDebt = (wallets||[])
      .filter(w => parseFloat(w.balance||0) < 0)
      .reduce((s,w) => s + Math.abs(parseFloat(w.balance||0)), 0);
    if (net < 0)
      list.push({ emoji:'⚠️', text:`You spent ${fmt(Math.abs(net),{noDecimals:true})} more than you earned this month.`, to:'/transactions' });
    if (totalDebt > 0)
      list.push({ emoji:'💳', text:`${fmt(totalDebt,{noDecimals:true})} outstanding across your debts.`, to:'/debts' });
    const fc = forecast?.summary;
    if (fc?.shortfallDate && fc.daysUntilShortfall <= 30)
      list.unshift({ emoji:'🚨', text:`Your bank and cash balance may go below zero on ${new Date(fc.shortfallDate+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})} (short by ${fmt(fc.shortfallAmount,{noDecimals:true})}).`, to:'/forecast' });
    if (savingsRate >= 20)
      list.push({ emoji:'🎉', text:`Great job — you saved ${savingsRate}% of your income this month.`, to:'/goals' });
    if (spendCats[0])
      list.push({ emoji:'📊', text:`${spendCats[0].name} is your top spend at ${fmt(spendCats[0].value,{noDecimals:true})}.`, to:'/budget' });
    return list;
  }, [wallets, net, savingsRate, spendCats, forecast]);

  /* Notification "seen" state — the badge clears once you open the panel and
     only reappears when the set of alerts actually changes. */
  const notifSig = useMemo(() => notifications.map(n => n.text).join('||'), [notifications]);
  const [seenSig, setSeenSig] = useState(() => { try { return localStorage.getItem('tracksy-notif-seen') || ''; } catch { return ''; } });
  const hasUnseen = notifications.length > 0 && notifSig !== seenSig;
  const markNotifSeen = () => { setSeenSig(notifSig); try { localStorage.setItem('tracksy-notif-seen', notifSig); } catch {} };

  /* ── Recent transactions (real data only) ── */
  const recentList = useMemo(() => (recentTx||[]).slice(0,4), [recentTx]);

  /* ── Upcoming payments (credit-card bills, loan EMIs, recurring bills) ── */
  const upcomingPayments = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + 31);
    const dim = (y,m) => new Date(y, m+1, 0).getDate();
    const nextByDay = (day) => {
      if (!day) return null;
      const y = today.getFullYear(), m = today.getMonth();
      let d = new Date(y, m, Math.min(day, dim(y,m)));
      if (d < today) { const nm = m+1; d = new Date(y, nm, Math.min(day, dim(y,nm))); }
      return d;
    };
    const events = [];
    (wallets||[]).forEach(w => {
      const bal = Math.abs(parseFloat(w.balance||0));
      if (['visa','mastercard'].includes(w.type) && w.payment_day && bal > 0) {
        const d = nextByDay(w.payment_day);
        if (d) events.push({ id:'cc'+w.id, name:`${w.name} bill`, amount:bal, date:d, kind:'card' });
      }
      if (w.emi_day && w.emi_amount) {
        const d = nextByDay(w.emi_day);
        if (d) events.push({ id:'emi'+w.id, name:`${w.name} EMI`, amount:parseFloat(w.emi_amount), date:d, kind:'loan' });
      }
    });
    if (forecast) {
      // Exact dates from the forecast (handles weekly / yearly rules and month ends)
      forecast.events.forEach((e, i) => {
        if (e.kind !== 'recurring' || e.amount >= 0) return;
        events.push({ id:'fc'+i, name:e.label, amount:Math.abs(e.amount), date:new Date(e.date+'T00:00:00'), kind:'recurring' });
      });
    } else {
      (recurring||[]).forEach(r => {
        if (r.is_active === false || r.type !== 'expense') return;
        const day = new Date(r.start_date).getDate();
        const d = nextByDay(day);
        if (d) events.push({ id:'rc'+r.id, name:r.payment_name || 'Recurring', amount:parseFloat(r.amount||0), date:d, kind:'recurring' });
      });
    }
    return events.filter(e => e.date >= today && e.date <= horizon).sort((a,b) => a.date - b.date);
  }, [wallets, recurring, forecast]);

  const greetingHour = now.getHours();
  const greeting = greetingHour < 12 ? 'Good Morning' : greetingHour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = (user?.first_name || user?.name || 'there').split(' ')[0];
  const inPct  = income  > 0 ? Math.min(100, (income  / Math.max(income, expense)) * 100) : 0;
  const outPct = expense > 0 ? Math.min(100, (expense / Math.max(income, expense)) * 100) : 0;

  /* ═════════════════ RENDER ═════════════════ */
  return (
    <div className={styles.page} style={{ background: 'var(--bg)' }}>
      <motion.div className={styles.inner} variants={containerVar} initial="hidden" animate="show">

        {/* ── Header ─────────────────────────────────────────────── */}
        <motion.div className={styles.header} variants={cardVar}>
          <div className={styles.headerLeft}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar} style={{ border:`3px solid ${c.blue}` }}>
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}/>
                  : <span style={{ fontSize:24 }}>{(firstName[0]||'U').toUpperCase()}</span>}
              </div>
              <span className={styles.onlineDot} style={{ background:c.green, borderColor:'var(--bg)' }}/>
            </div>
            <div className={styles.greetText}>
              <div className={styles.greetTitle} style={{ color:c.text }}>{greeting}, {firstName} 👋</div>
              <div className={styles.greetSub} style={{ color:c.text2 }}>Let's make today financially amazing!</div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.searchBox} style={{ background: c.cardBg, border:`1px solid ${c.border}` }}>
              <Search size={16} color={c.text3}/>
              <input placeholder="Search transactions…" style={{ color:c.text }}
                value={searchTerm}
                onChange={e=>setSearchTerm(e.target.value)}
                onKeyDown={e=>{ if (e.key === 'Enter') runSearch(); }}/>
            </div>
            <button className={`${styles.iconBtn} ${styles.mobileSearchBtn}`}
              style={{ background: c.cardBg, border:`1px solid ${c.border}` }}
              onClick={runSearch} aria-label="Search">
              <Search size={18} color={c.text2}/>
            </button>

            {/* Notifications — real, data-derived */}
            <div style={{ position:'relative' }}>
              <button className={styles.iconBtn} onClick={()=>setNotifOpen(o=>{ const next=!o; if(next) markNotifSeen(); return next; })} aria-label="Notifications"
                style={{ background: c.cardBg, border:`1px solid ${c.border}` }}>
                <Bell size={18} color={c.text2}/>
                {hasUnseen && <span className={styles.bellBadge}>{notifications.length}</span>}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <>
                    <div onClick={()=>setNotifOpen(false)} style={{ position:'fixed', inset:0, zIndex:80 }}/>
                    <motion.div
                      initial={{ opacity:0, y:-8, scale:.98 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-8, scale:.98 }}
                      transition={{ duration:.16 }}
                      style={{ position:'absolute', top:'calc(100% + 10px)', right:0, zIndex:81, width:'min(320px, calc(100vw - 32px))',
                        background:c.cardBg, border:`1px solid ${c.border||'rgba(255,255,255,.1)'}`, borderRadius:12,
                        boxShadow:'0 12px 32px rgba(15,23,42,.18)', overflow:'hidden' }}>
                      <div style={{ padding:'14px 16px', borderBottom:`1px solid ${c.divider||'rgba(255,255,255,.06)'}`, fontSize:14, fontWeight:600, color:c.text }}>
                        Notifications
                      </div>
                      {notifications.length === 0 ? (
                        <div style={{ padding:'28px 16px', textAlign:'center' }}>
                          <div style={{ fontSize:26, marginBottom:6 }}>✅</div>
                          <div style={{ fontSize:13, color:c.text2 }}>You're all caught up</div>
                        </div>
                      ) : notifications.map((n,i)=>(
                        <button key={i} onClick={()=>{ setNotifOpen(false); navigate(n.to); }}
                          style={{ display:'flex', gap:11, alignItems:'flex-start', width:'100%', textAlign:'left', padding:'12px 16px', background:'transparent', border:'none', borderBottom: i<notifications.length-1?`1px solid ${c.divider||'rgba(255,255,255,.05)'}`:'none', cursor:'pointer' }}>
                          <span style={{ fontSize:17, flexShrink:0, marginTop:1 }}>{n.emoji}</span>
                          <span style={{ fontSize:13, color:c.text, lineHeight:1.45 }}>{n.text}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Cash-flow outlook: warning when a shortfall is coming, calm status otherwise ── */}
        {forecast?.summary && (() => {
          const f = forecast.summary;
          const warn = f.shortfallDate && f.daysUntilShortfall <= 30;
          const openForecast = () => { track('forecast_banner_clicked', { banner_state: warn ? 'warning' : 'ok' }); navigate('/forecast'); };
          const d = (x) => new Date(x+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'});
          const signed = (n) => `${n < 0 ? '−' : ''}${fmt(Math.abs(n),{noDecimals:true})}`;
          return (
            <motion.div variants={cardVar} onClick={openForecast} role="link" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') openForecast(); }}
              style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:12, marginBottom:16,
                background: warn ? 'var(--red-light)' : c.cardBg,
                border: `1px solid ${warn ? 'var(--red)' : c.border.replace('1px solid ','')}` }}>
              <span style={{ display:'inline-flex', width:32, height:32, borderRadius:8, alignItems:'center', justifyContent:'center', flexShrink:0,
                background: warn ? 'var(--red-soft)' : 'var(--accent-light)', color: warn ? 'var(--red-text)' : 'var(--accent)' }}>
                {warn ? <AlertTriangle size={18}/> : <TrendingUp size={18}/>}
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color: warn ? 'var(--red-text)' : c.text }}>
                  {warn ? `Balance may go below zero on ${d(f.shortfallDate)}` : 'Cash-flow outlook: no shortfall expected'}
                </div>
                <div style={{ fontSize:13, color:c.text2, marginTop:2 }}>
                  {warn
                    ? `You could be short by ${fmt(f.shortfallAmount,{noDecimals:true})}. See what is driving it.`
                    : `Lowest balance in the next ${forecast.days} days: ${signed(f.lowestBalance)} on ${d(f.lowestDate)}.`}
                </div>
              </div>
              <ChevronRight size={18} color={c.text3} style={{ flexShrink:0 }}/>
            </motion.div>
          );
        })()}

        {/* ── Grid (areas keep both columns row-aligned) ─────────── */}
        <div className={styles.grid}>

            {/* Account Balance card — with inline account filter */}
            <motion.div variants={cardVar} className={styles.balanceCard}
              style={{ background:c.balanceBg, border:c.balanceBorder, boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className={styles.cardTitle} style={{ color:c.text }}>{isFiltered ? 'Filtered Balance' : 'Available Balance'}</span>
                  <AmountToggle size={16} color={c.text3}/>
                </div>
                <PeriodPill period={period} setPeriod={setPeriod} c={c} isDark={isDark}/>
              </div>

              {/* Account filter chips — small icons, tap to include/exclude */}
              {accounts.length > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, overflowX:'auto', paddingBottom:2, scrollbarWidth:'none' }}>
                  {/* All */}
                  <button onClick={selectAll} title="All accounts"
                    style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, height:34, padding:'0 12px', borderRadius:8, cursor:'pointer',
                      border:`1px solid ${!isFiltered ? c.purple : c.border}`,
                      background: !isFiltered ? (isDark?'rgba(96,165,250,.16)':'#EFF6FF') : 'transparent',
                      color: !isFiltered ? c.purple : c.text2, fontSize:12.5, fontWeight:700 }}>
                    <Wallet size={14}/> All
                  </button>
                  {accounts.map(acc => {
                    const on = effIncluded.has(String(acc.id));
                    const initial = (acc.name||'?').trim().charAt(0).toUpperCase();
                    return (
                      <button key={acc.id} onClick={()=>toggleAcc(acc.id)} title={acc.name}
                        style={{ flexShrink:0, display:'flex', alignItems:'center', gap:7, height:34, padding:'0 12px 0 6px', borderRadius:8, cursor:'pointer',
                          border:`1px solid ${on ? c.purple : c.border}`,
                          background: on ? (isDark?'rgba(96,165,250,.16)':'#EFF6FF') : 'transparent',
                          opacity: on ? 1 : 0.6, transition:'all .15s' }}>
                        <span style={{ width:24, height:24, borderRadius:'50%', background: on ? c.purple : c.text3, color: '#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>{initial}</span>
                        <span style={{ fontSize:12.5, fontWeight:700, color: on ? c.text : c.text2, whiteSpace:'nowrap', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis' }}>{acc.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={styles.balanceBig} style={{ color: balance < 0 ? c.red : c.text, marginTop: accounts.length>1 ? 14 : 16 }}>
                {balance < 0 && '−'}<CountUp value={balance} fmt={fmt}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                {net === 0 ? (
                  <span style={{ color:c.text2, fontWeight:700, fontSize:13.5 }}>No change</span>
                ) : (
                  <span style={{ color: net>0?c.green:c.red, fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:4 }}>
                    {net>0 ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
                    {net>0?'+':'−'}{fmt(Math.abs(net),{noDecimals:true})}
                  </span>
                )}
                <span style={{ fontSize:13, color:c.text2 }}>net {unit === 'week' ? 'this week' : unit === 'year' ? 'this year' : 'this month'}</span>
              </div>

              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={chartData} margin={{ top:10, right:8, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.stroke} stopOpacity={isDark?0.4:0.22}/>
                        <stop offset="100%" stopColor={c.stroke} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" stroke={c.grid} vertical={false}/>
                    <XAxis dataKey="name" ticks={xTicks} tickLine={false} axisLine={false}
                      tick={{ fontSize:11, fill:c.axis }} interval="preserveStartEnd"/>
                    <YAxis orientation="right" tickLine={false} axisLine={false} width={52}
                      tick={{ fontSize:11, fill:c.axis }} tickFormatter={lakh} domain={['auto','auto']}/>
                    <ReferenceLine y={0} stroke={c.axis} strokeDasharray="3 3" strokeOpacity={0.5}/>
                    <Tooltip content={<BalTip fmt={fmt} c={c}/>}/>
                    <Area type="monotone" dataKey="value" stroke={c.stroke} strokeWidth={c.strokeW}
                      fill="url(#balGrad)" dot={chartData.length > 14 ? false : { r:3, fill: isDark?'#061B38':'#FFFFFF', stroke:c.stroke, strokeWidth:2 }}
                      activeDot={{ r:6, fill:'#1D4ED8', stroke: isDark?'#061B38':'#fff', strokeWidth:3 }}
                      animationDuration={1200}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Top Spending Category card */}
            <motion.div variants={cardVar} className={styles.spendCard}
              style={{ background:c.spendBg, border:c.spendBorder, boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <span className={styles.cardTitle} style={{ color:c.text }}>Top Spending Category</span>
                <PeriodPill period={period} setPeriod={setPeriod} c={c} isDark={isDark}/>
              </div>

              {spendCats.length === 0 ? (
                <div style={{ textAlign:'center', padding:'28px 12px' }}>
                  <div style={{ fontSize:30, marginBottom:8 }}>🍩</div>
                  <div style={{ fontSize:14, fontWeight:700, color:c.text }}>No spending yet</div>
                  <div style={{ fontSize:12.5, color:c.text2, marginTop:3 }}>Add expenses to see your category breakdown</div>
                </div>
              ) : (
              <div className={styles.spendBody}>
                {/* Donut */}
                <div className={styles.donutWrap}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={spendCats} dataKey="value" nameKey="name"
                        innerRadius="68%" outerRadius="98%" paddingAngle={2}
                        strokeWidth={0} animationDuration={1100} animationBegin={200}>
                        {spendCats.map((x,i)=><Cell key={i} fill={x.color}/>)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.donutCenter}>
                    <div className={styles.donutCenterLabel} style={{ color:c.text2 }}>Total</div>
                    <div className={styles.donutCenterAmt} style={{ color:c.text, fontFamily:'Inter, sans-serif' }}>
                      {fmt(spendTotal,{noDecimals:true})}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className={styles.spendLegend}>
                  {spendCats.map((x,i)=>(
                    <motion.div key={i} className={styles.spendRow}
                      initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }}
                      transition={{ delay: 0.35 + i*0.08 }}>
                      <div className={styles.spendRowIcon} style={{ background:x.color }}>
                        <span style={{ fontSize:13 }}>{x.emoji || '💠'}</span>
                      </div>
                      <span className={styles.spendRowName} style={{ color:c.text }}>{x.name}</span>
                      <span className={styles.spendRowAmt} style={{ color:c.text }}>{fmt(x.value,{noDecimals:true})}</span>
                      <span className={styles.spendRowPct} style={{ color:c.text2 }}>
                        {spendTotal>0?Math.round((x.value/spendTotal)*100):0}%
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
              )}

              <div className={styles.spendFoot}>
                <button className={styles.linkBtn} style={{ color:c.purple }} onClick={()=>navigate('/budget')}>
                  View Spending Analysis <ChevronRight size={15}/>
                </button>
              </div>
            </motion.div>

            {/* Money Flow card */}
            <motion.div variants={cardVar} className={styles.flowCard}
              style={{ background:c.flowBg, border:c.flowBorder,
                boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div className={styles.flowHeadIcon} style={{ background:'rgba(29,78,216,0.15)' }}>
                    <Activity size={17} color={c.purple}/>
                  </div>
                  <span className={styles.cardTitle} style={{ color:c.text }}>Money Flow</span>
                </div>
                <button className={styles.iconBtnSm} style={{ background:'rgba(29,78,216,0.12)' }}>
                  <ArrowLeftRight size={15} color={c.purple}/>
                </button>
              </div>

              <div className={styles.flowBody}>
                {/* Left: in / out / net */}
                <div className={styles.flowLeft}>
                  <div className={styles.flowItem}>
                    <div className={styles.flowItemIcon} style={{ background:c.green }}>
                      <ArrowDown size={15} color={'#fff'}/>
                    </div>
                    <div>
                      <div style={{ fontSize:12.5, color:c.text2 }}>Money In</div>
                      <div className={styles.numMd} style={{ color:c.text }}>
                        <CountUp value={income} fmt={fmt}/>
                      </div>
                    </div>
                  </div>
                  <div className={styles.flowBar} style={{ background:c.barTrack }}>
                    <motion.div style={{ height:'100%', borderRadius:14, background:c.green }}
                      initial={{ width:0 }} animate={{ width:`${inPct}%` }} transition={{ duration:0.9, delay:0.4, ease:'easeOut' }}/>
                  </div>

                  <div className={styles.flowItem} style={{ marginTop:18 }}>
                    <div className={styles.flowItemIcon} style={{ background:c.red }}>
                      <ArrowUp size={15} color="#fff"/>
                    </div>
                    <div>
                      <div style={{ fontSize:12.5, color:c.text2 }}>Money Out</div>
                      <div className={styles.numMd} style={{ color:c.text }}>
                        <CountUp value={expense} fmt={fmt}/>
                      </div>
                    </div>
                  </div>
                  <div className={styles.flowBar} style={{ background:c.barTrack }}>
                    <motion.div style={{ height:'100%', borderRadius:14, background:c.red }}
                      initial={{ width:0 }} animate={{ width:`${outPct}%` }} transition={{ duration:0.9, delay:0.55, ease:'easeOut' }}/>
                  </div>

                  <div className={styles.netRow}>
                    <div>
                      <div style={{ fontSize:12.5, color:c.text2, borderTop:`1px dashed ${c.border}`, paddingTop:12 }}>Net Cash Flow</div>
                      <div className={styles.numMd} style={{ color: net>=0?c.green:c.red }}>
                        {net>=0?'+':'−'}{fmt(Math.abs(net),{noDecimals:true})}
                      </div>
                    </div>
                    <PeriodPill period={period} setPeriod={setPeriod} c={c} isDark={isDark}/>
                  </div>
                </div>

                {/* Right: stat tiles */}
                <div className={styles.flowTiles}>
                  {[
                    { icon:<PiggyBank size={18} color={'#fff'}/>, bg:c.green, label:'Savings Rate', val:`${savingsRate}%` },
                    { icon:<ListChecks size={18} color="#fff"/>, bg:c.purple, label:'Transactions', val:String(txCount) },
                    { icon:<CalendarDays size={18} color="#fff"/>, bg:c.blue, label:'Avg Daily Spend', val:fmt(dailyAvgSpend,{noDecimals:true}) },
                  ].map((tItem,i)=>(
                    <motion.div key={i} className={styles.flowTile} style={{ background:c.tileBg }}
                      initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.45+i*0.1 }}
                      whileHover={{ scale:1.02 }}>
                      <div className={styles.flowTileIcon} style={{ background:tItem.bg }}>{tItem.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11.5, color:c.text2, lineHeight:1.25 }}>{tItem.label}</div>
                        <div className={styles.numSm} style={{ color:c.text }}>{tItem.val}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Recent Transactions card */}
            <motion.div variants={cardVar} className={styles.recentCard}
              style={{ background:c.cardBg, border:c.balanceBorder, boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <span className={styles.cardTitle} style={{ color:c.text }}>Recent Transactions</span>
                <button className={styles.linkBtn} style={{ color:c.purple, fontSize:13 }} onClick={()=>navigate('/transactions')}>
                  View All
                </button>
              </div>
              <div className={styles.recentList}>
                {recentList.length === 0 && (
                  <div style={{ textAlign:'center', padding:'26px 12px' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🧾</div>
                    <div style={{ fontSize:14, fontWeight:700, color:c.text }}>No transactions yet</div>
                    <div style={{ fontSize:12.5, color:c.text2, marginTop:3 }}>Tap + to add your first one</div>
                  </div>
                )}
                {recentList.map((tx,i)=>{
                  const isInc = tx.type === 'income';
                  return (
                    <motion.div key={tx.id} className={styles.recentRow}
                      style={{ borderBottom: i<recentList.length-1 ? `1px solid ${c.divider}` : 'none' }}
                      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5+i*0.09 }}>
                      {isInc
                        ? <div className={styles.recentIconInc} style={{ background: isDark?'rgba(52,211,153,0.15)':'#D1FAE5' }}>
                            <ArrowDown size={17} color={c.green}/>
                          </div>
                        : <MerchantLogo name={tx.description || tx.payment_name || tx.category_name} size={42}/>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:c.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {tx.description || tx.payment_name || '—'}
                        </div>
                        <div style={{ fontSize:12, color:c.text2, marginTop:2 }}>{tx.category_name || (isInc?'Income':'Expense')}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div className={styles.numXs} style={{ color: isInc?c.green:c.red }}>
                          {isInc?'+':'-'}{fmt(parseFloat(tx.amount||0),{noDecimals:true})}
                        </div>
                        <div style={{ fontSize:11.5, color:c.text3, marginTop:2 }}>
                          {new Date(tx.transaction_date).toLocaleDateString('en-IN',{ day:'numeric', month:'short', year:'numeric' })}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* ── Accounts widget (NEW) ── */}
            <motion.div variants={cardVar} className={styles.accountsCard}
              style={{ background:c.cardBg, border:c.balanceBorder, boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <span className={styles.cardTitle} style={{ color:c.text }}>Accounts</span>
                <button className={styles.linkBtn} style={{ color:c.purple, fontSize:13 }} onClick={()=>navigate('/wallet')}>View All</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column' }}>
                {(wallets||[]).length === 0 && (
                  <div style={{ textAlign:'center', padding:'26px 12px' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🏦</div>
                    <div style={{ fontSize:14, fontWeight:700, color:c.text }}>No accounts yet</div>
                    <div style={{ fontSize:12.5, color:c.text2, marginTop:3 }}>Add one in the Accounts tab</div>
                  </div>
                )}
                {(wallets||[]).slice(0,6).map((w,i,arr)=>{
                  const bal = parseFloat(w.balance||0);
                  const neg = bal < 0;
                  return (
                    <motion.div key={w.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.45+i*0.07 }}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0',
                        borderBottom: i<arr.length-1 ? `1px solid ${c.divider}` : 'none' }}>
                      <div style={{ width:38, height:38, borderRadius:11, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                        background: isDark?'rgba(29,78,216,.14)':'#EFF6FF' }}>
                        <Wallet size={18} color={c.purple}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:c.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{w.name}</div>
                        <div style={{ fontSize:12, color:c.text2, marginTop:2, textTransform:'capitalize' }}>{w.last_four ? `•••• ${w.last_four}` : (w.type||'account').replace(/_/g,' ')}</div>
                      </div>
                      <div className={styles.numXs} style={{ color: neg ? c.red : c.text }}>
                        {neg && '−'}{fmt(Math.abs(bal),{noDecimals:true})}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* ── Savings Goals widget (NEW) ── */}
            <motion.div variants={cardVar} className={styles.goalsCard}
              style={{ background:c.cardBg, border:c.balanceBorder, boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <span className={styles.cardTitle} style={{ color:c.text }}>Savings Goals</span>
                <button className={styles.linkBtn} style={{ color:c.purple, fontSize:13 }} onClick={()=>navigate('/goals')}>View All</button>
              </div>
              {(goals||[]).length === 0 ? (
                <div style={{ textAlign:'center', padding:'26px 12px' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
                  <div style={{ fontSize:14, fontWeight:700, color:c.text }}>No goals yet</div>
                  <div style={{ fontSize:12.5, color:c.text2, marginTop:3 }}>Set a savings goal to track progress</div>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:18, marginTop:12 }}>
                  {(goals||[]).slice(0,4).map((g,i)=>{
                    const saved = parseFloat(g.current_amount||0);
                    const target = parseFloat(g.target_amount||0);
                    const pct = target>0 ? Math.min(100, Math.round((saved/target)*100)) : 0;
                    return (
                      <div key={g.id}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                          <span style={{ fontSize:18 }}>{g.emoji || '🎯'}</span>
                          <span style={{ fontSize:13.5, fontWeight:700, color:c.text, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{g.name}</span>
                          <span style={{ fontSize:13, fontWeight:600, color:c.green }}>{pct}%</span>
                        </div>
                        <div style={{ height:8, borderRadius:99, background:c.track, overflow:'hidden' }}>
                          <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:.8, delay:.3+i*.08, ease:[.2,.8,.2,1] }}
                            style={{ height:'100%', borderRadius:99, background: g.color || c.stroke }}/>
                        </div>
                        <div style={{ fontSize:12, color:c.text2, marginTop:7 }}>
                          {fmt(saved,{noDecimals:true})} <span style={{ color:c.text3 }}>of {fmt(target,{noDecimals:true})}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* ── Upcoming Payments widget (NEW) ── */}
            <motion.div variants={cardVar} className={styles.upcomingCard}
              style={{ background:c.cardBg, border:c.balanceBorder, boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <span className={styles.cardTitle} style={{ color:c.text }}>Upcoming Payments</span>
                <button className={styles.linkBtn} style={{ color:c.purple, fontSize:13 }} onClick={()=>navigate('/recurring')}>View All</button>
              </div>
              {upcomingPayments.length === 0 ? (
                <div style={{ textAlign:'center', padding:'26px 12px' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
                  <div style={{ fontSize:14, fontWeight:700, color:c.text }}>Nothing due soon</div>
                  <div style={{ fontSize:12.5, color:c.text2, marginTop:3 }}>Credit-card bills, EMIs & recurring bills show up here</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column' }}>
                  {upcomingPayments.slice(0,6).map((e,i,arr)=>{
                    const days = Math.round((e.date - new Date().setHours(0,0,0,0))/86400000);
                    const soon = days <= 7;
                    const kindColor = e.kind==='card' ? c.red : e.kind==='loan' ? c.orange : c.purple;
                    const when = days<=0 ? 'Today' : days===1 ? 'Tomorrow' : days<=7 ? `in ${days} days`
                      : e.date.toLocaleDateString('en-IN',{ day:'numeric', month:'short' });
                    return (
                      <motion.div key={e.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.45+i*0.07 }}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0',
                          borderBottom: i<arr.length-1 ? `1px solid ${c.divider}` : 'none' }}>
                        <div style={{ width:38, height:38, borderRadius:11, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:`${kindColor}1f` }}>
                          <CalendarDays size={18} color={kindColor}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:c.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.name}</div>
                          <div style={{ fontSize:12, marginTop:2, fontWeight:600, color: soon ? c.red : c.text2 }}>{when}</div>
                        </div>
                        <div className={styles.numXs} style={{ color:c.text }}>{fmt(e.amount,{noDecimals:true})}</div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
