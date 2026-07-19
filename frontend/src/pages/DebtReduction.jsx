import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { Target, TrendingDown, Zap, Trophy, ChevronDown, ChevronUp, Info, CheckCircle } from 'lucide-react';
import { walletsAPI } from '../services/api';
import { Topbar, PageLoader } from '../components/ui';
import { useFmt } from '../i18n';

const DEBT_TYPES = ['visa','mastercard','loan','lending'];

/* ── Avalanche/Snowball calculator ── */
function calcPayoff(debts, extraMonthly = 0, method = 'avalanche') {
  if (!debts.length) return { months: 0, totalInterest: 0, schedule: [] };
  let remaining = debts.map(d => ({
    ...d,
    bal: Math.abs(parseFloat(d.balance || 0)),
    rate: parseFloat(d.interest_rate || 18) / 100 / 12,
    minPay: parseFloat(d.min_payment || Math.abs(parseFloat(d.balance || 0)) * 0.02),
  })).filter(d => d.bal > 0);

  const sorted = [...remaining].sort((a, b) =>
    method === 'avalanche' ? b.rate - a.rate : a.bal - b.bal
  );

  let month = 0;
  let totalInterest = 0;
  const balanceHistory = [];
  const MAX_MONTHS = 360;

  while (sorted.some(d => d.bal > 0) && month < MAX_MONTHS) {
    month++;
    let pool = extraMonthly;
    // collect freed minimum payments from paid debts
    sorted.forEach(d => { if (d.bal <= 0) pool += d.minPay; });

    // pay minimums first
    sorted.forEach(d => {
      if (d.bal <= 0) return;
      const interest = d.bal * d.rate;
      totalInterest += interest;
      const pay = Math.min(d.minPay, d.bal + interest);
      d.bal = Math.max(0, d.bal + interest - pay);
    });

    // apply extra to priority debt
    const priority = sorted.find(d => d.bal > 0);
    if (priority && pool > 0) {
      priority.bal = Math.max(0, priority.bal - pool);
    }

    const totalBal = sorted.reduce((s, d) => s + d.bal, 0);
    if (month % 3 === 0 || totalBal === 0) {
      balanceHistory.push({ month: `M${month}`, balance: Math.round(totalBal) });
    }
  }

  return { months: month, totalInterest, schedule: balanceHistory };
}

/* ── KPI Card ── */
function KpiCard({ icon, iconBg, label, value, sub, subColor }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:16, padding:'18px 20px', boxShadow:'0 2px 16px rgba(0,0,0,.07)', border:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ width:52, height:52, borderRadius:14, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--text3)', marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:900, color:'var(--text)', letterSpacing:-0.5, fontFamily:'Space Grotesk,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize:11.5, fontWeight:600, color: subColor||'var(--text3)', marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function monthsToLabel(m) {
  if (m <= 0) return 'Debt Free!';
  const y = Math.floor(m / 12);
  const mo = m % 12;
  if (y === 0) return `${mo}mo`;
  if (mo === 0) return `${y}yr`;
  return `${y}yr ${mo}mo`;
}

