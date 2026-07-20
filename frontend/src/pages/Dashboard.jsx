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
  ListChecks, Percent, Sparkles,
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

/* ── Dropdown pill ("This Month ⌄") ──────────────────────────────────── */
function PeriodPill({ label, c, isDark }) {
  return (
    <button className={styles.periodPill} style={{
      background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E4E6F0'}`,
      color: c.text2,
    }}>
      {label} <ChevronDown size={13}/>
    </button>
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

  const [selectedAccId, setSelectedAccId] = useState(null); // null = all accounts
  const [accDropOpen, setAccDropOpen] = useState(false);

  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const prevM = curM === 1 ? 12 : curM - 1;
  const prevY = curM === 1 ? curY - 1 : curY;

  /* ── Queries ── */
  const { data: summary } = useQuery({
    queryKey:['dash-summary-cur', curM, curY],
    queryFn: () => dashboardAPI.summary({ month:curM, year:curY }).then(r=>r.data.data),
  });
  const { data: prevSummary } = useQuery({
    queryKey:['dash-summary-prev', prevM, prevY],
    queryFn: () => dashboardAPI.summary({ month:prevM, year:prevY }).then(r=>r.data.data),
  });
  const { data: catBreakdownCur } = useQuery({
    queryKey:['cat-breakdown', curY, curM],
    queryFn: () => dashboardAPI.categoryBreakdown({ year:curY, month:curM }).then(r=>r.data.data),
  });
  const { data: catBreakdownPrev } = useQuery({
    queryKey:['cat-breakdown', prevY, prevM],
    queryFn: () => dashboardAPI.categoryBreakdown({ year:prevY, month:prevM }).then(r=>r.data.data),
  });
  const catBreakdown = (catBreakdownCur||[]).filter(x=>x.value>0).length > 0 ? catBreakdownCur : catBreakdownPrev;
  const { data: wallets } = useQuery({ queryKey:['wallets'], queryFn:()=>walletsAPI.getAll().then(r=>r.data.data) });
  const { data: recentTx } = useQuery({
    queryKey:['recent-tx-dash'],
    queryFn: () => dashboardAPI.recentTransactions({ limit:60 }).then(r=>r.data.data),
  });

  /* ── Selectable accounts (assets only — exclude cards/loans) ── */
  const LIABILITY_TYPES = ['visa','mastercard','home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','bnpl','family_borrow','emi','lending'];
  const accounts = (wallets||[]).filter(w => !LIABILITY_TYPES.includes(w.type));
  const selectedAcc = selectedAccId ? accounts.find(w => String(w.id) === String(selectedAccId)) : null;

  /* Transactions scoped to the selected account (or all) */
  const scopedTx = useMemo(() => {
    if (!selectedAcc) return recentTx || [];
    return (recentTx || []).filter(tx =>
      String(tx.wallet_id) === String(selectedAcc.id) ||
      String(tx.to_wallet_id) === String(selectedAcc.id)
    );
  }, [recentTx, selectedAcc]);

  /* ── Derived numbers (real data only) ── */
  const hasData = (recentTx || []).length > 0;
  // If the current month has no activity yet (e.g. month just started), show last month
  const curEmpty = parseFloat(summary?.income||0) === 0 && parseFloat(summary?.expense||0) === 0;
  const activeSummary = (curEmpty && prevSummary) ? prevSummary : summary;

  // When an account is selected, compute income/expense/balance from its own transactions
  const accIncome  = scopedTx.filter(t=>t.type==='income').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const accExpense = scopedTx.filter(t=>t.type==='expense').reduce((s,t)=>s+parseFloat(t.amount||0),0);

  const income  = selectedAcc ? accIncome  : parseFloat(activeSummary?.income  || 0);
  const expense = selectedAcc ? accExpense : parseFloat(activeSummary?.expense || 0);
  const balance = selectedAcc
    ? parseFloat(selectedAcc.balance || 0)
    : parseFloat(summary?.total_balance || 0);
  const net     = income - expense;

  const prevBal = balance - net;
  const balChg  = prevBal > 0 ? ((balance - prevBal) / prevBal) * 100 : 0;
  const balUp = balChg >= 0;

  /* Salary card — shows selected account, or primary bank as default */
  const bankWallet = selectedAcc || (wallets||[]).find(w => w.type === 'bank') || (wallets||[])[0];
  const salaryName = selectedAcc ? selectedAcc.name : (bankWallet?.name || 'No account');
  const salaryBank = bankWallet
    ? (bankWallet.last_four ? `•••• ${bankWallet.last_four}` : 'Bank Account')
    : 'Add an account to get started';
  const salaryBal  = bankWallet ? parseFloat(bankWallet.balance||0) : balance;

  const txCount = (recentTx||[]).length;
  const avgBalance = Math.round((balance + prevBal) / 2);
  const interest = Math.round(balance * 0.01 / 12);

  /* ── Balance area chart: cumulative daily balance over current month ── */
  const balanceSeries = useMemo(() => {
    const daysInM = new Date(curY, curM, 0).getDate();
    const monthName = MONTHS[curM-1];
    const daily = new Array(daysInM).fill(0);
    scopedTx.forEach(tx => {
      const d = new Date(tx.transaction_date);
      if (d.getMonth()+1 !== curM || d.getFullYear() !== curY) return;
      const amt = parseFloat(tx.amount||0);
      if (tx.type === 'income') daily[d.getDate()-1] += amt;
      else if (tx.type === 'expense') daily[d.getDate()-1] -= amt;
    });
    const monthNet = daily.reduce((s,v)=>s+v,0);
    let run = balance - monthNet;
    return daily.map((v,i)=>{ run += v; return { name:`${i+1} ${monthName}`, day:i+1, value: Math.max(0, run) }; });
  }, [scopedTx, balance, hasData, curM, curY]);

  const xTicks = useMemo(() => {
    const monthName = MONTHS[curM-1];
    return [1,8,15,22,new Date(curY,curM,0).getDate()].map(d=>`${d} ${monthName}`);
  }, [curM, curY]);

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

  /* ── Recent transactions (real data only) ── */
  const recentList = useMemo(() => (recentTx||[]).slice(0,4), [recentTx]);

  /* ── AI Insights (rule-based, cycling) ── */
  const insights = useMemo(() => {
    const list = [];
    const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
    if (savingsRate >= 20) list.push({ emoji:'🎉', text:`Great job! You saved ${savingsRate}% of your income this month.` });
    else if (savingsRate > 0) list.push({ emoji:'💡', text:`You saved ${savingsRate}% this month — aim for 20% to build wealth faster.` });
    if (expense > income) list.push({ emoji:'⚠️', text:`You spent ${fmt(expense - income,{noDecimals:true})} more than you earned this month.` });
    if (spendCats[0]) list.push({ emoji:'📊', text:`${spendCats[0].name} is your top spend at ${fmt(spendCats[0].value,{noDecimals:true})} — ${spendTotal>0?Math.round((spendCats[0].value/spendTotal)*100):0}% of spending.` });
    if (net > 0) list.push({ emoji:'📈', text:`Positive cash flow of ${fmt(net,{noDecimals:true})} — consider moving it to a goal.` });
    if (list.length === 0) list.push({ emoji:'✨', text:'Add more transactions to unlock personalized insights.' });
    return list;
  }, [income, expense, net, spendCats, spendTotal]);

  const [insightIdx, setInsightIdx] = useState(0);
  useEffect(() => {
    if (insights.length < 2) return;
    const id = setInterval(() => setInsightIdx(i => (i + 1) % insights.length), 5000);
    return () => clearInterval(id);
  }, [insights.length]);

  const greetingHour = now.getHours();
  const greeting = greetingHour < 12 ? 'Good Morning' : greetingHour < 17 ? 'Good Afternoon' : 'Good Evening';

  /* AI Insights card — rendered top-of-page on mobile, right column on desktop */
  const insightCard = (
    <motion.div variants={cardVar} whileHover={{ y:-3 }} className={styles.insightCard}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #1E1145 0%, #0B1136 100%)'
          : 'linear-gradient(135deg, #F5F0FF 0%, #EEF4FF 100%)',
        border: `1px solid ${isDark ? 'rgba(139,92,246,0.35)' : '#E9D5FF'}`,
        boxShadow: isDark ? `${c.cardShadow}, 0 0 34px rgba(139,92,246,0.12)` : c.cardShadow,
        cursor:'pointer',
      }}
      onClick={()=>navigate('/insights')}>
      <div className={styles.insightIcon}
        style={{ background:'linear-gradient(135deg,#8B5CF6,#A78BFA)' }}>
        <Sparkles size={22} color="#fff"/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14, fontWeight:800, color:c.purple, letterSpacing:'.02em' }}>AI INSIGHTS</span>
          <span className={styles.insightPulse} style={{ background:c.green }}/>
        </div>
        <div style={{ position:'relative', minHeight:36, marginTop:4 }}>
          <AnimatePresence mode="wait">
            <motion.div key={insightIdx}
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
              transition={{ duration:0.3 }}
              style={{ fontSize:13, color:c.text, fontWeight:600, lineHeight:1.45 }}>
              {insights[insightIdx % insights.length].emoji} {insights[insightIdx % insights.length].text}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <ChevronRight size={18} color={c.text3} style={{ flexShrink:0 }}/>
    </motion.div>
  );
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
              <input placeholder="Search anything..." style={{ color:c.text }}/>
            </div>
            <button className={`${styles.iconBtn} ${styles.mobileSearchBtn}`}
              style={{ background: isDark?'rgba(255,255,255,0.07)':'#FFFFFF', border:`1px solid ${isDark?'rgba(255,255,255,0.08)':'#E4E6F0'}` }}
              onClick={()=>navigate('/transactions')}>
              <Search size={18} color={c.text2}/>
            </button>
            <button className={styles.iconBtn} style={{ background: isDark?'rgba(255,255,255,0.07)':'#FFFFFF', border:`1px solid ${isDark?'rgba(255,255,255,0.08)':'#E4E6F0'}` }}>
              <Bell size={18} color={c.text2}/>
              <span className={styles.bellBadge}>3</span>
            </button>
          </div>
        </motion.div>

        {/* AI Insights — mobile: first card so users see it immediately */}
        <div className={styles.insightMobile}>{insightCard}</div>

        {/* ── Grid (areas keep both columns row-aligned) ─────────── */}
        <div className={styles.grid}>

            {/* Salary Account card — with account switcher dropdown */}
            <motion.div variants={cardVar} whileHover={{ y:-3 }} className={styles.salaryCard}
              style={{ background:c.salaryBg, border:c.salaryBorder, boxShadow:c.cardShadow, position:'relative', zIndex: accDropOpen ? 70 : 'auto' }}>
              <div className={styles.salaryIcon} style={{ background: isDark?'rgba(43,255,136,0.15)':'#4ADE80' }}>
                <Landmark size={26} color={isDark?c.green:'#fff'}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <button
                  onClick={(e)=>{ e.stopPropagation(); if (accounts.length > 0) setAccDropOpen(o=>!o); }}
                  style={{ display:'flex', alignItems:'center', gap:6, minWidth:0, background:'none', border:'none', padding:0, cursor: accounts.length>0?'pointer':'default', maxWidth:'100%' }}>
                  <span style={{ fontSize:17, fontWeight:700, color:c.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {selectedAcc ? salaryName : 'All Accounts'}
                  </span>
                  <ChevronDown size={16} color={c.text3} style={{ flexShrink:0, transform: accDropOpen?'rotate(180deg)':'none', transition:'transform .2s' }}/>
                </button>
                <div style={{ fontSize:13, color:c.text2, marginTop:3, whiteSpace:'nowrap' }}>
                  {selectedAcc ? salaryBank : `${accounts.length} account${accounts.length!==1?'s':''}`}
                </div>
              </div>
              <div style={{ textAlign:'right', cursor:'pointer' }} onClick={()=>navigate('/accounts')}>
                <div className={styles.numLg} style={{ color: (selectedAcc ? salaryBal : balance) < 0 ? c.red : c.text }}>
                  {(selectedAcc ? salaryBal : balance) < 0 && '−'}<CountUp value={selectedAcc ? salaryBal : balance} fmt={fmt}/>
                </div>
                <div style={{ fontSize:12.5, color:c.text2, marginTop:2 }}>Available Balance</div>
              </div>
              <ChevronRight size={20} color={c.text3} style={{ flexShrink:0, cursor:'pointer' }} onClick={()=>navigate('/accounts')}/>

              {/* Dropdown panel */}
              <AnimatePresence>
                {accDropOpen && (
                  <>
                    <div onClick={()=>setAccDropOpen(false)} style={{ position:'fixed', inset:0, zIndex:60 }}/>
                    <motion.div
                      initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                      transition={{ duration:.16 }}
                      style={{ position:'absolute', top:'calc(100% + 8px)', left:16, right:16, zIndex:61,
                        background:c.cardBg, border:`1px solid ${c.border||'rgba(255,255,255,.1)'}`, borderRadius:16,
                        boxShadow:'0 16px 48px rgba(0,0,0,.3)', overflow:'hidden', maxHeight:320, overflowY:'auto' }}>
                      {/* All Accounts option */}
                      <button onClick={()=>{ setSelectedAccId(null); setAccDropOpen(false); }}
                        style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'13px 16px', background: !selectedAcc ? (isDark?'rgba(139,92,246,.14)':'#F5F3FF') : 'transparent', border:'none', cursor:'pointer', textAlign:'left', borderBottom:`1px solid ${c.divider||'rgba(255,255,255,.06)'}` }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:'rgba(139,92,246,.16)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Wallet size={17} color={c.purple}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:c.text }}>All Accounts</div>
                          <div style={{ fontSize:11.5, color:c.text3 }}>Combined balance</div>
                        </div>
                        <span style={{ fontSize:14, fontWeight:800, color:c.text, fontFamily:'Space Grotesk, Inter, sans-serif' }}>
                          {fmt(accounts.reduce((s,w)=>s+parseFloat(w.balance||0),0), {noDecimals:true})}
                        </span>
                      </button>
                      {/* Each account */}
                      {accounts.map(acc => {
                        const sel = selectedAcc && String(acc.id)===String(selectedAcc.id);
                        return (
                          <button key={acc.id} onClick={()=>{ setSelectedAccId(acc.id); setAccDropOpen(false); }}
                            style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'13px 16px', background: sel ? (isDark?'rgba(139,92,246,.14)':'#F5F3FF') : 'transparent', border:'none', cursor:'pointer', textAlign:'left' }}>
                            <div style={{ width:36, height:36, borderRadius:10, background: isDark?'rgba(43,255,136,0.15)':'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <Landmark size={17} color={c.green}/>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:14, fontWeight:700, color:c.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{acc.name}</div>
                              <div style={{ fontSize:11.5, color:c.text3 }}>{acc.last_four ? `•••• ${acc.last_four}` : (acc.type||'account')}</div>
                            </div>
                            <span style={{ fontSize:14, fontWeight:800, color:c.text, fontFamily:'Space Grotesk, Inter, sans-serif' }}>
                              {fmt(parseFloat(acc.balance||0), {noDecimals:true})}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Account Balance card */}
            <motion.div variants={cardVar} className={styles.balanceCard}
              style={{ background:c.balanceBg, border:c.balanceBorder, boxShadow:c.cardShadow }}>
              <div className={styles.cardHeadRow}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className={styles.cardTitle} style={{ color:c.text }}>Account Balance</span>
                  <Eye size={16} color={c.text3}/>
                </div>
                <PeriodPill label="This Month" c={c} isDark={isDark}/>
              </div>

              <div className={styles.balanceBig} style={{ color: balance < 0 ? c.red : c.text }}>
                {balance < 0 && '−'}<CountUp value={balance} fmt={fmt}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                <span style={{ color: balUp?c.green:c.red, fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:4 }}>
                  {balUp ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
                  {Math.abs(balChg).toFixed(1)}%
                </span>
                <span style={{ fontSize:13, color:c.text2 }}>vs last month</span>
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
                <PeriodPill label="This Month" c={c} isDark={isDark}/>
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

            {/* AI Insights — desktop position */}
            <div className={styles.insightDesktop}>{insightCard}</div>

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
                    <PeriodPill label="This Month" c={c} isDark={isDark}/>
                  </div>
                </div>

                {/* Right: stat tiles */}
                <div className={styles.flowTiles}>
                  {[
                    { icon:<Wallet size={18} color="#fff"/>,     bg:c.blue,   label:'Average Balance',      val:fmt(avgBalance,{noDecimals:true}) },
                    { icon:<ListChecks size={18} color="#fff"/>, bg:c.purple, label:'Transactions',          val:String(txCount) },
                    { icon:<Percent size={18} color={isDark?'#04220F':'#fff'}/>, bg:c.green, label:"This Month's Interest", val:fmt(interest,{noDecimals:true}) },
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
