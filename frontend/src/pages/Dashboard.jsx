import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, CartesianGrid, Legend,
} from 'recharts';
import { Wallet, Target, TrendingUp, FileText, Plus, PieChart as PieIcon, ChevronRight, Eye, ChevronDown, Check, CreditCard, BarChart2, Calendar, ChevronLeft, Flame, TrendingDown } from 'lucide-react';
import { dashboardAPI, walletsAPI, goalsAPI, budgetsAPI, netWorthAPI, transactionsAPI } from '../services/api';
import { PageLoader, AmountText, Topbar } from '../components/ui';
import useAuthStore from '../store/authStore';
import { useFmt, useT } from '../i18n';
import styles from './Dashboard.module.css';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PIE_COLORS = ['#6C63FF','#5B8CFF','#37D67A','#FFB84D','#FF5B5B','#A29BFE','#00CEC9','#636E72'];

const WALLET_GROUPS = { 'Credit Cards':['visa','mastercard'], 'UPI & Wallets':['gpay','phonepe','paytm','amazon_pay','mobikwik','jio_money','airtel_money','paypal'], 'Bank':['bank'], 'Travel':['irctc'], 'Loans':['loan'], 'Assets':['asset','crypto'], 'Lending':['lending'], 'Other':['cash','other'] };

const DEBT_CONFIG = {
  visa:       { icon:'💳', label:'Credit Card', color:'#FF5B5B', bg:'rgba(255,91,91,.1)'   },
  mastercard: { icon:'💳', label:'Credit Card', color:'#FF5B5B', bg:'rgba(255,91,91,.1)'   },
  loan:       { icon:'📋', label:'Loan',        color:'#FFB84D', bg:'rgba(255,184,77,.1)'  },
  lending:    { icon:'🤝', label:'Lending',     color:'#5B8CFF', bg:'rgba(91,140,255,.1)'  },
};
const WALLET_ICONS  = { visa:'💳', mastercard:'💳', paypal:'🅿️', bank:'🏦', cash:'💵', crypto:'₿', other:'👛', loan:'📋', asset:'📈', lending:'🤝', paytm:'🟦', phonepe:'💜', gpay:'🟣', irctc:'🚂', amazon_pay:'🛒', mobikwik:'💙', jio_money:'🔴', airtel_money:'❤️' };

const CAT_COLORS = {
  Food:      { bg:'#e8f9f0', color:'#00a86b' },
  Income:    { bg:'#eef3ff', color:'#5B8CFF' },
  Transport: { bg:'#eef3ff', color:'#5B8CFF' },
  Shopping:  { bg:'#fff8ea', color:'#f5a623' },
  Health:    { bg:'#ffe8f0', color:'#e0457b' },
  Bills:     { bg:'#f0edff', color:'#6C63FF' },
};

