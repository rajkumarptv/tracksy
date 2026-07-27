import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  Landmark, ChevronRight, ChevronDown, Bell, Search, Eye,
  ArrowDown, ArrowUp, Activity, ArrowLeftRight, Wallet,
  ListChecks, Percent, Sparkles, PiggyBank, CalendarDays, Check,
} from 'lucide-react';
import { dashboardAPI, walletsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { useFmt } from '../i18n';
import { MerchantLogo, CategoryIcon } from '../components/icons';
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
    <div style={{ background: c.cardBg, border:`1px solid ${c.grid}`, borderRadius:12, padding:'8px 12px', boxShadow:'0 8px 24px rgba(0,0,0,.15)' }}>
      <div style={{ fontSize:11, color:c.text3, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:700, color:c.green }}>{fmt(payload[0].value||0,{noDecimals:true})}</div>
    </div>
  );
}

/* ── Period helpers ──────────────────────────────────────────────────── */
const PERIOD_LABEL = { week:'This Week', month:'This Month', year:'This Year' };
const iso = (d) => d.toISOString().split('T')[0];

function periodRange(period, base = new Date()) {
  const y = base.getFullYear(), m = base.getMonth(), d = base.getDate();
  if (period === 'week') {
    const dow = (base.getDay() + 6) % 7;               // Monday = 0
    return { start: new Date(y, m, d - dow), end: new Date(y, m, d - dow + 6) };
  }
  if (period === 'year') return { start: new Date(y,0,1), end: new Date(y,11,31) };
  return { start: new Date(y, m, 1), end: new Date(y, m+1, 0) };   // month
}
function prevPeriodBase(period, base = new Date()) {
  const b = new Date(base);
  if (period === 'week') b.setDate(b.getDate() - 7);
  else if (period === 'year') b.setFullYear(b.getFullYear() - 1);
  else b.setMonth(b.getMonth() - 1);
  return b;
}

