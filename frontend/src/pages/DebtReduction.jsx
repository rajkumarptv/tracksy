import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { Target, TrendingDown, Zap, Trophy, ChevronDown, ChevronUp, Info, CheckCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { walletsAPI } from '../services/api';
import { Topbar, PageLoader } from '../components/ui';
import { useFmt } from '../i18n';
import { normalizeDebts, minPayment, simulate, whatIf, coachTips } from '../lib/payoff';

/* ── KPI Card ── */
function KpiCard({ icon, iconBg, label, value, sub, subColor }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:16, padding:'18px 20px', boxShadow:'0 2px 16px rgba(0,0,0,.07)', border:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ width:52, height:52, borderRadius:14, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--text3)', marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:19, fontWeight:700, color:'var(--text)', letterSpacing:-0.3, fontFamily:'Inter,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize:11.5, fontWeight:600, color: subColor||'var(--text3)', marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function monthsToLabel(m) {
  if (m === null || m === undefined) return 'Never at this pace';
  if (m <= 0) return 'Debt Free!';
  const y = Math.floor(m / 12);
  const mo = m % 12;
  if (y === 0) return `${mo}mo`;
  if (mo === 0) return `${y}yr`;
  return `${y}yr ${mo}mo`;
}

export default function DebtReduction({ embedded = false }) {
  const fmt = useFmt();
  const [extra, setExtra] = useState(0);
  const [method, setMethod] = useState('avalanche');

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsAPI.getAll().then(r => r.data.data),
  });

  const debts = useMemo(() => normalizeDebts(wallets), [wallets]);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const minMonthly = debts.reduce((s, d) => s + minPayment(d), 0);

  const avalanche = useMemo(() => simulate(debts, { extra, method: 'avalanche' }), [debts, extra]);
  const snowball  = useMemo(() => simulate(debts, { extra, method: 'snowball' }),  [debts, extra]);
  const baseline  = useMemo(() => simulate(debts, { extra: 0, method: 'avalanche' }), [debts]);

  const comparable    = !baseline.neverPaysOff && !avalanche.neverPaysOff;
  const interestSaved = comparable ? baseline.totalInterest - avalanche.totalInterest : 0;
  const monthsSaved   = comparable ? baseline.months - avalanche.months : 0;
  const recommended   = avalanche.totalInterest <= snowball.totalInterest ? 'avalanche' : 'snowball';

  const active = method === 'avalanche' ? avalanche : snowball;
  const chartData = useMemo(() => active.series.map(p => ({ month: `M${p.month}`, balance: Math.round(p.balance) })), [active]);
  const whatIfRows = useMemo(() => whatIf(debts, method, [1000, 2000, 5000]), [debts, method]);
  const tips = useMemo(
    () => coachTips(debts, active, whatIfRows, { fmt: n => fmt(n, { noDecimals: true }) }),
    [debts, active, whatIfRows, fmt]
  );
  const byId = useMemo(() => Object.fromEntries(debts.map(d => [d.id, d])), [debts]);

  if (isLoading) return <PageLoader />;

  const TIP_STYLE = {
    warn: { icon:<AlertTriangle size={16} color="#D97706"/>, bg:'rgba(217,119,6,.10)', border:'rgba(217,119,6,.28)' },
    good: { icon:<CheckCircle size={16} color="#059669"/>,   bg:'rgba(5,150,105,.10)', border:'rgba(5,150,105,.28)' },
    info: { icon:<Lightbulb size={16} color="#4F46E5"/>,     bg:'rgba(79,70,229,.08)', border:'rgba(79,70,229,.22)' },
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      {!embedded && <Topbar title="Debt Reduction Planner" subtitle="Avalanche & Snowball strategies to become debt-free faster"/>}

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
              <KpiCard icon={<TrendingDown size={22} color="#DC2626"/>} iconBg="rgba(220,38,38,.14)" label="Total Debt"      value={fmt(totalDebt,{noDecimals:true})} sub={`${debts.length} debt${debts.length===1?'':'s'}`}/>
              <KpiCard icon={<Target size={22} color="#4F46E5"/>}       iconBg="rgba(79,70,229,.14)" label="Min Monthly"    value={fmt(minMonthly,{noDecimals:true})} sub="minimum payments"/>
              <KpiCard icon={<Zap size={22} color="#059669"/>}          iconBg="rgba(5,150,105,.14)" label="Interest Saved" value={fmt(interestSaved > 0 ? interestSaved : 0,{noDecimals:true})} sub={extra > 0 ? `with ₹${extra.toLocaleString('en-IN')} extra/mo` : 'add extra payment'} subColor={interestSaved>0?'#059669':'var(--text3)'}/>
              <KpiCard icon={<Trophy size={22} color="#D97706"/>}       iconBg="rgba(217,119,6,.14)" label="Debt-Free In"   value={monthsToLabel(active.months)} sub={active.neverPaysOff ? 'payments too low' : monthsSaved > 0 ? `${monthsSaved}mo faster than baseline` : 'add extra to save time'} subColor={active.neverPaysOff ? '#DC2626' : monthsSaved>0?'#059669':'var(--text3)'}/>
            </div>

            {/* Coach */}
            {tips.length > 0 && (
              <div style={{ background:'var(--surface)', borderRadius:16, padding:'18px 22px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)', marginBottom:20 }}>
                <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:12 }}>Your payoff coach</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {tips.map((t, i) => {
                    const st = TIP_STYLE[t.level] || TIP_STYLE.info;
                    return (
                      <div key={i} style={{ display:'flex', gap:12, padding:'12px 14px', borderRadius:12, background:st.bg, border:`1px solid ${st.border}` }}>
                        <div style={{ marginTop:2, flexShrink:0 }}>{st.icon}</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{t.title}</div>
                          <div style={{ fontSize:12.5, color:'var(--text2)', marginTop:2, lineHeight:1.45 }}>{t.body}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {debts.some(d => d.rateAssumed) && (
                  <Link to="/debts" style={{ display:'inline-block', marginTop:12, fontSize:12.5, fontWeight:600, color:'var(--accent)', textDecoration:'none' }}>
                    Set the missing interest rates →
                  </Link>
                )}
              </div>
            )}

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
                    style={{ width:100, padding:'7px 12px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:14, fontWeight:700, fontFamily:'Inter,sans-serif', outline:'none' }}/>
                </div>
              </div>
              <input type="range" min={0} max={50000} step={500} value={extra} onChange={e=>setExtra(parseInt(e.target.value))}
                style={{ width:'100%', accentColor:'var(--accent)', height:4 }}/>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginTop:4 }}>
                <span>₹0</span><span>₹25,000</span><span>₹50,000</span>
              </div>
              {whatIfRows.some(r => r.monthsSaved > 0) && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:14 }}>
                  {whatIfRows.map(r => (
                    <button key={r.extra} onClick={() => setExtra(r.extra)}
                      style={{ border:`1.5px solid ${extra===r.extra?'var(--accent)':'var(--border)'}`, background: extra===r.extra?'var(--accent-light)':'var(--surface2)', color:'var(--text)', borderRadius:10, padding:'7px 12px', fontSize:12, cursor:'pointer', textAlign:'left' }}>
                      <div style={{ fontWeight:700 }}>+{fmt(r.extra,{noDecimals:true})}/mo</div>
                      <div style={{ color:'#059669', fontWeight:600 }}>
                        {r.monthsSaved > 0 ? `${r.monthsSaved}mo sooner · saves ${fmt(r.interestSaved,{noDecimals:true})}` : 'no change'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Strategy Comparison */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
              {[
                { id:'avalanche', label:'Debt Avalanche', emoji:'❄️', desc:'Highest interest rate first', color:'#4F46E5', bg:'rgba(79,70,229,.08)', borderColor:'rgba(79,70,229,.3)', result: avalanche },
                { id:'snowball',  label:'Debt Snowball',  emoji:'⛄', desc:'Smallest balance first',      color:'#3B82F6', bg:'rgba(59,130,246,.08)', borderColor:'rgba(59,130,246,.3)',  result: snowball  },
              ].map(s=>(
                <div key={s.id} onClick={()=>setMethod(s.id)}
                  style={{ background: method===s.id ? s.bg : 'var(--surface)', borderRadius:14, padding:'20px 22px', border:`2px solid ${method===s.id ? s.color : 'var(--border-light)'}`, cursor:'pointer', transition:'all .18s', position:'relative', overflow:'hidden' }}>
                  {recommended === s.id && (
                    <div style={{ position:'absolute', top:12, right:12, fontSize:10.5, fontWeight:700, color:'#059669', background:'rgba(5,150,105,.12)', borderRadius:8, padding:'2px 8px', border:'1px solid rgba(5,150,105,.25)' }}>✦ Recommended</div>
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
                        <div style={{ fontSize:15, fontWeight:900, color: method===s.id ? s.color : 'var(--text)', fontFamily:'Inter,sans-serif', marginTop:3 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {method===s.id && (
                    <div style={{ marginTop:12, height:3, background:`${s.color}22`, borderRadius:14, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:'100%', background:s.color, borderRadius:14, animation:'slide 1.2s ease' }}/>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Payoff Chart */}
            <div style={{ background:'var(--surface)', borderRadius:14, padding:'20px 22px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)', marginBottom:20 }}>
              <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Debt Payoff Projection</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>
                {method === 'avalanche' ? '❄️ Avalanche' : '⛄ Snowball'} — {monthsToLabel(active.months)} to debt-free
                {extra > 0 && ` · ${fmt(extra,{noDecimals:true})}/mo extra`}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                  <defs>
                    <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#DC2626" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#DC2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                  <XAxis dataKey="month" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <Tooltip contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }} formatter={(v)=>[fmt(v,{noDecimals:true}),'Remaining']}/>
                  <Area type="monotone" dataKey="balance" stroke="#DC2626" strokeWidth={2.5} fill="url(#debtGrad)" dot={false} activeDot={{ r:4 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Payoff plan */}
            <div style={{ background:'var(--surface)', borderRadius:14, padding:'20px 22px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Payoff plan</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:16 }}>
                {method === 'avalanche' ? 'Targeting highest interest rate first (saves the most money)' : 'Targeting smallest balance first (builds momentum)'}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {active.order.map((o, i) => {
                  const d = byId[o.id];
                  if (!d) return null;
                  const pct = totalDebt > 0 ? (d.balance / totalDebt) * 100 : 0;
                  const when = o.payoffDate
                    ? new Date(`${o.payoffDate}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short', year:'numeric' })
                    : 'not paid off';
                  return (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', background:'var(--surface2)', borderRadius:13 }}>
                      <div style={{ width:28, height:28, borderRadius:8, background: i===0?'rgba(79,70,229,.2)':'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color: i===0?'var(--accent)':'var(--text3)', flexShrink:0 }}>{i+1}</div>
                      <span style={{ fontSize:18, flexShrink:0 }}>{d.isCard ? '💳' : '📋'}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, gap:8 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</span>
                          <div style={{ display:'flex', gap:10, flexShrink:0 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', fontFamily:'Inter,sans-serif' }}>{fmt(d.balance,{noDecimals:true})}</span>
                            <span title={d.rateAssumed ? 'No rate set: assumed' : undefined} style={{ fontSize:11.5, fontWeight:600, color:'#DC2626', background:'rgba(220,38,38,.1)', borderRadius:6, padding:'1px 7px' }}>{d.rateAssumed ? '~' : ''}{d.rate}%</span>
                          </div>
                        </div>
                        <div style={{ height:5, background:'var(--surface3)', borderRadius:14, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: i===0?'var(--accent)':'#DC2626', borderRadius:14, opacity: 1 - i*0.15 }}/>
                        </div>
                        <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:6 }}>
                          Paid off {when} · interest {fmt(o.interestPaid,{noDecimals:true})}
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