export default function DebtReduction() {
  const fmt = useFmt();
  const [extra, setExtra] = useState(0);
  const [method, setMethod] = useState('avalanche');

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsAPI.getAll().then(r => r.data.data),
  });

  const debts = useMemo(() => (wallets || []).filter(w => DEBT_TYPES.includes(w.type) && Math.abs(parseFloat(w.balance || 0)) > 0), [wallets]);

  const totalDebt = debts.reduce((s, d) => s + Math.abs(parseFloat(d.balance || 0)), 0);
  const minMonthly = debts.reduce((s, d) => s + parseFloat(d.min_payment || Math.abs(parseFloat(d.balance || 0)) * 0.02), 0);

  const avalanche = useMemo(() => calcPayoff(debts, extra, 'avalanche'), [debts, extra]);
  const snowball  = useMemo(() => calcPayoff(debts, extra, 'snowball'),  [debts, extra]);
  const baseline  = useMemo(() => calcPayoff(debts, 0, 'avalanche'),     [debts]);

  const interestSaved = baseline.totalInterest - avalanche.totalInterest;
  const monthsSaved   = baseline.months - avalanche.months;
  const recommended   = avalanche.totalInterest <= snowball.totalInterest ? 'avalanche' : 'snowball';

  const active = method === 'avalanche' ? avalanche : snowball;
  const debtsSorted = [...debts].sort((a, b) =>
    method === 'avalanche'
      ? parseFloat(b.interest_rate || 18) - parseFloat(a.interest_rate || 18)
      : Math.abs(parseFloat(a.balance || 0)) - Math.abs(parseFloat(b.balance || 0))
  );

  if (isLoading) return <PageLoader />;

  const DEBT_META = { visa:'💳', mastercard:'💳', loan:'📋', lending:'🤝' };

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <Topbar title="Debt Reduction Planner" subtitle="Avalanche & Snowball strategies to become debt-free faster"/>

      <div style={{ padding:'24px 28px 40px', flex:1, overflow:'auto' }}>

        {debts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text3)' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
            <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:8 }}>No Active Debts!</div>
            <div style={{ fontSize:14 }}>You're already debt-free. Add debts in the Debts section to use the planner.</div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:24 }}>
              <KpiCard icon={<TrendingDown size={22} color="#EC4899"/>} iconBg="rgba(236,72,153,.14)" label="Total Debt"      value={fmt(totalDebt,{noDecimals:true})} sub={`${debts.length} debts`}/>
              <KpiCard icon={<Target size={22} color="#8B5CF6"/>}       iconBg="rgba(139,92,246,.14)" label="Min Monthly"    value={fmt(minMonthly,{noDecimals:true})} sub="minimum payments"/>
              <KpiCard icon={<Zap size={22} color="#22C55E"/>}          iconBg="rgba(34,197,94,.14)" label="Interest Saved" value={fmt(interestSaved > 0 ? interestSaved : 0,{noDecimals:true})} sub={extra > 0 ? `with ₹${extra.toLocaleString('en-IN')} extra/mo` : 'add extra payment'} subColor={interestSaved>0?'#22C55E':'var(--text3)'}/>
              <KpiCard icon={<Trophy size={22} color="#F59E0B"/>}       iconBg="rgba(245,158,11,.14)" label="Debt-Free In"   value={monthsToLabel(active.months)} sub={monthsSaved > 0 ? `${monthsSaved}mo faster than baseline` : 'add extra to save time'} subColor={monthsSaved>0?'#22C55E':'var(--text3)'}/>
            </div>

            {/* Extra Payment Slider */}
            <div style={{ background:'var(--surface)', borderRadius:16, padding:'18px 22px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Extra Monthly Payment</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>How much extra can you pay each month beyond minimums?</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:12, color:'var(--text3)' }}>₹</span>
                  <input type="number" value={extra} min={0} step={500}
                    onChange={e=>setExtra(Math.max(0,parseInt(e.target.value)||0))}
                    style={{ width:100, padding:'7px 12px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:14, fontWeight:700, fontFamily:'Space Grotesk,sans-serif', outline:'none' }}/>
                </div>
              </div>
              <input type="range" min={0} max={50000} step={500} value={extra} onChange={e=>setExtra(parseInt(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent)', height:4 }}/>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginTop:4 }}>
                <span>₹0</span><span>₹25,000</span><span>₹50,000</span>
              </div>
            </div>

            {/* Strategy Comparison */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
              {[
                { id:'avalanche', label:'Debt Avalanche', emoji:'❄️', desc:'Highest interest rate first', color:'#8B5CF6', bg:'rgba(139,92,246,.08)', borderColor:'rgba(139,92,246,.3)', result: avalanche },
                { id:'snowball',  label:'Debt Snowball',  emoji:'⛄', desc:'Smallest balance first',      color:'#3B82F6', bg:'rgba(59,130,246,.08)', borderColor:'rgba(59,130,246,.3)',  result: snowball  },
              ].map(s=>(
                <div key={s.id} onClick={()=>setMethod(s.id)}
                  style={{ background: method===s.id ? s.bg : 'var(--surface)', borderRadius:18, padding:'20px 22px', border:`2px solid ${method===s.id ? s.color : 'var(--border-light)'}`, cursor:'pointer', transition:'all .18s', position:'relative', overflow:'hidden' }}>
                  {recommended === s.id && (
                    <div style={{ position:'absolute', top:12, right:12, fontSize:10.5, fontWeight:700, color:'#22C55E', background:'rgba(34,197,94,.12)', borderRadius:8, padding:'2px 8px', border:'1px solid rgba(34,197,94,.25)' }}>✦ Recommended</div>
                  )}
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <span style={{ fontSize:26 }}>{s.emoji}</span>
                    <div>
                      <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)' }}>{s.label}</div>
                      <div style={{ fontSize:12, color:'var(--text3)' }}>{s.desc}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    {[
                      { label:'Payoff Time',      value: monthsToLabel(s.result.months) },
                      { label:'Total Interest',   value: fmt(s.result.totalInterest,{noDecimals:true}) },
                    ].map(({ label, value })=>(
                      <div key={label} style={{ background:'var(--surface2)', borderRadius:12, padding:'10px 12px' }}>
                        <div style={{ fontSize:10.5, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
                        <div style={{ fontSize:15, fontWeight:900, color: method===s.id ? s.color : 'var(--text)', fontFamily:'Space Grotesk,sans-serif', marginTop:3 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {method===s.id && (
                    <div style={{ marginTop:12, height:3, background:`${s.color}22`, borderRadius:20, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:'100%', background:s.color, borderRadius:20, animation:'slide 1.2s ease' }}/>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Payoff Chart */}
            <div style={{ background:'var(--surface)', borderRadius:18, padding:'20px 22px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)', marginBottom:20 }}>
              <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Debt Payoff Projection</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>
                {method === 'avalanche' ? '❄️ Avalanche' : '⛄ Snowball'} — {monthsToLabel(active.months)} to debt-free
                {extra > 0 && ` · ${fmt(extra,{noDecimals:true})}/mo extra`}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={active.schedule} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                  <defs>
                    <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EC4899" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#EC4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                  <XAxis dataKey="month" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <Tooltip contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }} formatter={(v)=>[fmt(v,{noDecimals:true}),'Remaining']}/>
                  <Area type="monotone" dataKey="balance" stroke="#EC4899" strokeWidth={2.5} fill="url(#debtGrad)" dot={false} activeDot={{ r:4 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Payment Order */}
            <div style={{ background:'var(--surface)', borderRadius:18, padding:'20px 22px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Payment Order</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>
                {method === 'avalanche' ? 'Targeting highest interest rate first (saves the most money)' : 'Targeting smallest balance first (builds momentum)'}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {debtsSorted.map((d, i) => {
                  const bal = Math.abs(parseFloat(d.balance || 0));
                  const rate = parseFloat(d.interest_rate || 18);
                  const pct = totalDebt > 0 ? (bal / totalDebt) * 100 : 0;
                  const meta = DEBT_META[d.type] || '📋';
                  return (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', background:'var(--surface2)', borderRadius:13 }}>
                      <div style={{ width:28, height:28, borderRadius:8, background: i===0?'rgba(139,92,246,.2)':'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color: i===0?'var(--accent)':'var(--text3)', flexShrink:0 }}>{i+1}</div>
                      <span style={{ fontSize:18, flexShrink:0 }}>{meta}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</span>
                          <div style={{ display:'flex', gap:10, flexShrink:0 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', fontFamily:'Space Grotesk,sans-serif' }}>{fmt(bal,{noDecimals:true})}</span>
                            <span style={{ fontSize:11.5, fontWeight:600, color:'#EC4899', background:'rgba(236,72,153,.1)', borderRadius:6, padding:'1px 7px' }}>{rate}%</span>
                          </div>
                        </div>
                        <div style={{ height:5, background:'var(--surface3)', borderRadius:20, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: i===0?'var(--accent)':'#EC4899', borderRadius:20, opacity: 1 - i*0.15 }}/>
                        </div>
                      </div>
                      {i === 0 && <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', background:'var(--accent-light)', borderRadius:7, padding:'3px 8px', flexShrink:0, whiteSpace:'nowrap' }}>FOCUS</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
