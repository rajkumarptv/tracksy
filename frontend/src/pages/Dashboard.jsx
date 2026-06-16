import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, Target, CreditCard, ShieldCheck,
  Flame, Star, ChevronRight, Plus, Bell, Download,
  Calendar, RefreshCw, Zap, PiggyBank, BarChart2, ChevronDown, Trophy,
} from 'lucide-react';
import {
  dashboardAPI, walletsAPI, goalsAPI, budgetsAPI,
  netWorthAPI, transactionsAPI, recurringAPI,
} from '../services/api';
import { PageLoader, AmountText, Topbar } from '../components/ui';
import useAuthStore from '../store/authStore';
import { useFmt, useT } from '../i18n';
import styles from './Dashboard.module.css';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS = ['#6C63FF','#5B8CFF','#37D67A','#FFB84D','#FF5B5B','#A29BFE','#00CEC9','#636E72'];
const now = new Date();
function isoDate(d) { return d.toISOString().split('T')[0]; }

/* ── Reusable Tooltip ───────────────────────────────── */
function ChartTip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTip}>
      <div className={styles.chartTipLabel}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color: p.color, fontWeight:700, fontSize:12 }}>
          {p.name}: {fmt ? fmt(p.value||0,{noDecimals:true}) : p.value}
        </div>
      ))}
    </div>
  );
}