function WalletDropdown({ wallets, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const fmt = useFmt();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const grouped = {};
  (wallets || []).forEach(w => {
    const group = Object.entries(WALLET_GROUPS).find(([,t]) => t.includes(w.type))?.[0] || 'Other';
    (grouped[group] = grouped[group] || []).push(w);
  });

  const selected = value ? (wallets || []).find(w => w.id === value) : null;
  const label = selected
    ? `${WALLET_ICONS[selected.type] || '👛'} ${selected.name}${selected.last_four ? ` *${selected.last_four}` : ''}`
    : '🏦 All accounts';

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        className="btn btn-ghost btn-sm"
        style={{ fontSize:12.5, fontWeight:600, display:'flex', alignItems:'center', gap:6, minWidth:170, justifyContent:'space-between' }}>
        <span>{label}</span>
        <ChevronDown size={12} style={{ transition:'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink:0 }}/>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', right:0,
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:16, boxShadow:'0 12px 40px rgba(0,0,0,.16)',
          minWidth:220, zIndex:200, overflow:'hidden',
          animation:'dropdownSlide .18s cubic-bezier(.16,1,.3,1)',
        }}>
          <style>{`@keyframes dropdownSlide{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

          {/* All accounts option */}
          <div onClick={() => { onChange(null); setOpen(false); }}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer', transition:'background .12s',
              background: !value ? 'var(--accent-light)' : 'transparent' }}
            onMouseEnter={e => { if(value) e.currentTarget.style.background='var(--surface2)'; }}
            onMouseLeave={e => { if(value) e.currentTarget.style.background='transparent'; }}>
            <div style={{ width:30, height:30, borderRadius:9, background:'rgba(108,99,255,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🏦</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>All Accounts</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{(wallets||[]).length} accounts</div>
            </div>
            {!value && <Check size={13} color="var(--accent)"/>}
          </div>

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', padding:'8px 14px 4px', textTransform:'uppercase', letterSpacing:'.07em', borderTop:'1px solid var(--border-light)' }}>
                {group}
              </div>
              {items.map(w => (
                <div key={w.id}
                  onClick={() => { onChange(w.id); setOpen(false); }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', cursor:'pointer', transition:'background .12s',
                    background: value === w.id ? 'var(--accent-light)' : 'transparent' }}
                  onMouseEnter={e => { if(value !== w.id) e.currentTarget.style.background='var(--surface2)'; }}
                  onMouseLeave={e => { if(value !== w.id) e.currentTarget.style.background='transparent'; }}>
                  <div style={{ width:30, height:30, borderRadius:9, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                    {WALLET_ICONS[w.type] || '👛'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {w.name}{w.last_four ? ` *${w.last_four}` : ''}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {fmt(w.balance||0)}
                    </div>
                  </div>
                  {value === w.id && <Check size={13} color="var(--accent)"/>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  const fmt = useFmt();
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:12, padding:'10px 14px', fontSize:12,
      boxShadow:'0 8px 24px rgba(0,0,0,.12)',
    }}>
      <div style={{ fontWeight:600, marginBottom:4, color:'var(--text3)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color, fontWeight:700 }}>
          {p.name}: {fmt(p.value||0,{noDecimals:true})}
        </div>
      ))}
    </div>
  );
}

function DonutRing({ pct = 0, size = 64 }) {
  const r = 26; const cx = 32; const cy = 32;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink:0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface3)" strokeWidth="6"/>
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="url(#donutGrad)" strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition:'stroke-dasharray .6s ease' }}
      />
      <defs>
        <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#6C63FF"/>
          <stop offset="100%" stopColor="#5B8CFF"/>
        </linearGradient>
      </defs>
      <text x={cx} y={cy+4} textAnchor="middle" fill="var(--text)"
        fontSize="11" fontWeight="800" fontFamily="Space Grotesk, Inter, sans-serif">{pct}%</text>
    </svg>
  );
}

/* ── Weekly Analysis Component ──────────────────────────────── */
function WeeklyAnalysis() {
  const fmt = useFmt();
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekStart, weekEnd, weekLabel } = useMemo(() => {
    const base = new Date();
    const day  = base.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMon + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    const toISO = d => d.toISOString().split('T')[0];
    const label = `${monday.toLocaleDateString('en-US',{ month:'short', day:'numeric' })} – ${sunday.toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' })}`;
    return { weekStart: toISO(monday), weekEnd: toISO(nextMonday), weekLabel: label };
  }, [weekOffset]);

  const { data: txData, isLoading } = useQuery({
    queryKey: ['weekly-analysis', weekStart, weekEnd],
    queryFn:  () => transactionsAPI.getAll({ start_date: weekStart, end_date: weekEnd, limit: 1000 }).then(r => r.data.data),
  });

  const stats = useMemo(() => {
    const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const buckets = DAY_NAMES.map(name => ({ name, income: 0, expense: 0, txCount: 0 }));
    const catMap = {};
    let biggestTx = null;

    (txData || []).forEach(tx => {
      const d   = new Date(tx.transaction_date);
      const dow = d.getDay();
      const idx = dow === 0 ? 6 : dow - 1;
      const amt = Math.abs(parseFloat(tx.amount || 0));

      if (tx.type === 'income') {
        buckets[idx].income += amt;
      } else {
        buckets[idx].expense += amt;
        const key = tx.category_name || 'Other';
        if (!catMap[key]) catMap[key] = { name: key, emoji: tx.category_emoji || '📌', total: 0 };
        catMap[key].total += amt;
        if (!biggestTx || amt > biggestTx.amt)
          biggestTx = { amt, label: tx.description || tx.payment_name || key, emoji: tx.category_emoji || '📌' };
      }
      buckets[idx].txCount++;
    });

    const totalIncome   = buckets.reduce((s,d) => s + d.income,  0);
    const totalExpense  = buckets.reduce((s,d) => s + d.expense, 0);
    const netSaved      = totalIncome - totalExpense;          // ← signed, not abs
    const avgDailySpend = totalExpense / 7;
    const topDayIdx     = buckets.reduce((mi, d, i, a) => d.expense > a[mi].expense ? i : mi, 0);
    const savingsRate   = totalIncome > 0 ? Math.round((netSaved / totalIncome) * 100) : null;
    const activeDays    = buckets.filter(d => d.expense > 0 || d.income > 0).length;
    const spendFreeDays = buckets.filter(d => d.expense === 0).length;
    const topCategories = Object.values(catMap).sort((a,b) => b.total - a.total).slice(0, 5);
    const txCount       = (txData || []).length;

    return { buckets, totalIncome, totalExpense, netSaved, avgDailySpend, topDayIdx, savingsRate, activeDays, spendFreeDays, topCategories, biggestTx, txCount };
  }, [txData]);

  const { buckets: dayData, totalIncome, totalExpense, netSaved, avgDailySpend, topDayIdx, savingsRate, activeDays, spendFreeDays, topCategories, biggestTx, txCount } = stats;

  const isCurrentWeek = weekOffset === 0;

  const weekNav = (
    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
      <button onClick={() => setWeekOffset(o => o - 1)} className="btn btn-ghost btn-sm"
        style={{ width:26, height:26, padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <ChevronLeft size={13}/>
      </button>
      <span style={{ fontSize:11, fontWeight:600, color:'var(--text2)', whiteSpace:'nowrap', textAlign:'center' }}>
        {weekLabel}
      </span>
      <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))} disabled={isCurrentWeek}
        className="btn btn-ghost btn-sm"
        style={{ width:26, height:26, padding:0, display:'flex', alignItems:'center', justifyContent:'center', opacity: isCurrentWeek ? .3 : 1 }}>
        <ChevronRight size={13}/>
      </button>
    </div>
  );

  /* ── Net saved colour & label ── */
  const netColor  = netSaved > 0 ? 'var(--green)' : netSaved < 0 ? 'var(--red)' : 'var(--text3)';
  const netPrefix = netSaved > 0 ? '+' : netSaved < 0 ? '−' : '';
  const netLabel  = netSaved >= 0 ? 'Net Saved' : 'Over Budget';

  return (
    <div className={styles.weeklyGrid} style={{ display:'grid', gridTemplateColumns:'1.55fr 1fr 1fr', gap:16 }}>

      {/* ══ COL 1: Daily bar chart ══ */}
      <div className="card" style={{ display:'flex', flexDirection:'column' }}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle} style={{ display:'flex', alignItems:'center', gap:7 }}>
              <Flame size={15} color="#FF5B5B" style={{ flexShrink:0 }}/> Weekly Analysis
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Day-by-day income &amp; spending</div>
          </div>
          {weekNav}
        </div>

        {/* Day activity mini-heatmap */}
        <div style={{ display:'flex', gap:5, marginBottom:14 }}>
          {dayData.map((d, i) => {
            const hasExp = d.expense > 0, hasInc = d.income > 0;
            const bg = hasExp && hasInc ? 'linear-gradient(135deg,#37D67A,#6C63FF)'
                     : hasExp ? '#6C63FF' : hasInc ? '#37D67A' : 'var(--surface2)';
            return (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div title={`${d.name}: ${hasExp ? '−'+fmt(d.expense,{noDecimals:true}) : hasInc ? '+'+fmt(d.income,{noDecimals:true}) : 'No activity'}`}
                  style={{ width:'100%', height:22, borderRadius:7, background: bg,
                    border: (!hasExp&&!hasInc) ? '1.5px solid var(--border)' : 'none',
                    opacity: (!hasExp&&!hasInc) ? .45 : 1, cursor:'default' }}/>
                <span style={{ fontSize:9, color:'var(--text3)', fontWeight:600 }}>{d.name.slice(0,2)}</span>
              </div>
            );
          })}
        </div>

        {/* Bar chart */}
        {isLoading ? (
          <div style={{ flex:1, height:155, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13 }}>Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={155}>
            <BarChart data={dayData} margin={{ top:4, right:4, left:-24, bottom:0 }} barSize={10} barGap={3}>
              <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
              <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
              <Tooltip content={<ChartTooltip />}/>
              <Bar dataKey="income"  name="Income"  fill="#37D67A" radius={[4,4,0,0]}/>
              <Bar dataKey="expense" name="Expense" fill="#6C63FF" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend + peak */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10, gap:8, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:12 }}>
            {[{ color:'#37D67A', label:'Income' },{ color:'#6C63FF', label:'Expense' }].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:l.color }}/>
                <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>{l.label}</span>
              </div>
            ))}
          </div>
          {totalExpense > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(255,91,91,.07)', borderRadius:9, padding:'4px 9px', border:'1px solid rgba(255,91,91,.13)' }}>
              <TrendingDown size={11} color="#FF5B5B"/>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>Peak: <strong>{dayData[topDayIdx]?.name}</strong></span>
              <span style={{ fontSize:11, color:'var(--red)', fontWeight:700 }}>{fmt(dayData[topDayIdx]?.expense||0,{noDecimals:true})}</span>
            </div>
          )}
        </div>
      </div>

      {/* ══ COL 2: Key stats ══ */}
      <div className="card" style={{ display:'flex', flexDirection:'column', gap:0 }}>
        <div className={styles.cardHeader} style={{ marginBottom:14 }}>
          <div>
            <div className={styles.cardTitle}>Weekly Stats</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Summary &amp; comparisons</div>
          </div>
          {/* Savings rate ring */}
          {savingsRate !== null ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', background: savingsRate > 0 ? 'rgba(55,214,122,.1)' : 'rgba(255,91,91,.08)', borderRadius:12, padding:'6px 11px' }}>
              <span className="mono" style={{ fontSize:17, fontWeight:900, lineHeight:1, color: savingsRate > 0 ? 'var(--green)' : 'var(--red)' }}>{Math.abs(savingsRate)}%</span>
              <span style={{ fontSize:9.5, color:'var(--text3)', fontWeight:600, marginTop:2 }}>{savingsRate > 0 ? 'saved' : 'deficit'}</span>
            </div>
          ) : (
            <div style={{ background:'var(--surface2)', borderRadius:12, padding:'6px 11px', textAlign:'center' }}>
              <span className="mono" style={{ fontSize:17, fontWeight:900, color:'var(--text)' }}>{activeDays}</span>
              <div style={{ fontSize:9.5, color:'var(--text3)', fontWeight:600 }}>active days</div>
            </div>
          )}
        </div>

        {/* 4 stat rows — proper sign on net saved */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1 }}>
          {[
            { label:'Total Income',    val: totalIncome,   color:'var(--green)', icon:'↑', prefix:'+' },
            { label:'Total Expense',   val: totalExpense,  color:'var(--red)',   icon:'↓', prefix:'−' },
            { label: netLabel,         val: Math.abs(netSaved), color: netColor, icon: netSaved >= 0 ? '✓' : '!', prefix: netPrefix },
            { label:'Avg Daily Spend', val: avgDailySpend, color:'#FFB84D',      icon:'≈', prefix:'' },
          ].map(({ label, val, color, icon, prefix }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 11px', background:'var(--surface2)', borderRadius:12 }}>
              <div style={{ width:30, height:30, borderRadius:9, background:`${color}1a`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, fontWeight:800, color }}>
                {icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
                <div className="mono" style={{ fontSize:14, fontWeight:800, color, marginTop:1 }}>{prefix}{fmt(val,{noDecimals:true})}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tx count + spend-free days */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }}>
          {[
            { val: txCount,       label:'Transactions', icon:'🧾' },
            { val: spendFreeDays, label:'Spend-free days', icon:'🌱' },
          ].map(({ val, label, icon }) => (
            <div key={label} style={{ background:'var(--surface2)', borderRadius:12, padding:'9px 10px', textAlign:'center' }}>
              <div style={{ fontSize:16 }}>{icon}</div>
              <div className="mono" style={{ fontSize:15, fontWeight:800, color:'var(--text)', margin:'3px 0 1px' }}>{val}</div>
              <div style={{ fontSize:10, color:'var(--text3)', fontWeight:500 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ COL 3: Top categories + biggest tx ══ */}
      <div className="card" style={{ display:'flex', flexDirection:'column' }}>
        <div className={styles.cardHeader} style={{ marginBottom:14 }}>
          <div>
            <div className={styles.cardTitle}>Top Categories</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Where money went</div>
          </div>
          <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>This week</span>
        </div>

        {topCategories.length === 0 ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13, gap:6 }}>
            <span style={{ fontSize:28 }}>🎉</span>
            No expenses this week!
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10, flex:1 }}>
            {topCategories.map((cat, i) => {
              const pct = totalExpense > 0 ? Math.round((cat.total / totalExpense) * 100) : 0;
              const COLS = ['#6C63FF','#5B8CFF','#FFB84D','#37D67A','#A29BFE'];
              const col  = COLS[i % COLS.length];
              return (
                <div key={cat.name}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:15, flexShrink:0 }}>{cat.emoji}</span>
                    <span style={{ flex:1, fontSize:12, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.name}</span>
                    <span className="mono" style={{ fontSize:12, fontWeight:800, color:'var(--text)', flexShrink:0 }}>{fmt(cat.total,{noDecimals:true})}</span>
                    <span style={{ fontSize:10.5, color:'var(--text3)', fontWeight:700, width:30, textAlign:'right', flexShrink:0 }}>{pct}%</span>
                  </div>
                  <div style={{ height:5, background:'var(--surface2)', borderRadius:20, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:col, borderRadius:20, transition:'width .6s cubic-bezier(.4,0,.2,1)' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Biggest single transaction */}
        {biggestTx && (
          <div style={{ marginTop:14, padding:'10px 12px', background:'linear-gradient(135deg,rgba(108,99,255,.07),rgba(91,140,255,.05))', borderRadius:12, border:'1px solid rgba(108,99,255,.12)' }}>
            <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>🔥 Biggest Spend</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>{biggestTx.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{biggestTx.label}</div>
              </div>
              <div className="mono" style={{ fontSize:14, fontWeight:900, color:'var(--red)', flexShrink:0 }}>−{fmt(biggestTx.amt,{noDecimals:true})}</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

/* ── Date filter helpers ─────────────────────────────────────── */
const now = new Date();
function isoDate(d) { return d.toISOString().split('T')[0]; }
// FILTER_OPTS labels are resolved at render time via t() in the component
const FILTER_OPT_KEYS = [
  { id:'this_month',  key:'dash_this_month' },
  { id:'last_month',  key:'dash_last_month' },
  { id:'custom',      key:'dash_custom'     },
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const fmt = useFmt();
  const t = useT();
  const [walletId,    setWalletId]    = useState(null);
  const [filterMode,  setFilterMode]  = useState('this_month');
  const [customStart, setCustomStart] = useState(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customEnd,   setCustomEnd]   = useState(isoDate(now));
  const [showCustom,  setShowCustom]  = useState(false);

  /* ── PWA Install Prompt ── */
  const [installPrompt,     setInstallPrompt]     = useState(null);
  const [installDismissed,  setInstallDismissed]  = useState(() => localStorage.getItem('pwa_dismissed') === '1');
  const [installState,      setInstallState]      = useState('idle'); // 'idle' | 'installing' | 'done'

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    // If already installed, don't show banner
    window.addEventListener('appinstalled', () => { setInstallPrompt(null); setInstallState('done'); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    setInstallState('installing');
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setInstallState('done'); setInstallPrompt(null); }
    else { setInstallState('idle'); }
  };

  const handleDismiss = () => {
    setInstallDismissed(true);
    localStorage.setItem('pwa_dismissed', '1');
  };

  const showInstallBanner = installPrompt && !installDismissed && installState !== 'done';

  /* Derive query params from filter mode */
  const { qMonth, qYear, qStart, qEnd, periodLabel } = useMemo(() => {
    if (filterMode === 'this_month') {
      const y = now.getFullYear(), m = now.getMonth() + 1;
      return { qMonth:m, qYear:y, qStart:null, qEnd:null,
        periodLabel:`${MONTHS[now.getMonth()]} ${now.getFullYear()}` };
    }
    if (filterMode === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { qMonth:m, qYear:y, qStart:null, qEnd:null,
        periodLabel:`${MONTHS[d.getMonth()]} ${y}` };
    }
    // custom
    return { qMonth:null, qYear:null, qStart:customStart, qEnd:customEnd,
      periodLabel: customStart && customEnd ? `${customStart} → ${customEnd}` : 'Pick dates' };
  }, [filterMode, customStart, customEnd]);

  const baseParams = {
    ...(qMonth ? { month:qMonth, year:qYear } : {}),
    ...(qStart  ? { start_date:qStart, end_date:qEnd } : {}),
    ...(walletId ? { wallet_id:walletId } : {}),
  };

  // Income/Expense breakdown modal: null | 'income' | 'expense'
  const [breakdown, setBreakdown] = useState(null);
  // Convert the active period into start/end dates for the transactions list endpoint
  const breakdownRange = useMemo(() => {
    if (qStart && qEnd) return { start_date: qStart, end_date: qEnd };
    if (qMonth && qYear) {
      const sd = `${qYear}-${String(qMonth).padStart(2,'0')}-01`;
      const ed = qMonth === 12 ? `${qYear+1}-01-01` : `${qYear}-${String(qMonth+1).padStart(2,'0')}-01`;
      return { start_date: sd, end_date: ed };
    }
    return {};
  }, [qMonth, qYear, qStart, qEnd]);

  const { data: wallets } = useQuery({ queryKey:['wallets'], queryFn:() => walletsAPI.getAll().then(r=>r.data.data) });
  const { data: goals   } = useQuery({ queryKey:['goals'],   queryFn:() => goalsAPI.getAll().then(r=>r.data.data) });
  const { data: budgets } = useQuery({ queryKey:['budgets'],  queryFn:() => budgetsAPI.getAll().then(r=>r.data.data) });
  const { data: netWorthHistory } = useQuery({ queryKey:['net-worth-history'], queryFn:() => netWorthAPI.history().then(r=>r.data.data) });
  const { data: catBreakdown } = useQuery({
    queryKey: ['category-breakdown-dash', qYear || now.getFullYear(), qMonth],
    queryFn:  () => dashboardAPI.categoryBreakdown({ year: qYear || now.getFullYear(), ...(qMonth ? { month: qMonth } : {}) }).then(r => r.data.data),
  });

  const summary = useQuery({
    queryKey: ['dashboard-summary', baseParams],
    queryFn:  () => dashboardAPI.summary(baseParams).then(r=>r.data.data),
  });

  /* Auto-switch to last month if current month has zero income AND zero expense */
  const [autoSwitched, setAutoSwitched] = useState(false);
  useEffect(() => {
    if (
      !autoSwitched &&
      filterMode === 'this_month' &&
      summary.data &&
      parseFloat(summary.data.income  || 0) === 0 &&
      parseFloat(summary.data.expense || 0) === 0
    ) {
      setFilterMode('last_month');
      setAutoSwitched(true);
    }
  }, [summary.data, filterMode, autoSwitched]);

  const moneyFlow = useQuery({
    queryKey: ['money-flow', qYear || now.getFullYear(), walletId],
    queryFn:  () => dashboardAPI.moneyFlow({ year: qYear || now.getFullYear(), ...(walletId && { wallet_id:walletId }) }).then(r=>r.data.data),
  });
  const recentTx = useQuery({
    queryKey: ['recent-transactions', baseParams],
    queryFn:  () => dashboardAPI.recentTransactions({ limit:8, ...baseParams }).then(r=>r.data.data),
  });

  if (summary.isLoading) return <PageLoader />;

  const d = summary.data || {};
  const flowData = (moneyFlow.data || []).map((m,i) => ({ name:MONTHS[i], income:m.income, expense:m.expense }));
  const selectedWallet = wallets?.find(w => w.id === walletId);

  const totalBudget = (budgets||[]).reduce((s,b) => s + parseFloat(b.amount||0), 0);
  const totalSpent  = (budgets||[]).reduce((s,b) => s + parseFloat(b.spent||0),  0);
  const budgetLeft  = Math.max(0, totalBudget - totalSpent);
  const budgetPct   = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const debtWallets = (wallets||[]).filter(w => ['loan','visa','mastercard','lending'].includes(w.type));
  const totalDebt   = debtWallets.reduce((s,w) => s + Math.abs(parseFloat(w.balance||0)), 0);
  const monthlyIncome = parseFloat(d.income || 0);
  const debtPct = monthlyIncome > 0 ? Math.min(100, Math.round((totalDebt / (monthlyIncome * 12)) * 100)) : 0;

  const pieRaw  = (catBreakdown || []).filter(c => c.value > 0);
  const pieTotalExp = pieRaw.reduce((s,p) => s + p.value, 0);
  const pieData = pieRaw.map(c => ({
    ...c,
    pct: pieTotalExp > 0 ? Math.round((c.value / pieTotalExp) * 100) : 0,
  }));
  const incomeChange = parseFloat(d.income_change || 0);

  return (
    <div className={styles.page}>
      <Topbar
        subtitle={selectedWallet
          ? `Viewing: ${selectedWallet.name}${selectedWallet.last_four ? ` *${selectedWallet.last_four}`:''}`
          : undefined}>
        <WalletDropdown wallets={wallets} value={walletId} onChange={setWalletId} />
      </Topbar>

      {/* ── Date Filter Bar ── */}
      <div className={styles.filterBar}>
        <Calendar size={14} color="var(--text3)" style={{ flexShrink:0 }}/>
        <div className={styles.filterPills}>
          {FILTER_OPT_KEYS.map(({ id, key }) => (
            <button key={id}
              className={`${styles.filterPill} ${filterMode === id ? styles.filterPillActive : ''}`}
              onClick={() => { setFilterMode(id); if(id==='custom') setShowCustom(true); }}>
              {t(key)}
            </button>
          ))}
        </div>

        {filterMode === 'custom' && (
          <div className={styles.filterCustom}>
            <input type="date" value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className={styles.filterDateInput}/>
            <span className={styles.filterDateSep}>→</span>
            <input type="date" value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className={styles.filterDateInput}/>
          </div>
        )}

        <span className={styles.filterLabel}>
          <Calendar size={11}/> {periodLabel}
        </span>
      </div>

      {/* ── PWA Install Banner ── */}
      {showInstallBanner && (
        <div style={{
          margin:'12px 24px 0', borderRadius:16,
          background:'linear-gradient(135deg, rgba(108,99,255,.15), rgba(91,140,255,.1))',
          border:'1px solid rgba(108,99,255,.25)',
          padding:'12px 16px', display:'flex', alignItems:'center', gap:12,
          animation:'fadeSlideDown .3s cubic-bezier(.16,1,.3,1)',
        }}>
          <style>{`@keyframes fadeSlideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 12px rgba(108,99,255,.4)' }}>
            <img src="/icons/icon.svg" alt="Tracksy" style={{ width:26, height:26 }}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)', lineHeight:1.3 }}>Install Tracksy</div>
            <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:2 }}>Add to home screen for quick access</div>
          </div>
          <button
            onClick={handleInstall}
            disabled={installState === 'installing'}
            style={{
              padding:'7px 16px', borderRadius:10, fontSize:12.5, fontWeight:700, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', color:'#fff',
              boxShadow:'0 3px 10px rgba(108,99,255,.4)', flexShrink:0,
              opacity: installState === 'installing' ? .7 : 1,
            }}>
            {installState === 'installing' ? '...' : 'Install'}
          </button>
          <button onClick={handleDismiss} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:18, lineHeight:1, padding:'4px', flexShrink:0 }}>×</button>
        </div>
      )}

      <div className={`${styles.content} fade-in`}>

        {/* ══ HERO — 3-column grid ══ */}
        <div className={styles.heroGrid}>

          {/* Col 1: text + CTA */}
          <div className={styles.heroLeft}>
            <div className={styles.heroGreeting} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span>👋 {t('dash_welcome')}, {user?.first_name || 'there'}!</span>
              {user?.is_premium
                ? <span style={{ fontSize:11, background:'rgba(255,184,77,.2)', border:'1px solid rgba(255,184,77,.4)', borderRadius:20, padding:'2px 10px', fontWeight:700, color:'#FFB84D' }}>✨ Premium</span>
                : <span onClick={() => navigate('/settings')} style={{ fontSize:11, background:'var(--accent-light)', borderRadius:20, padding:'2px 10px', fontWeight:700, color:'var(--accent)', cursor:'pointer' }}>Free Plan · Upgrade</span>
              }
            </div>
            <h1 className={styles.heroTitle}>
              {t('dash_hero_title1')}<br/>
              <span className={styles.heroTitleAccent}>{t('dash_hero_title2')}</span> {t('dash_hero_title3')}
            </h1>
            <p className={styles.heroSub}>
              {t('dash_hero_sub')}
            </p>
            <div className={styles.heroBtns}>
              <button className={styles.heroBtnPrimary} onClick={() => navigate('/transactions')}>
                <Plus size={15}/> {t('dash_add_tx')}
              </button>
              <button className={styles.heroBtnSecondary} onClick={() => navigate('/budget')}>
                <PieIcon size={15}/> {t('dash_goto_budget')}
              </button>
            </div>
          </div>

          {/* Col 2: 3D wallet illustration */}
          <div className={styles.heroCenter}>
            <img
              src="/wallet-hero.png"
              alt=""
              className={styles.heroIllustration}
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>

          {/* Col 3: Overview + Budget cards */}
          <div className={styles.heroRight}>

            {/* Your Overview */}
            <div className={styles.overviewCard}>
              <div className={styles.overviewCardHeader}>
                <span className={styles.overviewCardTitle}>{t('dash_overview')}</span>
                <span style={{ fontSize:10.5, color:'var(--accent)', fontWeight:700, background:'var(--accent-light)', borderRadius:8, padding:'2px 8px', display:'flex', alignItems:'center', gap:4 }}>
                  <Calendar size={10}/> {periodLabel}
                </span>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', fontWeight:500, marginBottom:6 }}>{t('dash_net_worth')}</div>
              <div className={styles.overviewBalance}>
                {fmt(d.total_balance||0)}
              </div>
              <div className={styles.overviewBadge} style={{ whiteSpace:'nowrap' }}>
                {incomeChange >= 0 ? '↑' : '↓'} {Math.abs(incomeChange).toFixed(1)}%
                <span style={{ color:'#6b7280', fontWeight:400, marginLeft:3 }}>vs last month</span>
              </div>
              <div className={styles.overviewRow}>
                {/* Income — click for breakdown */}
                <div onClick={() => setBreakdown('income')} title="View income transactions"
                  style={{ display:'flex', alignItems:'center', gap:10, flex:1, cursor:'pointer', borderRadius:10, padding:'4px', margin:'-4px', transition:'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(55,214,122,.06)'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <div style={{
                    width:38, height:38, borderRadius:11, flexShrink:0,
                    background:'rgba(55,214,122,.12)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <img src="/income.png" alt="income" style={{ width:22, height:22, objectFit:'contain' }}/>
                  </div>
                  <div>
                    <div className={styles.overviewColLabel} style={{ display:'flex', alignItems:'center', gap:3 }}>{t('dash_income')} <ChevronRight size={11}/></div>
                    <div className={styles.overviewColValue} style={{ color:'var(--green)' }}>
                      {fmt(d.income||0)}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ width:1, background:'var(--border-light)', alignSelf:'stretch', flexShrink:0 }}/>

                {/* Expenses — click for breakdown */}
                <div onClick={() => setBreakdown('expense')} title="View expense transactions"
                  style={{ display:'flex', alignItems:'center', gap:10, flex:1, justifyContent:'flex-end', cursor:'pointer', borderRadius:10, padding:'4px', margin:'-4px', transition:'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,91,91,.06)'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <div style={{
                    width:38, height:38, borderRadius:11, flexShrink:0,
                    background:'rgba(255,91,91,.12)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <img src="/Financial decline.png" alt="expenses" style={{ width:22, height:22, objectFit:'contain' }}/>
                  </div>
                  <div>
                    <div className={styles.overviewColLabel} style={{ display:'flex', alignItems:'center', gap:3 }}>{t('dash_expenses')} <ChevronRight size={11}/></div>
                    <div className={styles.overviewColValue} style={{ color:'var(--red)' }}>
                      {fmt(d.expense||0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Budget */}
            <div className={styles.budgetCard} onClick={() => navigate('/budget')}>
              <DonutRing pct={budgetPct} />
              <div className={styles.budgetCardText}>
                <div className={styles.budgetCardLabel}>{t('dash_monthly_budget')}</div>
                <div className={styles.budgetCardAmount}>
                  {fmt(budgetLeft)} {t('dash_left')}
                </div>
                <div className={styles.budgetCardSub}>
                  {t('dash_of')} {fmt(totalBudget)}
                </div>
              </div>
              <ChevronRight size={16} className={styles.quickChevron}/>
            </div>

          </div>
        </div>

        {/* ══ QUICK CARDS — 3 columns, 2 cards each, 1 row ══ */}
        <div className={styles.quickGrid}>

          {/* Column 1: Accounts + Debts */}
          <div className={styles.quickCol}>
            <div className={styles.quickCard} onClick={() => navigate('/wallet')}>
              <div className={styles.quickIconWrap} style={{ background:'rgba(108,99,255,.12)' }}>
                <Wallet size={20} color="#6C63FF"/>
              </div>
              <div className={styles.quickCardInfo}>
                <div className={styles.quickCardLabel}>{t('dash_accounts')}</div>
                <div className={styles.quickCardValue}>{(wallets||[]).filter(w=>!['visa','mastercard','loan'].includes(w.type)).length} {t('common_accounts')}</div>
                <div className={styles.quickCardSub}>{t('dash_view_all')}</div>
              </div>
            </div>

            <div className={styles.quickCard} onClick={() => navigate('/debts')}>
              <div className={styles.quickIconWrap} style={{ background:'rgba(255,91,91,.12)' }}>
                <CreditCard size={20} color="#FF5B5B"/>
              </div>
              <div className={styles.quickCardInfo}>
                <div className={styles.quickCardLabel}>{t('dash_debts')}</div>
                <div className={styles.quickCardValue}>{debtWallets.length} {t('common_debts')}</div>
                <div className={styles.quickCardSubRed}>{fmt(totalDebt,{noDecimals:true})} {t('dash_owed')}</div>
              </div>
            </div>
          </div>

          {/* Column 2: Goals + Transactions */}
          <div className={styles.quickCol}>
            <div className={styles.quickCard} onClick={() => navigate('/goals')}>
              <div className={styles.quickIconWrap} style={{ background:'rgba(55,214,122,.12)' }}>
                <Target size={20} color="#37D67A"/>
              </div>
              <div className={styles.quickCardInfo}>
                <div className={styles.quickCardLabel}>{t('dash_goals')}</div>
                <div className={styles.quickCardValue}>{goals?.length || 0} {t('nav_goals')}</div>
                <div className={styles.quickCardSub}>{(goals?.length||0) > 0 ? t('dash_in_progress') : t('dash_start_saving')}</div>
              </div>
            </div>

            <div className={styles.quickCard} onClick={() => navigate('/transactions')}>
              <div className={styles.quickIconWrap} style={{ background:'rgba(255,184,77,.12)' }}>
                <FileText size={20} color="#FFB84D"/>
              </div>
              <div className={styles.quickCardInfo}>
                <div className={styles.quickCardLabel}>{t('nav_transactions')}</div>
                <div className={styles.quickCardValue}>{recentTx.data?.length || 0} Recent</div>
                <div className={styles.quickCardSub}>{t('dash_view_all')}</div>
              </div>
            </div>
          </div>

          {/* Column 3: Investments + Budget */}
          <div className={styles.quickCol}>
            <div className={styles.quickCard} onClick={() => navigate('/analytics')}>
              <div className={styles.quickIconWrap} style={{ background:'rgba(91,140,255,.12)' }}>
                <TrendingUp size={20} color="#5B8CFF"/>
              </div>
              <div className={styles.quickCardInfo}>
                <div className={styles.quickCardLabel}>{t('dash_investments')}</div>
                <div className={styles.quickCardValue}>{fmt(d.total_savings||0,{noDecimals:true})}</div>
                <div className={styles.quickCardSubGreen}>↑ {Math.abs(incomeChange).toFixed(1)}%</div>
              </div>
            </div>

            <div className={styles.quickCard} onClick={() => navigate('/budget')}>
              <div className={styles.quickIconWrap} style={{ background:'rgba(162,155,254,.15)' }}>
                <BarChart2 size={20} color="#A29BFE"/>
              </div>
              <div className={styles.quickCardInfo}>
                <div className={styles.quickCardLabel}>{t('dash_budget')}</div>
                <div className={styles.quickCardValue}>{fmt(budgetLeft,{noDecimals:true})} {t('dash_left')}</div>
                <div className={styles.quickCardSub}>{budgetPct}% {t('dash_used')}</div>
              </div>
            </div>
          </div>

        </div>

        {/* ══ CHARTS ROW — 3 equal columns aligned with quick cards ══ */}
        <div className={styles.analyticsGrid}>

          {/* ── Col 1: Spending Overview area chart ── */}
          <div className="card" style={{ display:'flex', flexDirection:'column' }}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>{t('dash_spending')}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:6 }}>
                  <span className="mono" style={{ fontSize:22, fontWeight:900, letterSpacing:-1, color:'var(--text)' }}>
                    {fmt(d.expense||0)}
                  </span>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--red)', background:'var(--red-light)', borderRadius:20, padding:'2px 9px', whiteSpace:'nowrap' }}>
                    ↓ {Math.abs(d.expense_change||0).toFixed(1)}%
                  </span>
                </div>
              </div>
              <select className="btn btn-ghost btn-sm" style={{ fontSize:11, fontWeight:600 }}>
                <option>This Month</option>
                <option>This Year</option>
              </select>
            </div>
            <div style={{ flex:1, minHeight:0 }}>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={flowData} margin={{ top:6, right:4, left:-24, bottom:0 }}>
                  <defs>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#FFB84D"/>
                      <stop offset="100%" stopColor="#6C63FF"/>
                    </linearGradient>
                    <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.18}/>
                      <stop offset="100%" stopColor="#6C63FF" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="incFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#37D67A" stopOpacity={0.15}/>
                      <stop offset="100%" stopColor="#37D67A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip />}/>
                  <Area type="monotone" dataKey="expense" stroke="url(#expGrad)" strokeWidth={2.5}
                    fill="url(#expFill)" name="Expense" dot={false} activeDot={{ r:4, fill:'#6C63FF' }}/>
                  <Area type="monotone" dataKey="income" stroke="#37D67A" strokeWidth={2}
                    fill="url(#incFill)" name="Income" dot={false} activeDot={{ r:4, fill:'#37D67A' }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div style={{ display:'flex', gap:16, paddingTop:10, borderTop:'1px solid var(--border-light)' }}>
              {[{color:'#6C63FF',key:'tx_expense'},{color:'#37D67A',key:'tx_income'}].map(l => (
                <div key={l.key} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:l.color }}/>
                  <span style={{ fontSize:11.5, color:'var(--text3)', fontWeight:500 }}>{t(l.key)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Col 2: Expenses by Category donut ── */}
          <div className="card" style={{ display:'flex', flexDirection:'column' }}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{t('dash_cat_expense')}</span>
              <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>{periodLabel}</span>
            </div>
            {pieData.length === 0 ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 0', color:'var(--text3)' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📊</div>
                <div style={{ fontSize:13 }}>{t('analytics_no_data')}</div>
              </div>
            ) : (
              <>
                {/* Donut centred */}
                <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                  <ResponsiveContainer width="100%" height={168}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={76}
                        dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                        {pieData.map((item,i) => <Cell key={i} fill={item.color || PIE_COLORS[i % PIE_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip
                        formatter={(v,_,p) => [fmt(v), p.payload.name]}
                        contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position:'absolute', textAlign:'center', pointerEvents:'none' }}>
                    <div className="mono" style={{ fontSize:14, fontWeight:900, lineHeight:1.1, color:'var(--text)' }}>
                      {fmt(pieTotalExp, {noDecimals:true})}
                    </div>
                    <div style={{ fontSize:9, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', marginTop:2 }}>Total</div>
                  </div>
                </div>
                {/* Legend */}
                <div style={{ display:'flex', flexDirection:'column', gap:7, flex:1 }}>
                  {pieData.map((item,i) => {
                    const col = item.color || PIE_COLORS[i % PIE_COLORS.length];
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:13, flexShrink:0 }}>{item.emoji || '📌'}</span>
                        <span style={{ flex:1, fontSize:12, color:'var(--text2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name}</span>
                        <div style={{ width:60, height:5, background:'var(--surface3)', borderRadius:20, overflow:'hidden', flexShrink:0 }}>
                          <div style={{ height:'100%', width:`${item.pct}%`, background:col, borderRadius:20 }}/>
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', width:32, textAlign:'right', flexShrink:0 }}>{item.pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Col 3: Income vs Expense bar chart (insight) ── */}
          <div className="card" style={{ display:'flex', flexDirection:'column' }}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>{t('dash_inc_vs_exp')}</div>
                <div style={{ marginTop:4 }}>
                  {(() => {
                    const totalInc = flowData.reduce((s,m) => s + (m.income||0), 0);
                    const totalExp = flowData.reduce((s,m) => s + (m.expense||0), 0);
                    const saved = totalInc - totalExp;
                    const isPositive = saved >= 0;
                    return (
                      <span style={{ fontSize:11, fontWeight:700, borderRadius:20, padding:'2px 9px',
                        color: isPositive ? '#37D67A' : '#FF5B5B',
                        background: isPositive ? 'rgba(55,214,122,.1)' : 'rgba(255,91,91,.1)' }}>
                        {isPositive ? '↑' : '↓'} {t('dash_net_saved')}: {fmt(Math.abs(saved),{noDecimals:true})}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <span style={{ fontSize:11, color:'var(--text3)', fontWeight:500 }}>{t('dash_this_year')}</span>
            </div>

            <div style={{ flex:1, minHeight:0 }}>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={flowData} margin={{ top:4, right:4, left:-24, bottom:0 }} barSize={8} barGap={3}>
                  <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
                  <Tooltip content={<ChartTooltip />}/>
                  <Bar dataKey="income"  name="Income"  fill="#37D67A" radius={[4,4,0,0]}/>
                  <Bar dataKey="expense" name="Expense" fill="#6C63FF" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary insight row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, paddingTop:10, borderTop:'1px solid var(--border-light)' }}>
              {[
                { label: t('dash_total_income'),  value: flowData.reduce((s,m)=>s+(m.income||0),0),  color:'#37D67A' },
                { label: t('dash_total_expense'), value: flowData.reduce((s,m)=>s+(m.expense||0),0), color:'#6C63FF' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:color }}/>
                    <span style={{ fontSize:10, color:'var(--text3)', fontWeight:600 }}>{label}</span>
                  </div>
                  <div className="mono" style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>
                    {fmt(value,{noDecimals:true})}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ══ NET WORTH HISTORY ══ */}
        {(netWorthHistory && netWorthHistory.length > 0) && (
          <div className="card" style={{ marginBottom:24 }}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>Net Worth History</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>6-month trend of your total wealth</div>
              </div>
              {(() => {
                const latest = netWorthHistory[netWorthHistory.length - 1]?.net_worth || 0;
                const first  = netWorthHistory[0]?.net_worth || 0;
                const change = latest - first;
                const isPos  = change >= 0;
                return (
                  <span style={{ fontSize:11, fontWeight:700, borderRadius:20, padding:'2px 9px',
                    color: isPos ? '#37D67A' : '#FF5B5B',
                    background: isPos ? 'rgba(55,214,122,.1)' : 'rgba(255,91,91,.1)' }}>
                    {isPos ? '↑' : '↓'} {fmt(Math.abs(change), { noDecimals: true })}
                  </span>
                );
              })()}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={netWorthHistory.map(s => ({
                name: new Date(s.snapshot_date).toLocaleDateString('en-US', { month:'short', day:'numeric' }),
                netWorth: parseFloat(s.net_worth),
                assets: parseFloat(s.total_assets || 0),
                debt: parseFloat(s.total_debt || 0),
              }))} margin={{ top:6, right:4, left:-24, bottom:0 }}>
                <defs>
                  <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="#6C63FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <Tooltip
                  formatter={(v, name) => [fmt(v), name === 'netWorth' ? 'Net Worth' : name === 'assets' ? 'Assets' : 'Debt']}
                  contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }}
                />
                <Area type="monotone" dataKey="netWorth" stroke="#6C63FF" strokeWidth={2.5}
                  fill="url(#nwFill)" name="netWorth" dot={false} activeDot={{ r:4, fill:'#6C63FF' }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ══ WEEKLY ANALYSIS ══ */}
        <WeeklyAnalysis />

        {/* ══ BOTTOM ROW: Recent Transactions + Accounts ══ */}
        <div className={styles.bottomGrid}>

          {/* Recent Transactions full list */}
          <div className="card">
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{t('dash_recent_tx')}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}
                style={{ fontSize:12, color:'var(--accent)', fontWeight:700 }}>
                {t('dash_view_all')}
              </button>
            </div>
            <div>
              {(recentTx.data||[]).slice(0,6).map(tx => {
                const catColor = CAT_COLORS[tx.category_name] || { bg:'var(--accent-light)', color:'var(--accent)' };
                const isIncome = tx.type === 'income';
                return (
                  <div key={tx.id} className={styles.txListItem}
                    onClick={() => navigate('/transactions')} style={{ cursor:'pointer' }}>
                    <div className={styles.txIcon} style={{ background: catColor.bg }}>
                      {tx.category_emoji || (tx.description||tx.payment_name||'?')[0].toUpperCase()}
                    </div>
                    <div className={styles.txInfo}>
                      <div className={styles.txName}>{tx.description || tx.payment_name || '—'}</div>
                      <div className={styles.txDate}>
                        {new Date(tx.transaction_date).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' })}
                      </div>
                    </div>
                    <div className={styles.txAmountWrap}>
                      <div className={styles.txAmount} style={{ color: isIncome ? 'var(--green)' : 'var(--red)' }}>
                        {isIncome ? '+' : '−'}{fmt(Math.abs(tx.amount))}
                      </div>
                      <span className={styles.txCatTag} style={{ color: catColor.color, background: catColor.bg }}>
                        {tx.category_name || '—'}
                      </span>
                    </div>
                    <ChevronRight size={14} color="var(--text3)" style={{ flexShrink:0, opacity:.4 }}/>
                  </div>
                );
              })}
              {!recentTx.data?.length && (
                <div style={{ textAlign:'center', padding:'28px 0', color:'var(--text3)', fontSize:13 }}>
                  {t('common_no_data')}.{' '}
                  <span style={{ color:'var(--accent)', cursor:'pointer', fontWeight:600 }}
                    onClick={() => navigate('/transactions')}>{t('tx_add_first')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Accounts list */}
          <div className="card">
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{t('dash_my_accounts')}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/wallet')}
                style={{ fontSize:12, color:'var(--accent)', fontWeight:700 }}>
                {t('dash_view_all')}
              </button>
            </div>
            <div>
              {(wallets||[]).slice(0,6).map((w,i) => {
                const GRAD_COLORS = ['#6C63FF','#37D67A','#FFB84D','#5B8CFF','#FF5B5B','#A29BFE'];
                const wIcon = { visa:'💳',mastercard:'💳',paypal:'🅿️',bank:'🏦',cash:'💵',crypto:'₿',loan:'📋',asset:'📈',lending:'🤝',other:'👛',paytm:'🟦',phonepe:'💜',gpay:'🟣',irctc:'🚂',amazon_pay:'🛒',mobikwik:'💙',jio_money:'🔴',airtel_money:'❤️' };
                return (
                  <div key={w.id} onClick={() => navigate('/wallet')} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border-light)', cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:GRAD_COLORS[i%6]+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      {wIcon[w.type]||'👛'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {w.name}{w.last_four ? ` *${w.last_four}` : ''}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text3)', textTransform:'capitalize', marginTop:1 }}>{w.type}</div>
                    </div>
                    <div className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--text)', flexShrink:0 }}>
                      {fmt(w.balance||0)}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" style={{ flexShrink:0, opacity:.4 }}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                  </div>
                );
              })}
              {!(wallets||[]).length && (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text3)', fontSize:13 }}>
                  No accounts yet.{' '}
                  <span style={{ color:'var(--accent)', cursor:'pointer', fontWeight:600 }}
                    onClick={() => navigate('/wallet')}>Add one →</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {breakdown && (
        <BreakdownModal
          type={breakdown}
          range={breakdownRange}
          walletId={walletId}
          periodLabel={periodLabel}
          fmt={fmt}
          onClose={() => setBreakdown(null)}
        />
      )}
    </div>
  );
}

/* ── Income/Expense transaction breakdown modal ───────────────────────── */
function BreakdownModal({ type, range, walletId, periodLabel, fmt, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['breakdown', type, range, walletId],
    queryFn: () => transactionsAPI.getAll({
      ...range, type, ...(walletId ? { wallet_id: walletId } : {}), limit: 1000,
    }).then(r => r.data.data),
  });

  const txns = (data || []).filter(t => t.type === type);
  const total = txns.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const color = type === 'income' ? '#37D67A' : '#FF5B5B';

  // Group by category
  const groups = {};
  txns.forEach(t => {
    const key = t.category_name || 'Uncategorized';
    if (!groups[key]) groups[key] = { name: key, emoji: t.category_emoji || '📌', total: 0, count: 0 };
    groups[key].total += parseFloat(t.amount || 0);
    groups[key].count++;
  });
  const grouped = Object.values(groups).sort((a, b) => b.total - a.total);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:`${color}1f`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
            {type === 'income' ? '📥' : '📤'}
          </div>
          <div style={{ flex:1 }}>
            <div className="modal-title" style={{ margin:0 }}>{type === 'income' ? 'Income' : 'Expense'} Breakdown</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>{periodLabel}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--text3)', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Total */}
        <div style={{ background:`${color}12`, borderRadius:12, padding:'12px 16px', marginBottom:18, display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
          <span style={{ fontSize:12.5, color:'var(--text3)', fontWeight:600 }}>Total · {txns.length} transaction{txns.length!==1?'s':''}</span>
          <span className="mono" style={{ fontSize:20, fontWeight:800, color }}>{fmt(total)}</span>
        </div>

        {isLoading ? (
          <div style={{ padding:30, textAlign:'center', color:'var(--text3)', fontSize:13 }}>Loading…</div>
        ) : txns.length === 0 ? (
          <div style={{ padding:30, textAlign:'center', color:'var(--text3)', fontSize:13 }}>No {type} transactions in this period.</div>
        ) : (
          <>
            {/* By category */}
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>By Category</div>
            <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:20 }}>
              {grouped.map(g => {
                const pct = total > 0 ? Math.round((g.total / total) * 100) : 0;
                return (
                  <div key={g.name} style={{ background:'var(--surface2)', borderRadius:11, padding:'10px 13px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
                      <span style={{ fontSize:15 }}>{g.emoji}</span>
                      <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--text)' }}>{g.name}</span>
                      <span style={{ fontSize:11, color:'var(--text3)' }}>{g.count}×</span>
                      <span className="mono" style={{ fontSize:13.5, fontWeight:800, color }}>{fmt(g.total)}</span>
                    </div>
                    <div style={{ height:5, borderRadius:20, background:'var(--surface3)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:20 }}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All transactions */}
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>All Transactions</div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {txns.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, background:'var(--surface2)' }}>
                  <span style={{ fontSize:14 }}>{t.category_emoji || '💸'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.description || t.payment_name || '—'}</div>
                    <div style={{ fontSize:10.5, color:'var(--text3)' }}>
                      {new Date(t.transaction_date).toLocaleDateString('en-IN',{ day:'numeric', month:'short' })}
                      {t.wallet_name ? ` · ${t.wallet_name}` : ''}{t.category_name ? ` · ${t.category_name}` : ''}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize:13, fontWeight:800, color, flexShrink:0 }}>
                    {type === 'income' ? '+' : '−'}{fmt(parseFloat(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