/* ── Period selector dropdown (Week / Month / Year) ──────────────────── */
function PeriodPill({ period, setPeriod, c, isDark }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <button className={styles.periodPill} onClick={()=>setOpen(o=>!o)} style={{
        background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
        border: `1.5px solid ${open ? c.purple : (isDark ? 'rgba(255,255,255,0.1)' : '#E4E6F0')}`,
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
                boxShadow:'0 16px 44px rgba(0,0,0,.3)', overflow:'hidden', padding:5 }}>
              {['week','month','year'].map(p => {
                const sel = p === period;
                return (
                  <button key={p} onClick={()=>{ setPeriod(p); setOpen(false); }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'9px 11px', borderRadius:9, border:'none', cursor:'pointer', textAlign:'left',
                      background: sel ? (isDark?'rgba(139,92,246,.16)':'#F5F3FF') : 'transparent',
                      color: sel ? (isDark?'#C4B5FD':c.purple) : c.text, fontSize:13, fontWeight: sel?700:500, fontFamily:'inherit' }}>
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

  /* Date range for the whole dashboard, driven by the period selector */
  const { start: rStart, end: rEnd } = periodRange(period);
  const range = { start_date: iso(rStart), end_date: iso(rEnd) };
  const { start: pStart, end: pEnd } = periodRange(period, prevPeriodBase(period));
  const prevRange = { start_date: iso(pStart), end_date: iso(pEnd) };

  /* ── Queries (all keyed by period so they refetch on change) ── */
  const { data: summary } = useQuery({
    queryKey:['dash-summary-cur', period],
    queryFn: () => dashboardAPI.summary(range).then(r=>r.data.data),
  });
  const { data: prevSummary } = useQuery({
    queryKey:['dash-summary-prev', period],
    queryFn: () => dashboardAPI.summary(prevRange).then(r=>r.data.data),
  });
  const { data: catBreakdown } = useQuery({
    queryKey:['cat-breakdown', period],
    queryFn: () => dashboardAPI.categoryBreakdown(range).then(r=>r.data.data),
  });
  const { data: wallets } = useQuery({ queryKey:['wallets'], queryFn:()=>walletsAPI.getAll().then(r=>r.data.data) });
  const { data: recentTx } = useQuery({
    queryKey:['recent-tx-dash', period],
    queryFn: () => dashboardAPI.recentTransactions({ ...range, limit:1000 }).then(r=>r.data.data),
  });

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
  // Total balance is a point-in-time value (not period-scoped)
  const balance = isFiltered
    ? activeAccounts.reduce((s,a) => s + parseFloat(a.balance||0), 0)
    : parseFloat(summary?.total_balance || 0);
  const net     = income - expense;

  // Change vs the previous equivalent period (last week / month / year)
  const prevNet = parseFloat(prevSummary?.income||0) - parseFloat(prevSummary?.expense||0);
  const balChg  = prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : 0;
  const balUp = net >= prevNet;
  const prevLabel = period === 'week' ? 'vs last week' : period === 'year' ? 'vs last year' : 'vs last month';

  const txCount = scopedTx.length;
  // KPI: avg daily spend across the elapsed days of the period
  const elapsedDays = Math.max(1, Math.round((Math.min(now, rEnd) - rStart) / 86400000) + 1);
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;
  const dailyAvgSpend = Math.round(expense / elapsedDays);

  /* ── Search → open Transactions with the query ── */
  const runSearch = () => {
    const q = searchTerm.trim();
    navigate(q ? `/transactions?search=${encodeURIComponent(q)}` : '/transactions');
  };

  /* ── Balance area chart — buckets adapt to the period ── */
  const balanceSeries = useMemo(() => {
    const net = scopedTx.reduce((s,tx)=>{
      const a = parseFloat(tx.amount||0);
      return s + (tx.type==='income'?a : tx.type==='expense'?-a : 0);
    }, 0);
    const startBal = balance - net; // walk forward from period-start balance

    if (period === 'year') {
      const monthly = new Array(12).fill(0);
      scopedTx.forEach(tx => {
        const d = new Date(tx.transaction_date);
        if (d.getFullYear() !== rStart.getFullYear()) return;
        const a = parseFloat(tx.amount||0);
        monthly[d.getMonth()] += tx.type==='income'?a : tx.type==='expense'?-a : 0;
      });
      let run = startBal;
      return monthly.map((v,i)=>{ run += v; return { name: MONTHS[i], value: Math.max(0, run) }; });
    }

    // week / month → daily buckets across the range
    const days = [];
    for (let d = new Date(rStart); d <= rEnd; d.setDate(d.getDate()+1)) days.push(new Date(d));
    const daily = days.map(()=>0);
    scopedTx.forEach(tx => {
      const dt = new Date(tx.transaction_date);
      const idx = days.findIndex(d => d.toDateString() === dt.toDateString());
      if (idx < 0) return;
      const a = parseFloat(tx.amount||0);
      daily[idx] += tx.type==='income'?a : tx.type==='expense'?-a : 0;
    });
    let run = startBal;
    return days.map((d,i)=>{ run += daily[i]; return { name:`${d.getDate()} ${MONTHS[d.getMonth()]}`, value: Math.max(0, run) }; });
  }, [scopedTx, balance, period]);

  const xTicks = useMemo(() => {
    if (!balanceSeries.length) return [];
    if (period === 'year') return ['Jan','Apr','Jul','Oct','Dec'];
    if (period === 'week') return balanceSeries.map(p=>p.name); // all 7 days
    const n = balanceSeries.length;
    return [0, Math.floor(n*0.25), Math.floor(n*0.5), Math.floor(n*0.75), n-1].map(i=>balanceSeries[i]?.name);
  }, [balanceSeries, period]);

  /* ── Spending categories (real data only) ── */
  const spendCats = useMemo(() => {
    const raw = (catBreakdown||[]).filter(x=>x.value>0);
    if (raw.length === 0) return [];
    const top = raw.slice(0,4);
    const restVal = raw.slice(4).reduce((s,x)=>s+x.value,0);
    const list = restVal > 0 ? [...top, { name:'Others', value:restVal, emoji:'🎯' }] : top;
    return list.map((x,i)=>({ ...x, color:c.pie[i%c.pie.length] }));
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
    if (savingsRate >= 20)
      list.push({ emoji:'🎉', text:`Great job — you saved ${savingsRate}% of your income this month.`, to:'/goals' });
    if (spendCats[0])
      list.push({ emoji:'📊', text:`${spendCats[0].name} is your top spend at ${fmt(spendCats[0].value,{noDecimals:true})}.`, to:'/budget' });
    return list;
  }, [wallets, net, savingsRate, spendCats]);

  /* ── Recent transactions (real data only) ── */
  const recentList = useMemo(() => (recentTx||[]).slice(0,4), [recentTx]);

  const greetingHour = now.getHours();
  const greeting = greetingHour < 12 ? 'Good Morning' : greetingHour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = (user?.first_name || user?.name || 'there').split(' ')[0];
  const inPct  = income  > 0 ? Math.min(100, (income  / Math.max(income, expense)) * 100) : 0;
  const outPct = expense > 0 ? Math.min(100, (expense / Math.max(income, expense)) * 100) : 0;

  /* ═════════════════ RENDER ═════════════════ */
  return (
    <div className={styles.page} style={{ background: isDark ? '#020617' : '#FEFEFE' }}>
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
              <span className={styles.onlineDot} style={{ background:c.green, borderColor: isDark?'#020617':'#FEFEFE' }}/>
            </div>
            <div>
              <div className={styles.greetTitle} style={{ color:c.text }}>{greeting}, {firstName} 👋</div>
              <div className={styles.greetSub} style={{ color:c.text2 }}>Let's make today financially amazing!</div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.searchBox} style={{ background: isDark?'rgba(255,255,255,0.07)':'#FFFFFF', border:`1px solid ${isDark?'rgba(255,255,255,0.08)':'#E4E6F0'}` }}>
              <Search size={16} color={c.text3}/>
              <input placeholder="Search transactions…" style={{ color:c.text }}
                value={searchTerm}
                onChange={e=>setSearchTerm(e.target.value)}
                onKeyDown={e=>{ if (e.key === 'Enter') runSearch(); }}/>
            </div>
            <button className={`${styles.iconBtn} ${styles.mobileSearchBtn}`}
              style={{ background: isDark?'rgba(255,255,255,0.07)':'#FFFFFF', border:`1px solid ${isDark?'rgba(255,255,255,0.08)':'#E4E6F0'}` }}
              onClick={runSearch} aria-label="Search">
              <Search size={18} color={c.text2}/>
            </button>

            {/* Notifications — real, data-derived */}
            <div style={{ position:'relative' }}>
              <button className={styles.iconBtn} onClick={()=>setNotifOpen(o=>!o)} aria-label="Notifications"
                style={{ background: isDark?'rgba(255,255,255,0.07)':'#FFFFFF', border:`1px solid ${isDark?'rgba(255,255,255,0.08)':'#E4E6F0'}` }}>
                <Bell size={18} color={c.text2}/>
                {notifications.length > 0 && <span className={styles.bellBadge}>{notifications.length}</span>}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <>
                    <div onClick={()=>setNotifOpen(false)} style={{ position:'fixed', inset:0, zIndex:80 }}/>
                    <motion.div
                      initial={{ opacity:0, y:-8, scale:.98 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-8, scale:.98 }}
                      transition={{ duration:.16 }}
                      style={{ position:'absolute', top:'calc(100% + 10px)', right:0, zIndex:81, width:'min(320px, calc(100vw - 32px))',
                        background:c.cardBg, border:`1px solid ${c.border||'rgba(255,255,255,.1)'}`, borderRadius:16,
                        boxShadow:'0 20px 60px rgba(0,0,0,.35)', overflow:'hidden' }}>
                      <div style={{ padding:'14px 16px', borderBottom:`1px solid ${c.divider||'rgba(255,255,255,.06)'}`, fontSize:14, fontWeight:800, color:c.text }}>
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

        {/* ── Grid (areas keep both columns row-aligned) ─────────── */}
        <div className={styles.grid}>

            {/* Account Balance card — with inline account filter */}
            <motion.div variants={cardVar} className={styles.balanceCard}
              style={{ background:c.balanceBg, border:c.balanceBorder, boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className={styles.cardTitle} style={{ color:c.text }}>{isFiltered ? 'Filtered Balance' : 'Total Balance'}</span>
                  <Eye size={16} color={c.text3}/>
                </div>
                <PeriodPill period={period} setPeriod={setPeriod} c={c} isDark={isDark}/>
              </div>

              {/* Account filter chips — small icons, tap to include/exclude */}
              {accounts.length > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:12, overflowX:'auto', paddingBottom:2, scrollbarWidth:'none' }}>
                  {/* All */}
                  <button onClick={selectAll} title="All accounts"
                    style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, height:34, padding:'0 12px', borderRadius:999, cursor:'pointer',
                      border:`1.5px solid ${!isFiltered ? c.green : c.border}`,
                      background: !isFiltered ? (isDark?'rgba(43,255,136,.14)':'#F0FDF4') : 'transparent',
                      color: !isFiltered ? c.green : c.text2, fontSize:12.5, fontWeight:700 }}>
                    <Wallet size={14}/> All
                  </button>
                  {accounts.map(acc => {
                    const on = effIncluded.has(String(acc.id));
                    const initial = (acc.name||'?').trim().charAt(0).toUpperCase();
                    return (
                      <button key={acc.id} onClick={()=>toggleAcc(acc.id)} title={acc.name}
                        style={{ flexShrink:0, display:'flex', alignItems:'center', gap:7, height:34, padding:'0 12px 0 6px', borderRadius:999, cursor:'pointer',
                          border:`1.5px solid ${on ? c.green : c.border}`,
                          background: on ? (isDark?'rgba(43,255,136,.14)':'#F0FDF4') : 'transparent',
                          opacity: on ? 1 : 0.6, transition:'all .15s' }}>
                        <span style={{ width:24, height:24, borderRadius:'50%', background: on ? c.green : c.text3, color: isDark?'#04220F':'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>{initial}</span>
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
                <span style={{ color: balUp?c.green:c.red, fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:4 }}>
                  {balUp ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
                  {Math.abs(balChg).toFixed(1)}%
                </span>
                <span style={{ fontSize:13, color:c.text2 }}>{prevLabel}</span>
              </div>

              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={balanceSeries} margin={{ top:10, right:8, left:0, bottom:0 }}>
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
                      tick={{ fontSize:11, fill:c.axis }} tickFormatter={lakh} domain={['dataMin - 10000','dataMax + 10000']}/>
                    <Tooltip content={<BalTip fmt={fmt} c={c}/>}/>
                    <Area type="monotone" dataKey="value" stroke={c.stroke} strokeWidth={c.strokeW}
                      fill="url(#balGrad)" dot={{ r:3, fill:c.stroke, strokeWidth:0 }}
                      activeDot={{ r:6, fill: isDark?'#061B38':'#fff', stroke:c.stroke, strokeWidth:3 }}
                      animationDuration={1200}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <button className={styles.viewDetailsBtn}
                style={{ background:c.viewDetailsBg, border:c.viewDetailsBorder, color: isDark?c.green:'#16A34A' }}
                onClick={()=>navigate('/accounts')}>
                View Details <ChevronRight size={15}/>
              </button>
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
                    <div className={styles.donutCenterAmt} style={{ color:c.text, fontFamily:'Space Grotesk, Inter, sans-serif' }}>
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
                <div className={styles.walletArt}>👛<span className={styles.walletSpark}>✦</span></div>
              </div>
            </motion.div>

            {/* Money Flow card */}
            <motion.div variants={cardVar} className={styles.flowCard}
              style={{ background:c.flowBg, border:c.flowBorder,
                boxShadow: isDark ? `${c.cardShadow}, 0 0 40px rgba(139,92,246,0.1)` : c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div className={styles.flowHeadIcon} style={{ background:'rgba(139,92,246,0.15)' }}>
                    <Activity size={17} color={c.purple}/>
                  </div>
                  <span className={styles.cardTitle} style={{ color:c.text }}>Money Flow</span>
                </div>
                <button className={styles.iconBtnSm} style={{ background:'rgba(139,92,246,0.12)' }}>
                  <ArrowLeftRight size={15} color={c.purple}/>
                </button>
              </div>

              <div className={styles.flowBody}>
                {/* Left: in / out / net */}
                <div className={styles.flowLeft}>
                  <div className={styles.flowItem}>
                    <div className={styles.flowItemIcon} style={{ background:c.green }}>
                      <ArrowDown size={15} color={isDark?'#04220F':'#fff'}/>
                    </div>
                    <div>
                      <div style={{ fontSize:12.5, color:c.text2 }}>Money In</div>
                      <div className={styles.numMd} style={{ color:c.text }}>
                        <CountUp value={income} fmt={fmt}/>
                      </div>
                    </div>
                  </div>
                  <div className={styles.flowBar} style={{ background:c.barTrack }}>
                    <motion.div style={{ height:'100%', borderRadius:20, background:c.green }}
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
                    <motion.div style={{ height:'100%', borderRadius:20, background:c.red }}
                      initial={{ width:0 }} animate={{ width:`${outPct}%` }} transition={{ duration:0.9, delay:0.55, ease:'easeOut' }}/>
                  </div>

                  <div className={styles.netRow}>
                    <div>
                      <div style={{ fontSize:12.5, color:c.text2, borderTop:`1px dashed ${isDark?'rgba(255,255,255,0.12)':'#E4E6F0'}`, paddingTop:12 }}>Net Cash Flow</div>
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
                    { icon:<PiggyBank size={18} color={isDark?'#04220F':'#fff'}/>, bg:c.green, label:'Savings Rate', val:`${savingsRate}%` },
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
                      <ChevronRight size={15} color={c.text3}/>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Recent Transactions card */}
            <motion.div variants={cardVar} className={styles.recentCard}
              style={{ background:c.cardBg, border: isDark?'1px solid rgba(255,255,255,0.08)':'1px solid transparent', boxShadow:c.cardShadow }}>
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
                      style={{ borderBottom: i<recentList.length-1 ? `1px solid ${isDark?'rgba(255,255,255,0.05)':'#F2F4F7'}` : 'none' }}
                      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5+i*0.09 }}>
                      {isInc
                        ? <div className={styles.recentIconInc} style={{ background: isDark?'rgba(43,255,136,0.15)':'#DCFCE7' }}>
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
        </div>
      </motion.div>
    </div>
  );
}