/* ── Stat Card (top 8) ──────────────────────────────── */
function StatCard({ icon, iconBg, label, value, change, changeSuffix, changePositive, sub, progress, progressColor }) {
  const isPos = changePositive !== false && (typeof changePositive === 'boolean' ? changePositive : (parseFloat(change)||0) >= 0);
  return (
    <div className={styles.statCard}>
      {/* Icon — left side */}
      <div className={styles.statIcon} style={{ background: iconBg }}>{icon}</div>

      {/* Content — right side: label, value, change stacked */}
      <div className={styles.statContent}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>{value}</div>
        {progress !== undefined ? (
          <>
            <div className={styles.statProgress}>
              <div style={{ height:'100%', width:`${Math.min(100,progress)}%`, background: progressColor||'var(--accent)', borderRadius:20, transition:'width .6s ease' }}/>
            </div>
            {sub && <div className={styles.statChange} style={{ color:'var(--text3)' }}>{sub}</div>}
          </>
        ) : (
          <div className={styles.statChange} style={{ color: isPos ? '#37D67A' : '#FF5B5B' }}>
            <span>{isPos ? '▲' : '▼'}</span>{' '}
            {Math.abs(parseFloat(change)||0).toFixed(1)}{changeSuffix||'%'} vs last month
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Section card wrapper ────────────────────────────── */
function Card({ title, subtitle, right, children, style }) {
  return (
    <div className={styles.card} style={style}>
      {(title||right) && (
        <div className={styles.cardHead}>
          <div>
            {title && <div className={styles.cardTitle}>{title}</div>}
            {subtitle && <div className={styles.cardSub}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Budget vs Actual horizontal bar ─────────────────── */
function BudgetBar({ label, icon, iconBg, budget, spent, fmt }) {
  const pct = budget > 0 ? Math.min(100, Math.round((spent/budget)*100)) : 0;
  const over = spent > budget;
  return (
    <div className={styles.budgetRow}>
      <div className={styles.budgetRowIcon} style={{ background: iconBg }}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
          <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{label}</span>
          <span style={{ fontSize:12, fontWeight:700, color: over ? 'var(--red)' : 'var(--green)' }}>{fmt(spent,{noDecimals:true})}</span>
        </div>
        <div className={styles.budgetTrack}>
          <div style={{ height:'100%', width:`${pct}%`, background: over ? 'var(--red)' : '#37D67A', borderRadius:20 }}/>
          <div className={styles.budgetBudgetMarker} style={{ left:`${Math.min(100,Math.round((budget/Math.max(budget,spent))*100))}%` }}/>
        </div>
        <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:3 }}>Budget: {fmt(budget,{noDecimals:true})} · {pct}% used</div>
      </div>
    </div>
  );
}

/* ── Financial Score gauge ───────────────────────────── */
function ScoreGauge({ score }) {
  const r = 54; const cx = 70; const cy = 70;
  const circ = Math.PI * r;
  const pct = score / 100;
  const dash = pct * circ;
  const color = score >= 80 ? '#37D67A' : score >= 60 ? '#FFB84D' : '#FF5B5B';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <svg width={140} height={80} viewBox="0 0 140 80">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="var(--surface3)" strokeWidth={10} strokeLinecap="round"/>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition:'stroke-dasharray .8s ease' }}/>
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="26" fontWeight="900" fill="var(--text)" fontFamily="Space Grotesk,sans-serif">{score}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="11" fill="var(--text3)" fontFamily="Space Grotesk,sans-serif">/100</text>
      </svg>
      <div style={{ fontSize:13, fontWeight:700, color, marginTop:-8 }}>{label}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const fmt = useFmt();
  const t = useT();

  const [flowPeriod, setFlowPeriod] = useState('Monthly');
  const [spendPeriod, setSpendPeriod] = useState('This Year');
  const [cashPeriod, setCashPeriod] = useState('This Month');
  const [selectedWalletId, setSelectedWalletId] = useState(null);

  /* ── Challenges from localStorage ── */
  const [challenges] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tracksy_challenges') || '[]'); } catch { return []; }
  });

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
  const { data: flowData } = useQuery({
    queryKey:['money-flow', curY],
    queryFn: () => dashboardAPI.moneyFlow({ year:curY }).then(r=>r.data.data),
  });
  const { data: catBreakdown } = useQuery({
    queryKey:['cat-breakdown', curY, curM],
    queryFn: () => dashboardAPI.categoryBreakdown({ year:curY, month:curM }).then(r=>r.data.data),
  });
  const { data: wallets } = useQuery({ queryKey:['wallets'], queryFn:()=>walletsAPI.getAll().then(r=>r.data.data) });
  const { data: goals } = useQuery({ queryKey:['goals'], queryFn:()=>goalsAPI.getAll().then(r=>r.data.data) });
  const { data: budgets } = useQuery({ queryKey:['budgets'], queryFn:()=>budgetsAPI.getAll().then(r=>r.data.data) });
  const { data: nwHistory } = useQuery({ queryKey:['nw-history'], queryFn:()=>netWorthAPI.history().then(r=>r.data.data) });
  const { data: recurring } = useQuery({ queryKey:['recurring'], queryFn:()=>recurringAPI.getAll().then(r=>r.data.data) });
  const { data: recentTx } = useQuery({
    queryKey:['recent-tx-dash'],
    queryFn: () => dashboardAPI.recentTransactions({ limit:100, month:curM, year:curY }).then(r=>r.data.data),
  });

  const [autoSwitchedMonth, setAutoSwitchedMonth] = useState(false);
  const [displayMonth, setDisplayMonth] = useState({ m: curM, y: curY });
  const { data: displaySummary } = useQuery({
    queryKey:['dash-summary-display', displayMonth.m, displayMonth.y],
    queryFn: () => dashboardAPI.summary({ month:displayMonth.m, year:displayMonth.y }).then(r=>r.data.data),
  });

  useEffect(() => {
    if (!autoSwitchedMonth && summary &&
        parseFloat(summary.income||0) === 0 && parseFloat(summary.expense||0) === 0) {
      setDisplayMonth({ m: prevM, y: prevY });
      setAutoSwitchedMonth(true);
    }
  }, [summary]);

  const d = displaySummary || summary || {};
  const prev = prevSummary || {};

  /* ── Per-wallet filtered stats ── */
  const selectedWallet = selectedWalletId ? (wallets||[]).find(w => w.id === selectedWalletId) : null;
  const walletTx = useMemo(() => {
    if (!selectedWalletId || !recentTx) return recentTx || [];
    return (recentTx || []).filter(tx =>
      String(tx.wallet_id) === String(selectedWalletId) ||
      String(tx.to_wallet_id) === String(selectedWalletId)
    );
  }, [recentTx, selectedWalletId]);

  /* ── Derived numbers ── */
  const income  = selectedWalletId
    ? walletTx.filter(t=>t.type==='income').reduce((s,t)=>s+parseFloat(t.amount||0),0)
    : parseFloat(d.income || 0);
  const expense = selectedWalletId
    ? walletTx.filter(t=>t.type==='expense').reduce((s,t)=>s+parseFloat(t.amount||0),0)
    : parseFloat(d.expense || 0);
  const savings   = income - expense;
  const balance   = selectedWallet
    ? parseFloat(selectedWallet.balance || 0)
    : parseFloat(d.total_balance || 0);
  const totalAssets = (wallets||[]).filter(w=>!['visa','mastercard','loan','lending'].includes(w.type)).reduce((s,w)=>s+parseFloat(w.balance||0),0);
  const totalDebt   = (wallets||[]).filter(w=>['visa','mastercard','loan','lending'].includes(w.type)).reduce((s,w)=>s+Math.abs(parseFloat(w.balance||0)),0);
  const netWorth    = totalAssets - totalDebt;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  const prevIncome  = parseFloat(prev.income || 0);
  const prevExpense = parseFloat(prev.expense || 0);
  const incomeChg   = prevIncome  > 0 ? ((income - prevIncome) / prevIncome * 100) : 0;
  const expenseChg  = prevExpense > 0 ? ((expense - prevExpense) / prevExpense * 100) : 0;

  const totalBudget = (budgets||[]).reduce((s,b)=>s+parseFloat(b.amount||0),0);
  const totalSpent  = (budgets||[]).reduce((s,b)=>s+parseFloat(b.spent||0),0);
  const budgetLeft  = Math.max(0, totalBudget - totalSpent);
  const budgetPct   = totalBudget > 0 ? Math.round((totalSpent/totalBudget)*100) : 0;

  /* ── Emergency fund goal ── */
  const efGoal = (goals||[]).find(g => /emergency/i.test(g.name));
  const efAmt  = efGoal ? parseFloat(efGoal.current_amount||0) : 0;
  const efTarget = efGoal ? parseFloat(efGoal.target_amount||0) : 0;
  const efPct  = efTarget > 0 ? Math.round((efAmt/efTarget)*100) : 0;

  /* ── Flow chart data (12 months) ── */
  const chartFlow = (flowData||[]).map((m,i) => ({
    name: MONTHS[i],
    Income:  m.income  || 0,
    Expenses: m.expense || 0,
    Savings: Math.max(0, (m.income||0) - (m.expense||0)),
  }));

  /* ── Category breakdown ── */
  const pieRaw = (catBreakdown||[]).filter(c=>c.value>0);
  const pieTot = pieRaw.reduce((s,c)=>s+c.value,0);
  const pieData = pieRaw.map((c,i) => ({ ...c, pct: pieTot>0?Math.round((c.value/pieTot)*100):0, color: c.color||PIE_COLORS[i%PIE_COLORS.length] }));

  /* ── Net worth history ── */
  const nwChartData = (nwHistory||[]).map(s=>({
    name: new Date(s.snapshot_date).toLocaleDateString('en-US',{month:'short'}),
    'Net Worth': parseFloat(s.net_worth||0),
  }));

  /* ── Subscriptions from recurring ── */
  const subs = (recurring||[]).filter(r=>r.type==='expense').slice(0,4);
  const subTotal = subs.reduce((s,r)=>s+parseFloat(r.amount||0),0);

  /* ── Debt & EMI from wallets ── */
  const LIABILITY_TYPES_SET = new Set(['visa','mastercard','home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','bnpl','family_borrow','emi']);
  const debtWallets = (wallets||[]).filter(w => LIABILITY_TYPES_SET.has(w.type));

  /* ── Goals ── */
  const goalList = (goals||[]).slice(0,4);

  /* ── Income source (from category breakdown for income) ── */
  const incomeSourceColors = ['#6C63FF','#5B8CFF','#37D67A','#FFB84D','#FF5B5B'];

  /* ── Financial Score ── */
  const finScore = Math.min(100, Math.round(
    (Math.min(savingsRate, 30) / 30 * 35) +    // savings rate up to 35pts
    (budgetPct < 100 ? 25 : Math.max(0,25-(budgetPct-100)/4)) +  // budget control 25pts
    (efPct > 0 ? Math.min(efPct*0.25, 25) : 0) +                 // emergency fund 25pts
    (goalList.length > 0 ? 15 : 0)                                // has goals 15pts
  ));

  /* ── AI Insights (rule-based) ── */
  const insights = [];
  if (expense > 0 && expenseChg > 10)
    insights.push({ icon:'🔴', text:`Expenses up ${expenseChg.toFixed(0)}% vs last month. Review your spending.` });
  if (savingsRate >= 20)
    insights.push({ icon:'🟢', text:`You saved ${savingsRate}% of income this month. Great job!` });
  if (budgetPct > 90)
    insights.push({ icon:'🟡', text:`Budget ${budgetPct}% used — close to your limit.` });
  if (efPct > 0)
    insights.push({ icon:'🔵', text:`Emergency fund at ${efPct}% of goal (${fmt(efAmt,{noDecimals:true})}).` });
  if (insights.length === 0)
    insights.push({ icon:'💡', text:`Add transactions to get personalized insights.` });

  /* ── Monthly Spending Trend (bar chart) ── */
  const spendTrend = chartFlow;

  /* ── Cash Flow Analysis ── */
  const cashFlowData = [
    { name:'Income',     value: income,   fill:'#37D67A' },
    { name:'Expenses',   value: -expense, fill:'#FF5B5B' },
    { name:'Savings',    value: savings,  fill:'#6C63FF' },
    { name:'Debt',       value: -totalDebt * 0.05, fill:'#FFB84D' },
    { name:'Net Worth',  value: netWorth > 0 ? netWorth * 0.1 : 0, fill:'#5B8CFF' },
  ];

  /* ── Annual Report ── */
  const annualInc = chartFlow.reduce((s,m)=>s+m.Income,0);
  const annualExp = chartFlow.reduce((s,m)=>s+m.Expenses,0);
  const annualSav = annualInc - annualExp;
  const annualRate = annualInc > 0 ? ((annualSav/annualInc)*100).toFixed(1) : '0.0';
  const bestMonthIdx = chartFlow.reduce((mi,m,i,a)=>m.Income>a[mi].Income?i:mi,0);

  const periodLabel = `${MONTHS[displayMonth.m-1]} ${displayMonth.y}`;

  const activeChallenges = challenges.filter(c => c.status !== 'completed').slice(0, 3);
  const greetingHour = now.getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';
  const debtToFreedom = 10000000 - netWorth; // ₹1 crore goal
  const debtToFreedomPct = Math.min(100, Math.max(0, Math.round((netWorth / 10000000) * 100)));

  return (
    <div className={styles.page}>

      {/* ── Mobile Hero Header (hidden on desktop) ── */}
      <div className={styles.mobileHero}>
        <div className={styles.mobileHeroInner}>
          <div className={styles.mobileGreeting}>{greeting}, {user?.first_name || 'Raj'}! 👋</div>
          <div className={styles.mobileGreetingSub}>Here's your financial overview</div>
          <div className={styles.mobileHeroControls}>
            <div className={styles.mobilePeriodPill}>
              <Calendar size={13} color="rgba(255,255,255,.85)"/>
              <span>{periodLabel}</span>
            </div>
            <div className={styles.mobileAccountPill}>
              <Wallet size={12} color="rgba(255,255,255,.85)"/>
              <select
                value={selectedWalletId || ''}
                onChange={e => setSelectedWalletId(e.target.value || null)}
                className={styles.mobileAccountSelect}
              >
                <option value="">All</option>
                {(wallets||[]).map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <ChevronDown size={11} color="rgba(255,255,255,.85)" style={{ flexShrink:0, pointerEvents:'none' }}/>
            </div>
          </div>
        </div>

        {/* Net Worth Hero Card — slides over gradient */}
        <div className={styles.nwHeroCard}>
          <div className={styles.nwHeroLabel}>Net Worth</div>
          <div className={styles.nwHeroValue}>{fmt(netWorth)}</div>
          <div className={styles.nwHeroChange} style={{ color: netWorth >= 0 ? '#37D67A' : '#FF5B5B' }}>
            <span>{netWorth >= 0 ? '▲' : '▼'}</span>
            <span>{Math.abs(incomeChg).toFixed(1)}% vs last month</span>
          </div>
          <div className={styles.nwHeroGrid}>
            <div className={styles.nwHeroGridItem}>
              <div className={styles.nwHeroGridLabel}>Income</div>
              <div className={styles.nwHeroGridValue} style={{ color:'#37D67A' }}>{fmt(income,{noDecimals:true})}</div>
              <div className={styles.nwHeroGridChange} style={{ color: incomeChg >= 0 ? '#37D67A' : '#FF5B5B' }}>
                <span>{incomeChg >= 0 ? '▲' : '▼'}</span>{Math.abs(incomeChg).toFixed(1)}%
              </div>
            </div>
            <div className={styles.nwHeroGridItem}>
              <div className={styles.nwHeroGridLabel}>Expenses</div>
              <div className={styles.nwHeroGridValue} style={{ color:'#FF5B5B' }}>{fmt(expense,{noDecimals:true})}</div>
              <div className={styles.nwHeroGridChange} style={{ color: expenseChg < 0 ? '#37D67A' : '#FF5B5B' }}>
                <span>{expenseChg >= 0 ? '▲' : '▼'}</span>{Math.abs(expenseChg).toFixed(1)}%
              </div>
            </div>
            <div className={styles.nwHeroGridItem}>
              <div className={styles.nwHeroGridLabel}>Savings</div>
              <div className={styles.nwHeroGridValue} style={{ color:'#5B8CFF' }}>{fmt(Math.max(0,savings),{noDecimals:true})}</div>
              <div className={styles.nwHeroGridChange} style={{ color:'#5B8CFF' }}>
                {savingsRate}% rate
              </div>
            </div>
            <div className={styles.nwHeroGridItem}>
              <div className={styles.nwHeroGridLabel}>₹1Cr Goal</div>
              <div className={styles.nwHeroGridValue} style={{ color:'#FFB84D' }}>{debtToFreedomPct}%</div>
              <div style={{ marginTop:4, height:4, background:'var(--surface3)', borderRadius:20, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${debtToFreedomPct}%`, background:'#FFB84D', borderRadius:20 }}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop Topbar (hidden on mobile via CSS) ── */}
      <div className={styles.desktopTopbar}>
        <Topbar>
          <div className={styles.accountDropdown}>
            <Wallet size={13} color="var(--accent)" style={{ flexShrink:0 }}/>
            <select
              value={selectedWalletId || ''}
              onChange={e => setSelectedWalletId(e.target.value || null)}
              className={styles.accountSelect}
            >
              <option value="">All Accounts</option>
              {(wallets||[]).map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <ChevronDown size={11} color="var(--text3)" style={{ flexShrink:0, pointerEvents:'none', marginLeft:-18 }}/>
          </div>
          <div className={styles.topbarDate}>
            <Calendar size={13} color="var(--text3)"/>
            <span>{periodLabel}</span>
          </div>
        </Topbar>
      </div>

      <div className={styles.content}>

        {/* ══ ROW 1 — 4 primary stat cards ══ */}
        <div className={styles.statsRow}>
          <StatCard
            icon={<Wallet size={18} color="#6C63FF"/>} iconBg="rgba(108,99,255,.15)"
            label="Total Balance" value={fmt(balance)}
            change={incomeChg} changePositive={incomeChg >= 0}
          />
          <StatCard
            icon={<TrendingUp size={18} color="#37D67A"/>} iconBg="rgba(55,214,122,.15)"
            label="Total Income" value={fmt(income)}
            change={incomeChg} changePositive={incomeChg >= 0}
          />
          <StatCard
            icon={<TrendingDown size={18} color="#FF5B5B"/>} iconBg="rgba(255,91,91,.15)"
            label="Total Expenses" value={fmt(expense)}
            change={expenseChg} changePositive={expenseChg < 0}
          />
          <StatCard
            icon={<PiggyBank size={18} color="#5B8CFF"/>} iconBg="rgba(91,140,255,.15)"
            label="Total Savings" value={fmt(Math.max(0,savings))}
            change={savingsRate} changeSuffix="% saved"
            changePositive={savings >= 0}
          />
        </div>

        {/* ══ ROW 2 — 4 secondary stat cards ══ */}
        <div className={styles.statsRow}>
          <StatCard
            icon={<Star size={18} color="#FFB84D"/>} iconBg="rgba(255,184,77,.15)"
            label="Savings Rate" value={`${savingsRate}%`}
            change={savingsRate} changeSuffix="% of income"
            changePositive={savingsRate >= 20}
          />
          <StatCard
            icon={<BarChart2 size={18} color="#6C63FF"/>} iconBg="rgba(108,99,255,.15)"
            label="Net Worth" value={fmt(netWorth)}
            change={10} changePositive={netWorth >= 0}
          />
          <StatCard
            icon={<Target size={18} color="#37D67A"/>} iconBg="rgba(55,214,122,.15)"
            label="Budget Remaining" value={fmt(budgetLeft)}
            sub={`${budgetPct}% of total budget`}
            progress={budgetPct} progressColor={budgetPct>90?'var(--red)':'#37D67A'}
          />
          <StatCard
            icon={<ShieldCheck size={18} color="#5B8CFF"/>} iconBg="rgba(91,140,255,.15)"
            label="Emergency Fund" value={fmt(efAmt)}
            sub={efTarget > 0 ? `${efPct}% of ${MONTHS[0]} goal` : 'No goal set'}
            progress={efPct} progressColor="#5B8CFF"
          />
        </div>

        {/* ══ ROW 3 — Income vs Expense Trend + Category Breakdown ══ */}
        <div className={styles.row2col}>

          {/* Income vs Expense Trend */}
          <Card title="Income vs Expense Trend"
            right={
              <select className={styles.selectPill} value={flowPeriod} onChange={e=>setFlowPeriod(e.target.value)}>
                <option>Monthly</option><option>Quarterly</option><option>Yearly</option>
              </select>
            }>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartFlow} margin={{ top:6, right:4, left:-20, bottom:0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}
                  tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                <Tooltip content={<ChartTip fmt={fmt}/>}/>
                <Line type="monotone" dataKey="Income"   stroke="#37D67A" strokeWidth={2.5} dot={false} activeDot={{ r:4 }}/>
                <Line type="monotone" dataKey="Expenses" stroke="#FF5B5B" strokeWidth={2.5} dot={false} activeDot={{ r:4 }}/>
                <Line type="monotone" dataKey="Savings"  stroke="#5B8CFF" strokeWidth={2}   dot={false} activeDot={{ r:4 }} strokeDasharray="4 2"/>
              </LineChart>
            </ResponsiveContainer>
            <div className={styles.chartLegend}>
              {[{c:'#37D67A',l:'Income'},{c:'#FF5B5B',l:'Expenses'},{c:'#5B8CFF',l:'Savings'}].map(i=>(
                <div key={i.l} className={styles.legendItem}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:i.c }}/>
                  <span>{i.l}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Expense Category Breakdown */}
          <Card title="Expense Category Breakdown" right={<span className={styles.periodBadge}>{periodLabel}</span>}>
            {pieData.length === 0 ? (
              <div className={styles.emptyState}>📊 No expense data yet</div>
            ) : (
              <div className={styles.pieRow}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                        dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                        {pieData.map((c,i)=><Cell key={i} fill={c.color}/>)}
                      </Pie>
                      <Tooltip formatter={(v,_,p)=>[fmt(v),p.payload.name]}
                        contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.pieCenter}>
                    <div className={styles.pieCenterValue}>{fmt(pieTot,{noDecimals:true})}</div>
                    <div className={styles.pieCenterLabel}>Total</div>
                  </div>
                </div>
                <div className={styles.pieLegend}>
                  {pieData.map((c,i)=>(
                    <div key={i} className={styles.pieLegendRow}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                      <span style={{ flex:1, fontSize:12, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', flexShrink:0 }}>{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ══ ROW 4 — Monthly Spending Trend + Savings Growth Tracker ══ */}
        <div className={styles.row2col}>

          {/* Monthly Spending Trend */}
          <Card title="Monthly Spending Trend"
            right={
              <select className={styles.selectPill} value={spendPeriod} onChange={e=>setSpendPeriod(e.target.value)}>
                <option>This Year</option><option>Last Year</option>
              </select>
            }>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={spendTrend} margin={{ top:6, right:4, left:-20, bottom:0 }} barSize={14}>
                <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}
                  tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                <Tooltip content={<ChartTip fmt={fmt}/>}/>
                <Bar dataKey="Expenses" fill="#6C63FF" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Savings Growth Tracker */}
          <Card title="Savings Growth Tracker"
            right={
              <select className={styles.selectPill}>
                <option>Yearly</option>
              </select>
            }>
            <div className={styles.savingsTrackerRow}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartFlow} margin={{ top:6, right:4, left:-20, bottom:0 }}>
                  <defs>
                    <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#37D67A" stopOpacity={0.25}/>
                      <stop offset="100%" stopColor="#37D67A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}
                    tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <Tooltip content={<ChartTip fmt={fmt}/>}/>
                  <Area type="monotone" dataKey="Savings" stroke="#37D67A" strokeWidth={2.5}
                    fill="url(#savGrad)" dot={false} activeDot={{ r:4 }}/>
                </AreaChart>
              </ResponsiveContainer>
              {efGoal && (
                <div className={styles.savingsGoalPanel}>
                  <div className={styles.savingsGoalItem}>
                    <div className={styles.savingsGoalLabel}>Goal</div>
                    <div className={styles.savingsGoalValue}>{fmt(efTarget,{noDecimals:true})}</div>
                  </div>
                  <div className={styles.savingsGoalItem}>
                    <div className={styles.savingsGoalLabel}>Progress</div>
                    <div className={styles.savingsGoalValue} style={{ color:'#37D67A' }}>{efPct}%</div>
                    <div className={styles.savingsGoalBar}>
                      <div style={{ height:'100%', width:`${efPct}%`, background:'#37D67A', borderRadius:20 }}/>
                    </div>
                  </div>
                  <div className={styles.savingsGoalItem}>
                    <div className={styles.savingsGoalLabel}>Remaining</div>
                    <div className={styles.savingsGoalValue}>{fmt(Math.max(0,efTarget-efAmt),{noDecimals:true})}</div>
                  </div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
                    {fmt(efAmt,{noDecimals:true})} saved
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ══ ROW 5 — Budget vs Actual + Cash Flow Analysis ══ */}
        <div className={styles.row2col}>

          {/* Budget vs Actual */}
          <Card title="Budget vs Actual Spending"
            right={
              <div style={{ display:'flex', gap:14 }}>
                <div className={styles.legendItem}><div style={{ width:10, height:10, borderRadius:3, background:'#5B8CFF' }}/><span>Budget</span></div>
                <div className={styles.legendItem}><div style={{ width:10, height:10, borderRadius:3, background:'#37D67A' }}/><span>Actual</span></div>
              </div>
            }>
            {(budgets||[]).length === 0 ? (
              <div className={styles.emptyState}>No budgets set. <span style={{ color:'var(--accent)', cursor:'pointer' }} onClick={()=>navigate('/budget')}>Add one →</span></div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:4 }}>
                {(budgets||[]).slice(0,5).map(b => (
                  <BudgetBar key={b.id}
                    label={b.name || b.category_name}
                    icon={<span style={{ fontSize:14 }}>{b.emoji || '📋'}</span>}
                    iconBg={b.color ? `${b.color}22` : 'rgba(108,99,255,.12)'}
                    budget={parseFloat(b.amount||0)}
                    spent={parseFloat(b.spent||0)}
                    fmt={fmt}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Cash Flow Analysis */}
          <Card title="Cash Flow Analysis"
            right={
              <select className={styles.selectPill} value={cashPeriod} onChange={e=>setCashPeriod(e.target.value)}>
                <option>This Month</option><option>This Year</option>
              </select>
            }>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cashFlowData} margin={{ top:10, right:4, left:-20, bottom:0 }} barSize={28}>
                <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}
                  tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v>=0?v:`−${Math.abs(v/1000).toFixed(0)}k`}/>
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const val = payload[0]?.value || 0;
                    return (
                      <div className={styles.chartTip}>
                        <div className={styles.chartTipLabel}>{label}</div>
                        <div style={{ color: val >= 0 ? '#37D67A':'#FF5B5B', fontWeight:700 }}>
                          {fmt(Math.abs(val), {noDecimals:true})}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {cashFlowData.map((c,i) => <Cell key={i} fill={c.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ══ ROW 6 — Net Worth Growth + Income Source + Subscriptions ══ */}
        <div className={styles.row3col}>

          {/* Net Worth Growth */}
          <Card title="Net Worth Growth"
            right={
              <select className={styles.selectPill}>
                <option>This Year</option>
              </select>
            }>
            {nwChartData.length > 1 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={nwChartData} margin={{ top:6, right:4, left:-20, bottom:0 }}>
                    <defs>
                      <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.25}/>
                        <stop offset="100%" stopColor="#6C63FF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}
                      tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                    <Tooltip content={<ChartTip fmt={fmt}/>}/>
                    <Area type="monotone" dataKey="Net Worth" stroke="#6C63FF" strokeWidth={2.5}
                      fill="url(#nwGrad)" dot={false} activeDot={{ r:4, fill:'#6C63FF' }}/>
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ textAlign:'center', marginTop:8 }}>
                  <div className="mono" style={{ fontSize:18, fontWeight:900, color:'#6C63FF' }}>{fmt(netWorth,{noDecimals:true})}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>Current Net Worth</div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState} style={{ height:190 }}>
                <div style={{ fontSize:30, marginBottom:8 }}>📈</div>
                <div>No history yet. Snapshots are taken automatically.</div>
              </div>
            )}
          </Card>

          {/* Income Source Analysis */}
          <Card title="Income Source Analysis">
            {income === 0 ? (
              <div className={styles.emptyState} style={{ height:220 }}>
                <div style={{ fontSize:30, marginBottom:8 }}>💰</div>
                <div>No income recorded this month.</div>
              </div>
            ) : (
              <>
                {(() => {
                  const incCats = (catBreakdown||[]).filter(c=>c.type==='income'||(!c.type && c.value>0));
                  const totalI  = incCats.reduce((s,c)=>s+c.value,0) || income;
                  const incData = incCats.length > 0
                    ? incCats.map((c,i)=>({ name:c.name, value:c.value, pct:Math.round(c.value/totalI*100), color:incomeSourceColors[i%incomeSourceColors.length] }))
                    : [{ name:'Income', value:income, pct:100, color:'#6C63FF' }];
                  return (
                    <div className={styles.pieRow}>
                      <div style={{ position:'relative', flexShrink:0 }}>
                        <ResponsiveContainer width={150} height={150}>
                          <PieChart>
                            <Pie data={incData} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                              dataKey="value" paddingAngle={2}>
                              {incData.map((c,i)=><Cell key={i} fill={c.color}/>)}
                            </Pie>
                            <Tooltip formatter={(v,_,p)=>[fmt(v),p.payload.name]}
                              contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }}/>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className={styles.pieCenter}>
                          <div style={{ fontSize:11, fontWeight:900, color:'var(--text)' }}>{fmt(income,{noDecimals:true})}</div>
                          <div style={{ fontSize:9, color:'var(--text3)' }}>Total</div>
                        </div>
                      </div>
                      <div className={styles.pieLegend}>
                        {incData.map((c,i)=>(
                          <div key={i} className={styles.pieLegendRow}>
                            <div style={{ width:10, height:10, borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                            <span style={{ flex:1, fontSize:11, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                            <span style={{ fontSize:11, fontWeight:700, color:'var(--text)', flexShrink:0 }}>{c.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </Card>

          {/* Subscription Tracker */}
          <Card title="Subscription Tracker"
            right={<button className={styles.viewAllBtn} onClick={()=>navigate('/recurring')}>View All</button>}>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
              {subs.length === 0 ? (
                <div className={styles.emptyState}>No subscriptions tracked.</div>
              ) : (
                subs.map(s => {
                  const nextDate = s.next_date ? new Date(s.next_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
                  return (
                    <div key={s.id} className={styles.subRow}>
                      <div className={styles.subIcon}>{s.emoji || '📦'}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{fmt(s.amount)}</div>
                        <div style={{ fontSize:10.5, color:'var(--text3)' }}>{nextDate}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {subs.length > 0 && (
              <div className={styles.subTotal}>
                <span style={{ fontSize:12, color:'var(--text3)' }}>Total Monthly</span>
                <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{fmt(subTotal)}</span>
              </div>
            )}
          </Card>
        </div>

        {/* ══ ROW 7 — Debt & EMI + Financial Score + AI Insights ══ */}
        <div className={styles.row3col}>

          {/* Debt & EMI Tracker */}
          <Card title="Debt & EMI Tracker"
            right={<button className={styles.viewAllBtn} onClick={()=>navigate('/debts')}>View All</button>}>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
              {debtWallets.length === 0 ? (
                <div className={styles.emptyState}>No debts or loans recorded.</div>
              ) : (
                debtWallets.slice(0,4).map((w,i) => {
                  const ICONS = { visa:'💳', mastercard:'💳', home_loan:'🏠', vehicle_loan:'🚗', personal_loan:'💼', gold_loan:'🪙', education_loan:'🎓', loan:'📋', bnpl:'🛍️', family_borrow:'👨‍👩‍👧', emi:'📅' };
                  const COLORS = { visa:'#FF5B5B', mastercard:'#EB001B', home_loan:'#FF5B5B', vehicle_loan:'#FFB84D', personal_loan:'#FF79A8', gold_loan:'#FFB84D', education_loan:'#5B8CFF', loan:'#A29BFE', bnpl:'#FF79A8', family_borrow:'#FFB84D', emi:'#6C63FF' };
                  const bal = Math.abs(parseFloat(w.balance||0));
                  const limit = parseFloat(w.credit_limit||0);
                  const usedPct = limit > 0 ? Math.round((bal/limit)*100) : null;
                  return (
                    <div key={w.id} className={styles.debtRow}>
                      <div className={styles.debtIcon} style={{ background:`${COLORS[w.type]||'#6C63FF'}22` }}>
                        <span style={{ fontSize:16 }}>{ICONS[w.type]||'📋'}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{w.name}</div>
                        <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:1 }}>
                          {fmt(bal,{noDecimals:true})} outstanding
                        </div>
                      </div>
                      {usedPct !== null && (
                        <div style={{ flexShrink:0, textAlign:'right' }}>
                          <div style={{ fontSize:11, color: usedPct>80?'var(--red)':'var(--text3)', fontWeight:600 }}>{usedPct}% Used</div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Financial Score */}
          <Card title="Financial Score">
            <ScoreGauge score={finScore}/>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
              {[
                { label:'Savings Rate',   val: Math.min(100,savingsRate*3),    suffix:`${savingsRate}/100` },
                { label:'Budget Control', val: Math.max(0,100-budgetPct),      suffix:`${Math.max(0,100-budgetPct)}/100` },
                { label:'Debt Ratio',     val: totalDebt>0?Math.max(0,100-Math.round(totalDebt/Math.max(1,netWorth)*100)):100, suffix:'—/100' },
                { label:'Goal Progress',  val: efPct,                          suffix:`${efPct}/100` },
              ].map(({ label, val, suffix }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:11, color:'var(--text3)', width:110, flexShrink:0 }}>{label}</span>
                  <div style={{ flex:1, height:5, background:'var(--surface3)', borderRadius:20, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100,Math.max(0,val))}%`, background:'#6C63FF', borderRadius:20 }}/>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--text)', width:40, textAlign:'right', flexShrink:0 }}>{suffix}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(55,214,122,.08)', borderRadius:10, border:'1px solid rgba(55,214,122,.2)', fontSize:12, color:'var(--text2)', display:'flex', alignItems:'center', gap:8 }}>
              <span>👍</span>
              <span>{finScore >= 70 ? "You're in good financial shape!" : finScore >= 50 ? 'Keep working on your goals.' : 'Review your spending & savings.'}</span>
            </div>
          </Card>

          {/* AI Insights */}
          <Card title="AI Insights"
            right={<button className={styles.viewAllBtn} onClick={()=>navigate('/analytics')}>View All Insights ✦</button>}>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
              {insights.map((ins, i) => (
                <div key={i} className={styles.insightRow}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{ins.icon}</span>
                  <span style={{ fontSize:12.5, color:'var(--text2)', lineHeight:1.4 }}>{ins.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ══ ROW 8 — Goal Tracking + Savings Challenges + Annual Finance Report ══ */}
        <div className={styles.row3col}>

          {/* Goal Tracking */}
          <Card title="Goal Tracking"
            right={<button className={styles.viewAllBtn} onClick={()=>navigate('/goals')}>View All</button>}>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:4 }}>
              {goalList.length === 0 ? (
                <div className={styles.emptyState}>No goals yet. <span style={{ color:'var(--accent)', cursor:'pointer' }} onClick={()=>navigate('/goals')}>Add one →</span></div>
              ) : (
                goalList.map(g => {
                  const cur = parseFloat(g.current_amount||0);
                  const tgt = parseFloat(g.target_amount||0);
                  const pct = tgt > 0 ? Math.min(100, Math.round((cur/tgt)*100)) : 0;
                  const daysLeft = g.target_date ? Math.max(0, Math.ceil((new Date(g.target_date) - new Date()) / 86400000)) : null;
                  return (
                    <div key={g.id} className={styles.goalRow}>
                      <div className={styles.goalIcon} style={{ background:(g.color||'#6C63FF')+'22' }}>
                        <span style={{ fontSize:16 }}>{g.emoji || '🎯'}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>{g.name}</span>
                          <span style={{ fontSize:12, fontWeight:700, color: pct>=100 ? '#37D67A' : 'var(--accent)', flexShrink:0 }}>{pct}%</span>
                        </div>
                        <div className={styles.goalTrack}>
                          <div style={{ height:'100%', width:`${pct}%`, background: pct>=100 ? '#37D67A' : (g.color||'#6C63FF'), borderRadius:20, transition:'width .6s' }}/>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                          <span style={{ fontSize:10.5, color:'var(--text3)' }}>{fmt(cur,{noDecimals:true})} / {fmt(tgt,{noDecimals:true})}</span>
                          {daysLeft !== null && <span style={{ fontSize:10.5, color:'var(--text3)' }}>{daysLeft}d left</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {goalList.length > 0 && (
                <div style={{ display:'flex', gap:10, marginTop:4, padding:'10px 12px', background:'rgba(55,214,122,.06)', borderRadius:10, border:'1px solid rgba(55,214,122,.15)' }}>
                  <div style={{ flex:1, fontSize:11, color:'var(--text3)' }}>
                    <span style={{ fontWeight:700, color:'#37D67A' }}>{(goals||[]).filter(g=>parseFloat(g.percentage||0)>=100).length}</span> completed ·{' '}
                    <span style={{ fontWeight:700, color:'var(--accent)' }}>{goalList.length}</span> active
                  </div>
                  <button onClick={()=>navigate('/goals')} style={{ fontSize:11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>+ Add Goal</button>
                </div>
              )}
            </div>
          </Card>

          {/* Savings Challenges */}
          <Card title="Savings Challenges"
            right={<button className={styles.viewAllBtn} onClick={()=>navigate('/challenges')}>View All</button>}>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
              {activeChallenges.length === 0 ? (
                <div className={styles.emptyState} style={{ flexDirection:'column', gap:10, padding:'18px 0' }}>
                  <Trophy size={28} color="var(--text3)"/>
                  <div>No active challenges.</div>
                  <button onClick={()=>navigate('/challenges')} style={{ fontSize:12, fontWeight:700, color:'var(--accent)', background:'none', border:'1px solid var(--accent)', borderRadius:8, padding:'5px 14px', cursor:'pointer' }}>
                    Start a Challenge →
                  </button>
                </div>
              ) : (
                activeChallenges.map(c => {
                  const target = parseFloat(c.targetAmount || c.target || 0);
                  const saved  = parseFloat(c.saved || 0);
                  const pct    = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
                  const checkIns = c.checkIns || [];
                  const streak = (() => {
                    let s = 0;
                    const today = new Date(); today.setHours(0,0,0,0);
                    for (let i = 0; i < 60; i++) {
                      const d = new Date(today); d.setDate(d.getDate() - i);
                      const key = d.toISOString().split('T')[0];
                      if (checkIns.includes(key)) s++; else break;
                    }
                    return s;
                  })();
                  const EMOJI_MAP = { '52-week':'📅', 'no-spend':'🚫', 'emergency':'🛡️', vacation:'✈️', 'round-up':'🔄', custom:'⭐' };
                  const emoji = EMOJI_MAP[c.type] || '🏆';
                  return (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:'rgba(162,155,254,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                        {emoji}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{c.name || c.title}</span>
                          <span style={{ fontSize:11.5, fontWeight:700, color:'#A29BFE', flexShrink:0 }}>{pct}%</span>
                        </div>
                        <div style={{ height:5, background:'var(--surface3)', borderRadius:20, overflow:'hidden', marginBottom:3 }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#A29BFE,#6C63FF)', borderRadius:20, transition:'width .6s' }}/>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span style={{ fontSize:10.5, color:'var(--text3)' }}>{fmt(saved,{noDecimals:true})} / {fmt(target,{noDecimals:true})}</span>
                          {streak > 0 && <span style={{ fontSize:10.5, color:'#FFB84D', fontWeight:700 }}>🔥 {streak}d streak</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {activeChallenges.length > 0 && (
                <div style={{ display:'flex', gap:10, marginTop:2, padding:'8px 12px', background:'rgba(162,155,254,.06)', borderRadius:10, border:'1px solid rgba(162,155,254,.15)' }}>
                  <span style={{ fontSize:11, color:'var(--text3)', flex:1 }}>
                    <span style={{ fontWeight:700, color:'#A29BFE' }}>{activeChallenges.length}</span> active · {' '}
                    <span style={{ fontWeight:700, color:'#37D67A' }}>{challenges.filter(c=>c.status==='completed').length}</span> completed
                  </span>
                  <button onClick={()=>navigate('/challenges')} style={{ fontSize:11, color:'#A29BFE', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>+ New</button>
                </div>
              )}
            </div>
          </Card>

          {/* Annual Finance Report */}
          <Card title={`Annual Finance Report (${curY})`}
            right={<button className={styles.viewAllBtn} onClick={()=>navigate('/analytics')}>View Full →</button>}>
            <div className={styles.annualGrid}>
              {[
                { label:'Total Income',   value:fmt(annualInc,{noDecimals:true}), color:'var(--green)' },
                { label:'Total Expenses', value:fmt(annualExp,{noDecimals:true}), color:'var(--red)' },
                { label:'Total Savings',  value:fmt(Math.max(0,annualSav),{noDecimals:true}), color:'#6C63FF' },
                { label:'Savings Rate',   value:`${annualRate}%`,                 color:'var(--green)' },
              ].map(({ label, value, color }) => (
                <div key={label} className={styles.annualCell}>
                  <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:4 }}>{label}</div>
                  <div className="mono" style={{ fontSize:16, fontWeight:900, color }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop:'1px solid var(--border-light)', marginTop:12, paddingTop:12 }}>
              <div className={styles.annualGrid}>
                {[
                  { label:'Biggest Expense', value: pieData[0] ? `${pieData[0].name} (${pieData[0].pct}%)` : '—', color:'var(--text)' },
                  { label:'Top Income Month', value: MONTHS[bestMonthIdx] || '—', color:'var(--text)' },
                  { label:'Net Worth', value: nwChartData.length>1 ? fmt(netWorth,{noDecimals:true}) : '—', color: netWorth>=0?'var(--green)':'var(--red)' },
                  { label:'Active Goals', value: `${goalList.length} goals`, color:'var(--text)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={styles.annualCell}>
                    <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:12, fontWeight:700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ══ Quick Actions (mobile only) ══ */}
        <div className={styles.quickActions}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Quick Actions</div>
          <div className={styles.quickActionsRow}>
            {[
              { icon:'➕', label:'Add Txn',    color:'rgba(108,99,255,.15)', action:()=>navigate('/transactions') },
              { icon:'🎯', label:'Goals',       color:'rgba(55,214,122,.15)', action:()=>navigate('/goals') },
              { icon:'📊', label:'Budget',      color:'rgba(91,140,255,.15)', action:()=>navigate('/budget') },
              { icon:'📈', label:'Investments', color:'rgba(55,214,122,.15)', action:()=>navigate('/investments') },
              { icon:'🏆', label:'Challenges',  color:'rgba(162,155,254,.15)',action:()=>navigate('/challenges') },
              { icon:'⚖️', label:'Debt Plan',   color:'rgba(255,184,77,.15)', action:()=>navigate('/debt-reduction') },
            ].map(({ icon, label, color, action }) => (
              <button key={label} className={styles.quickActionBtn} onClick={action}>
                <div className={styles.quickActionIcon} style={{ background:color }}>
                  <span style={{ fontSize:22 }}>{icon}</span>
                </div>
                <span className={styles.quickActionLabel}>{label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
