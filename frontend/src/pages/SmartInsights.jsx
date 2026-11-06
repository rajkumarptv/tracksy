import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { transactionsAPI, budgetsAPI, walletsAPI, insightsAPI } from '../services/api';
import { track } from '../lib/analytics';
import { PageLoader, Topbar } from '../components/ui';
import { useFmt, useT } from '../i18n';
import {
  TrendingUp, TrendingDown, AlertTriangle, Lightbulb,
  Zap, Target, BarChart2, ArrowUpRight, ArrowDownRight,
  Award, Coffee, ShoppingBag, Repeat, PiggyBank, Flame,
  CheckCircle, XCircle, Info
} from 'lucide-react';

/* ─────────────────────────── helpers ─────────────────────────── */
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function startOf(date, unit) {
  const d = new Date(date);
  if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0); }
  return d;
}

function fmt2(n) {
  if (n >= 1_00_00_000) return `₹${(n/1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `₹${(n/1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n/1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

function pctChange(curr, prev) {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

/* ─────────────────────────── InsightCard ──────────────────────── */
function InsightCard({ icon: Icon, color, bg, title, children, badge, priority }) {
  const borderColor = priority === 'high' ? '#DC2626' : priority === 'medium' ? '#D97706' : 'var(--border-light)';
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1.5px solid ${borderColor}`,
      borderRadius:14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      boxShadow: priority === 'high' ? '0 4px 20px rgba(220,38,38,.08)' : '0 2px 12px rgba(0,0,0,.04)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:14, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={20} color={color} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)', lineHeight:1.3 }}>{title}</div>
            {badge && (
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:14,
                background: priority==='high'?'rgba(220,38,38,.12)':priority==='medium'?'rgba(217,119,6,.12)':'rgba(29,78,216,.12)',
                color: priority==='high'?'#DC2626':priority==='medium'?'#D97706':'#1D4ED8' }}>
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{children}</div>
    </div>
  );
}

/* ─────────────────────────── SpendBar ─────────────────────────── */
function SpendBar({ label, amount, max, color, emoji, pct: pctOverride }) {
  const pct = pctOverride ?? Math.min(100, Math.round((amount / max) * 100));
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {emoji && <span style={{ fontSize:15 }}>{emoji}</span>}
          <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{label}</span>
        </div>
        <span style={{ fontSize:12.5, fontWeight:700, color }}>{fmt2(amount)}</span>
      </div>
      <div style={{ height:7, background:'var(--surface2)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:14, transition:'width .6s ease' }}/>
      </div>
    </div>
  );
}

/* ─────────────────────────── MonthTrend ───────────────────────── */
function MonthTrend({ data, color, type }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:48 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <div style={{
            width:'100%', borderRadius:4,
            height: `${Math.max(4, Math.round((d.value / max) * 44))}px`,
            background: i === data.length-1 ? color : `${color}55`,
            transition: 'height .4s ease',
          }}/>
          <span style={{ fontSize:8.5, color:'var(--text3)', whiteSpace:'nowrap' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Main Page ─────────────────────────── */
export default function SmartInsights({ embedded = false }) {
  const fmt = useFmt();
  const [activeTab, setActiveTab] = useState('overview'); // overview | spending | trends | tips

  const { data: txRaw, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', 'all-insights'],
    queryFn: () => transactionsAPI.getAll({ limit: 500 }).then(r => r.data?.data || []),
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsAPI.getAll().then(r => r.data?.data || []),
  });
  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsAPI.getAll().then(r => r.data?.data || []),
  });
  // Server-side analysis over six months of history: highlights, anomalies, recurring charges
  const { data: smart } = useQuery({
    queryKey: ['smart-insights'],
    queryFn: () => insightsAPI.smart().then(r => r.data?.data),
    staleTime: 5 * 60 * 1000,
  });

  const insights = useMemo(() => {
    const txs = txRaw || [];
    if (!txs.length) return null;

    const now = new Date();
    const thisMonthStart = startOf(now, 'month');
    const lastMonthStart = new Date(thisMonthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    // Compare like with like: this month so far vs the same number of days of last month.
    const lastMonthDays  = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth(), 0).getDate();
    const lastMonthEnd   = new Date(lastMonthStart); lastMonthEnd.setDate(Math.min(now.getDate(), lastMonthDays)); lastMonthEnd.setHours(23, 59, 59, 999);

    const thisTxs = txs.filter(t => new Date(t.transaction_date) >= thisMonthStart && t.type !== 'transfer');
    const lastTxs = txs.filter(t => {
      const d = new Date(t.transaction_date);
      return d >= lastMonthStart && d <= lastMonthEnd && t.type !== 'transfer';
    });

    const sum = (arr, type) => arr.filter(t => t.type === type).reduce((s, t) => s + parseFloat(t.amount||0), 0);

    const thisIncome  = sum(thisTxs, 'income');
    const thisExpense = sum(thisTxs, 'expense');
    const lastIncome  = sum(lastTxs, 'income');
    const lastExpense = sum(lastTxs, 'expense');
    const savings     = thisIncome - thisExpense;
    const savingsRate = thisIncome > 0 ? Math.round((savings / thisIncome) * 100) : 0;

    // Category breakdown this month
    const catSpend = {};
    const catEmoji = {};
    thisTxs.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category_name || 'Other';
      catSpend[cat] = (catSpend[cat] || 0) + parseFloat(t.amount||0);
      catEmoji[cat] = t.category_emoji || '📦';
    });
    const topCats = Object.entries(catSpend).sort((a,b) => b[1]-a[1]).slice(0, 6);

    // Detect unusual spends (2x above 3-month avg for that category)
    const threeMonthsAgo = new Date(thisMonthStart); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const historicTxs = txs.filter(t => new Date(t.transaction_date) >= threeMonthsAgo && new Date(t.transaction_date) < thisMonthStart && t.type === 'expense');
    const histCatSpend = {};
    historicTxs.forEach(t => {
      const cat = t.category_name || 'Other';
      histCatSpend[cat] = (histCatSpend[cat] || 0) + parseFloat(t.amount||0);
    });
    const unusualSpends = topCats.filter(([cat, amt]) => {
      const avg = (histCatSpend[cat] || 0) / 3;
      return avg > 0 && amt > avg * 1.5;
    }).map(([cat, amt]) => {
      const avg = histCatSpend[cat] / 3;
      return { cat, amt, avg, pct: Math.round(((amt - avg) / avg) * 100) };
    });

    // Recurring detect: same merchant appearing 3+ times in last 90 days
    const merchantCount = {};
    txs.filter(t => new Date(t.transaction_date) >= threeMonthsAgo && t.type === 'expense').forEach(t => {
      const name = (t.payment_name || '').trim().toLowerCase();
      if (name.length > 2) merchantCount[name] = (merchantCount[name]||0) + 1;
    });
    const recurringMerchants = Object.entries(merchantCount)
      .filter(([,c]) => c >= 3)
      .map(([name]) => {
        const merchantTxs = txs.filter(t => (t.payment_name||'').trim().toLowerCase() === name && t.type==='expense');
        const total = merchantTxs.reduce((s,t) => s+parseFloat(t.amount||0), 0);
        return { name, count: merchantCount[name], total, avg: total / merchantCount[name] };
      })
      .sort((a,b) => b.total - a.total)
      .slice(0, 5);

    // 6-month trend
    const monthTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const mTxs = txs.filter(t => {
        const td = new Date(t.transaction_date);
        return td >= d && td <= end && t.type !== 'transfer';
      });
      return {
        label: months[d.getMonth()],
        income:  sum(mTxs, 'income'),
        expense: sum(mTxs, 'expense'),
        savings: sum(mTxs, 'income') - sum(mTxs, 'expense'),
      };
    });

    // Budget health
    const budgetHealth = budgets.map(b => {
      const spent = thisTxs.filter(t => t.type==='expense' && t.category_id === b.category_id)
        .reduce((s,t) => s+parseFloat(t.amount||0), 0);
      return { ...b, spent, pct: b.amount > 0 ? Math.round((spent/b.amount)*100) : 0 };
    }).sort((a,b) => b.pct - a.pct);

    // Day of week spending pattern
    const daySpend = [0,0,0,0,0,0,0];
    thisTxs.filter(t=>t.type==='expense').forEach(t => {
      const day = new Date(t.transaction_date).getDay();
      daySpend[day] += parseFloat(t.amount||0);
    });
    const peakDay = Math.max(...daySpend) > 0
      ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][daySpend.indexOf(Math.max(...daySpend))]
      : null;

    // Tips
    const tips = [];
    if (savingsRate < 20) tips.push({ icon: PiggyBank, color:'#1D4ED8', bg:'rgba(29,78,216,.1)', text: `Your savings rate is ${savingsRate}%. Aim for 20%+ by trimming your top spending category: ${topCats[0]?.[0] || 'expenses'}.` });
    if (unusualSpends.length) tips.push({ icon: AlertTriangle, color:'#D97706', bg:'rgba(217,119,6,.1)', text: `Unusual spend detected in ${unusualSpends[0].cat} — ${unusualSpends[0].pct}% above your 3-month average. Review if needed.` });
    if (recurringMerchants.length > 3) tips.push({ icon: Repeat, color:'#DC2626', bg:'rgba(220,38,38,.1)', text: `You have ${recurringMerchants.length} recurring payments totalling ${fmt2(recurringMerchants.reduce((s,m)=>s+m.avg,0))}/mo. Audit subscriptions you no longer use.` });
    if (savingsRate >= 30) tips.push({ icon: Award, color:'#047857', bg:'rgba(4,120,87,.1)', text: `Excellent! ${savingsRate}% savings rate this month. Consider moving the surplus into your investment or goal accounts.` });

    return {
      thisIncome, thisExpense, lastIncome, lastExpense,
      savings, savingsRate,
      incomePct: pctChange(thisIncome, lastIncome),
      expensePct: pctChange(thisExpense, lastExpense),
      topCats, catEmoji,
      unusualSpends, recurringMerchants,
      monthTrend, budgetHealth,
      peakDay, tips,
      txCount: thisTxs.length,
      avgTxSize: thisTxs.filter(t=>t.type==='expense').length
        ? thisExpense / thisTxs.filter(t=>t.type==='expense').length
        : 0,
    };
  }, [txRaw, budgets]);

  if (txLoading) return <PageLoader />;

  const TABS = [
    { key:'overview',  label:'Overview',  icon: BarChart2 },
    { key:'spending',  label:'Spending',  icon: ShoppingBag },
    { key:'trends',    label:'Trends',    icon: TrendingUp },
    { key:'subs',      label:'Recurring', icon: Repeat },
    { key:'tips',      label:'Tips',      icon: Lightbulb },
  ];

  const anomalyCount = smart ? smart.anomalies.categorySpikes.length + smart.anomalies.outliers.length + smart.anomalies.duplicates.length : 0;

  const noData = !insights;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Mobile header */}
      {!embedded && <div className="mob-header">
        <div>
          <div className="mob-header-title">Smart Insights</div>
          <div className="mob-header-sub">AI-powered analysis of your finances</div>
        </div>
      </div>}

      {/* Desktop topbar */}
      {!embedded && <div className="mob-hide">
        <Topbar title="Smart Insights" subtitle="AI-powered analysis of your finances" />
      </div>}

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Tab bar */}
        <div style={{ display:'flex', gap:8, background:'var(--surface2)', borderRadius:16, padding:4, overflowX:'auto', scrollbarWidth:'none' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setActiveTab(key); track('insights_tab_viewed', { ui_tab: key }); }}
              style={{
                flex:'1 0 auto', whiteSpace:'nowrap', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                padding:'9px 12px', minHeight:40, borderRadius:12, border:'none', cursor:'pointer',
                fontWeight: activeTab===key ? 700 : 500,
                fontSize: 12.5,
                background: activeTab===key ? 'var(--surface)' : 'transparent',
                color: activeTab===key ? '#1D4ED8' : 'var(--text3)',
                boxShadow: activeTab===key ? '0 2px 8px rgba(0,0,0,.08)' : 'none',
                transition: 'all .18s',
              }}>
              <Icon size={14} />
              <span className="mob-hide-text">{label}</span>
            </button>
          ))}
        </div>

        {noData ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text3)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:8 }}>No data yet</div>
            <div style={{ fontSize:13 }}>Add some transactions to unlock Smart Insights.</div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* Highlights (rule-based monthly summary) */}
                {smart && smart.headline && (
                  <div style={{ background:'var(--surface)', border:'1.5px solid var(--border-light)', borderRadius:18, padding:'18px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <Zap size={16} color="#8B5CF6" />
                      <div style={{ fontSize:12, fontWeight:800, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em' }}>{smart.monthLabel} at a glance</div>
                    </div>
                    <div style={{ fontSize:15.5, fontWeight:800, color:'var(--text)', lineHeight:1.4 }}>{smart.headline}</div>
                    {smart.bullets.length > 0 && (
                      <ul style={{ margin:'10px 0 0', paddingLeft:18, fontSize:13, color:'var(--text2)', lineHeight:1.65 }}>
                        {smart.bullets.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Score card */}
                <div style={{ background:'#1D4ED8', borderRadius:14, padding:'22px 24px', color:'#fff' }}>
                  <div style={{ fontSize:11, fontWeight:700, opacity:.7, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>Financial Health Score</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:12, marginBottom:16 }}>
                    <div style={{ fontSize:52, fontWeight:900, lineHeight:1 }}>
                      {insights.thisIncome <= 0 ? '—' : Math.min(100, Math.max(0,
                        40 +
                        Math.min(30, insights.savingsRate) +
                        ((smart ? smart.anomalies.categorySpikes.length : insights.unusualSpends.length) === 0 ? 15 : 0) +
                        (insights.budgetHealth.every(b=>b.pct<=100) ? 15 : 0)
                      ))}
                    </div>
                    <div style={{ fontSize:13, opacity:.75, paddingBottom:8 }}>{insights.thisIncome <= 0 ? 'add income to see your score' : '/100'}</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    {[
                      { label:'Income', value: fmt2(insights.thisIncome), sub: insights.incomePct !== null ? `${insights.incomePct > 0 ? '+' : ''}${insights.incomePct}% vs last month` : 'This month', color: insights.incomePct >= 0 ? '#6EE7B7' : '#FF9999' },
                      { label:'Expense', value: fmt2(insights.thisExpense), sub: insights.expensePct !== null ? `${insights.expensePct > 0 ? '+' : ''}${insights.expensePct}% vs last month` : 'This month', color: insights.expensePct <= 0 ? '#6EE7B7' : '#FF9999' },
                      { label:'Savings', value: `${insights.savings < 0 ? '−' : ''}${fmt2(Math.abs(insights.savings))}`, sub: `${insights.savingsRate}% savings rate`, color: insights.savings >= 0 ? '#6EE7B7' : '#FF9999' },
                      { label:'Transactions', value: insights.txCount, sub: `Avg ${fmt2(insights.avgTxSize)}/txn`, color: '#B8B5FF' },
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} style={{ background:'rgba(255,255,255,.1)', borderRadius:14, padding:'12px 14px' }}>
                        <div style={{ fontSize:10, opacity:.7, marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</div>
                        <div style={{ fontSize:18, fontWeight:900, color }}>{value}</div>
                        <div style={{ fontSize:10, opacity:.6, marginTop:2 }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick insights */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap:12 }}>
                  <InsightCard icon={insights.expensePct > 20 ? AlertTriangle : CheckCircle}
                    color={insights.expensePct > 20 ? '#D97706' : '#047857'}
                    bg={insights.expensePct > 20 ? 'rgba(217,119,6,.12)' : 'rgba(4,120,87,.12)'}
                    title="Spending vs Last Month"
                    badge={insights.expensePct === null ? 'New' : insights.expensePct > 0 ? `+${insights.expensePct}%` : `${insights.expensePct}%`}
                    priority={insights.expensePct > 20 ? 'medium' : 'low'}>
                    {insights.expensePct === null
                      ? `No spending last month to compare against yet.`
                      : insights.expensePct > 20
                      ? `Your expenses are ${insights.expensePct}% higher than last month. That's ${fmt2(insights.thisExpense - insights.lastExpense)} more than usual.`
                      : insights.expensePct > 5
                      ? `Your expenses are ${insights.expensePct}% higher than last month (${fmt2(insights.thisExpense - insights.lastExpense)} more).`
                      : insights.expensePct < 0
                      ? `Great job! You spent ${fmt2(insights.lastExpense - insights.thisExpense)} less than last month.`
                      : `Your spending is on par with last month.`}
                  </InsightCard>

                  <InsightCard icon={PiggyBank}
                    color={insights.savingsRate >= 20 ? '#047857' : '#DC2626'}
                    bg={insights.savingsRate >= 20 ? 'rgba(4,120,87,.12)' : 'rgba(220,38,38,.12)'}
                    title="Savings Rate"
                    badge={`${insights.savingsRate}%`}
                    priority={insights.savingsRate < 10 ? 'high' : insights.savingsRate < 20 ? 'medium' : 'low'}>
                    {insights.savingsRate >= 30 ? `Excellent savings rate! You're saving ${fmt2(insights.savings)} this month.`
                     : insights.savingsRate >= 20 ? `Good savings rate. You're saving ${fmt2(insights.savings)} this month.`
                     : insights.thisIncome <= 0 ? `No income recorded this month, so a savings rate can't be calculated yet.`
                     : insights.savingsRate >= 0 ? `Your savings rate is below 20%. Try to reduce spending by ${fmt2(Math.max(0, insights.thisExpense - insights.thisIncome * 0.8))} to reach 20%.`
                     : `You're spending more than you earn this month by ${fmt2(Math.abs(insights.savings))}. Review your expenses.`}
                  </InsightCard>

                  {anomalyCount > 0 && (
                    <InsightCard icon={Flame} color="#DC2626" bg="rgba(220,38,38,.12)"
                      title="Worth a look" badge="Alert" priority="high">
                      {smart.anomalies.categorySpikes.map(u => (
                        <div key={u.category} style={{ marginBottom:4 }}>
                          <strong>{u.category}</strong> — {fmt2(u.amount)} this month vs usual {fmt2(u.average)}/mo ({u.pct}% higher)
                        </div>
                      ))}
                      {smart.anomalies.outliers.map(o => (
                        <div key={o.merchant + o.date} style={{ marginBottom:4 }}>
                          <strong>{o.merchant}</strong> — {fmt2(o.amount)} on {o.date}, much more than the usual {fmt2(o.typical)} for {o.category}
                        </div>
                      ))}
                      {smart.anomalies.duplicates.map(d => (
                        <div key={d.merchant + d.dates[0]} style={{ marginBottom:4 }}>
                          Possible duplicate: <strong>{d.merchant}</strong> {fmt2(d.amount)} on {d.dates.join(' and ')}
                        </div>
                      ))}
                    </InsightCard>
                  )}

                  {insights.peakDay && (
                    <InsightCard icon={Coffee} color="#D97706" bg="rgba(217,119,6,.12)" title="Peak Spending Day">
                      You spend the most on <strong>{insights.peakDay}s</strong>. Consider planning your budget-sensitive shopping on other days.
                    </InsightCard>
                  )}
                </div>
              </div>
            )}

            {/* ── SPENDING ── */}
            {activeTab === 'spending' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* Category breakdown */}
                <div style={{ background:'var(--surface)', border:'1.5px solid var(--border-light)', borderRadius:14, padding:'18px 20px' }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:16 }}>Top Spending Categories</div>
                  {insights.topCats.length === 0
                    ? <div style={{ color:'var(--text3)', fontSize:13 }}>No expense transactions this month.</div>
                    : insights.topCats.map(([cat, amt], i) => (
                      <SpendBar key={cat} label={cat} amount={amt}
                        max={insights.topCats[0][1]}
                        emoji={insights.catEmoji[cat]}
                        color={['#1D4ED8','#DC2626','#D97706','#047857','#3B82F6','#F87171'][i % 6]} />
                    ))}
                </div>

                {/* Budget health */}
                {insights.budgetHealth.length > 0 && (
                  <div style={{ background:'var(--surface)', border:'1.5px solid var(--border-light)', borderRadius:14, padding:'18px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                      <Target size={16} color="#3B82F6" />
                      <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>Budget Health</div>
                    </div>
                    {insights.budgetHealth.map(b => {
                      const over = b.pct > 100;
                      const warn = b.pct > 80;
                      const color = over ? '#DC2626' : warn ? '#D97706' : '#047857';
                      return (
                        <div key={b.id} style={{ marginBottom:14 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                            <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{b.category_name || 'Budget'}</span>
                            <span style={{ fontSize:12, fontWeight:700, color }}>
                              {fmt2(b.spent)} / {fmt2(b.amount)} ({b.pct}%)
                              {over && <span style={{ marginLeft:4 }}>⚠️</span>}
                            </span>
                          </div>
                          <div style={{ height:7, background:'var(--surface2)', borderRadius:14, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${Math.min(100, b.pct)}%`, background:color, borderRadius:14 }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TRENDS ── */}
            {activeTab === 'trends' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* 6-month chart */}
                {['income','expense','savings'].map(type => {
                  const colors = { income:'#047857', expense:'#DC2626', savings:'#1D4ED8' };
                  const labels = { income:'Monthly Income', expense:'Monthly Expense', savings:'Monthly Savings' };
                  const data = insights.monthTrend.map(m => ({ label:m.label, value: Math.max(0, m[type]) }));
                  const total = data.reduce((s,d) => s+d.value, 0);
                  return (
                    <div key={type} style={{ background:'var(--surface)', border:'1.5px solid var(--border-light)', borderRadius:14, padding:'18px 20px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>{labels[type]}</div>
                        <div style={{ fontSize:13, fontWeight:700, color: colors[type] }}>
                          Avg {fmt2(total / insights.monthTrend.length)}/mo
                        </div>
                      </div>
                      <MonthTrend data={data} color={colors[type]} type={type} />
                      <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                        {data.map(d => (
                          <div key={d.label} style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>
                            <span style={{ fontWeight:700, color:'var(--text)' }}>{d.label}</span> {fmt2(d.value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TIPS ── */}
            {/* ── RECURRING CHARGES ── */}
            {activeTab === 'subs' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {!smart || smart.subscriptions.items.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'50px 20px', color:'var(--text3)' }}>
                    <div style={{ fontSize:40, marginBottom:10 }}>🔁</div>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:6 }}>No recurring charges found yet</div>
                    <div style={{ fontSize:13 }}>We look for payments to the same merchant at a steady amount, at least three times.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ background:'linear-gradient(135deg,#1E40AF,#8B5CF6)', borderRadius:20, padding:'20px 22px', color:'#fff' }}>
                      <div style={{ fontSize:11, fontWeight:700, opacity:.75, textTransform:'uppercase', letterSpacing:'.1em' }}>Recurring charges</div>
                      <div style={{ display:'flex', gap:28, marginTop:8, flexWrap:'wrap' }}>
                        <div><div style={{ fontSize:26, fontWeight:900 }}>{fmt2(smart.subscriptions.monthlyTotal)}</div><div style={{ fontSize:11, opacity:.7 }}>per month</div></div>
                        <div><div style={{ fontSize:26, fontWeight:900 }}>{fmt2(smart.subscriptions.annualTotal)}</div><div style={{ fontSize:11, opacity:.7 }}>per year</div></div>
                      </div>
                    </div>
                    <div style={{ background:'var(--surface)', border:'1.5px solid var(--border-light)', borderRadius:14, padding:'6px 20px' }}>
                      {smart.subscriptions.items.map(i => (
                        <div key={i.merchant} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'14px 0', borderBottom:'1px solid var(--border-light)' }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{i.merchant}</div>
                            <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:2 }}>
                              {i.cadence} · {i.charges} charges · last {i.lastDate}
                            </div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                              {i.priceChange && (
                                <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:8,
                                  color: i.priceChange.pct > 0 ? '#DC2626' : '#047857', background: i.priceChange.pct > 0 ? 'rgba(220,38,38,.1)' : 'rgba(4,120,87,.1)' }}>
                                  Price {i.priceChange.pct > 0 ? 'up' : 'down'} {Math.abs(i.priceChange.pct)}% ({fmt2(i.priceChange.from)} to {fmt2(i.priceChange.to)})
                                </span>
                              )}
                              {i.status === 'missing' && (
                                <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:8, color:'#D97706', background:'rgba(217,119,6,.12)' }}>
                                  Not charged since {i.lastDate}. Cancelled?
                                </span>
                              )}
                              {!i.tracked && i.status === 'active' && (
                                <Link to="/recurring" style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:8, color:'#1D4ED8', background:'rgba(29,78,216,.1)', textDecoration:'none' }}>
                                  Not in Recurring · add it
                                </Link>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0, opacity: i.status === 'missing' ? .55 : 1 }}>
                            <div style={{ fontSize:15, fontWeight:800, color:'#DC2626' }}>{fmt2(i.amount)}</div>
                            <div style={{ fontSize:11, color:'var(--text3)' }}>{fmt2(i.annualCost)}/yr</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'tips' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ fontSize:13, color:'var(--text3)', marginBottom:4 }}>
                  Personalised suggestions based on your last 3 months of data.
                </div>

                {insights.tips.length === 0 && (
                  <InsightCard icon={CheckCircle} color="#047857" bg="rgba(4,120,87,.12)" title="All good!" priority="low">
                    Your finances look healthy. Keep up the great work!
                  </InsightCard>
                )}

                {insights.tips.map((tip, i) => (
                  <InsightCard key={i} icon={tip.icon} color={tip.color} bg={tip.bg}
                    title={`Tip ${i+1}`} priority="medium">
                    {tip.text}
                  </InsightCard>
                ))}

                {/* General always-on tips */}
                {[
                  { icon:Zap,      color:'#D97706', bg:'rgba(217,119,6,.1)',   text:'Set up recurring transactions for fixed expenses (rent, EMI, subscriptions) so your expense tracking stays accurate automatically.' },
                  { icon:Target,   color:'#1D4ED8', bg:'rgba(29,78,216,.1)',   text:'Create a Savings Goal for your next big purchase. Even ₹500/week adds up to ₹26,000 a year.' },
                  { icon:BarChart2, color:'#3B82F6', bg:'rgba(59,130,246,.1)', text:'Review your budget categories every month. Adjust limits as your lifestyle changes rather than ignoring overages.' },
                ].map((tip, i) => (
                  <InsightCard key={`gen-${i}`} icon={tip.icon} color={tip.color} bg={tip.bg}
                    title="General Tip" priority="low">
                    {tip.text}
                  </InsightCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
