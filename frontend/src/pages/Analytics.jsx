// ─── Analytics (the numbers tab of Insights) ─────────────────────────────────
import { useQuery as useQ2 } from '@tanstack/react-query';
import { useFmt as useFmtWallet } from '../i18n';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { dashboardAPI, analyticsAPI } from '../services/api';
import { useNavigate as useNavAnalytics } from 'react-router-dom';
import { Topbar as Topbar2, StatCard, PageLoader as PL2 } from '../components/ui';
import { useT as useTAnalytics } from '../i18n';

const ANALYTICS_PERIODS = [
  { key:'this_month',  label:'This Month' },
  { key:'last_month',  label:'Last Month' },
  { key:'last_3m',     label:'Last 3 Months' },
  { key:'last_6m',     label:'Last 6 Months' },
  { key:'this_year',   label:'This Year' },
];
function analyticsRange(key) {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()+1-1).padStart(2,'0')}`;
  const fmtD = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const first = (yy,mm) => fmtD(new Date(yy, mm, 1));
  if (key === 'this_month')  return { start_date:first(y,m),    end_date:first(y,m+1) };
  if (key === 'last_month')  return { start_date:first(y,m-1),  end_date:first(y,m) };
  if (key === 'last_3m')     return { start_date:first(y,m-2),  end_date:first(y,m+1) };
  if (key === 'last_6m')     return { start_date:first(y,m-5),  end_date:first(y,m+1) };
  if (key === 'this_year')   return { start_date:`${y}-01-01`,  end_date:`${y+1}-01-01` };
  return { start_date:first(y,m), end_date:first(y,m+1) };
}

const BUCKET_STYLE = {
  commitments:{ color:'#EF4444', bg:'rgba(239,68,68,.12)',  icon:'🏦' },
  transfers:  { color:'#D97706', bg:'rgba(217,119,6,.12)', icon:'👤' },
  essential:  { color:'#EAB308', bg:'rgba(234,179,8,.14)',  icon:'🏠' },
  optional:   { color:'#047857', bg:'rgba(4,120,87,.12)',  icon:'🎯' },
};
const ACAT_COLORS = ['#2A78D6','#EB6834','#1BAF7A','#EDA100','#E87BA4','#1D4ED8','#008300','#0D9488','#636E72'];

export function Analytics({ embedded = false } = {}) {
  const fmt = useFmtWallet();
  const navigate = useNavAnalytics();
  const [periodKey, setPeriodKey] = useState2('this_month');
  const range = analyticsRange(periodKey);

  const { data, isLoading } = useQ2({
    queryKey:['analytics-overview', periodKey],
    queryFn:() => analyticsAPI.overview(range).then(r=>r.data.data),
  });

  const card = { background:'var(--surface)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--border-light)', boxShadow:'0 4px 20px rgba(29,78,216,.06)' };
  const money = (v) => fmt(v, { noDecimals:true });

  if (isLoading || !data) return <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>{!embedded && <Topbar2 title="Analytics" subtitle="Your financial intelligence"/>}<PL2/></div>;

  const k = data.kpis;
  const donut = (data.categories||[]).slice(0,8).map((c,i)=>({ name:c.name, value:c.amount, color:ACAT_COLORS[i%ACAT_COLORS.length] }));
  const goTx = (q) => navigate(q ? `/transactions?search=${encodeURIComponent(q)}` : '/transactions');

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {!embedded && <Topbar2 title="Analytics" subtitle="Where your money goes — and why"/>}
      <div style={{ padding:'22px 28px 48px', flex:1, overflow:'auto' }}>

        {/* Period selector */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {ANALYTICS_PERIODS.map(p => {
            const on = p.key === periodKey;
            return (
              <button key={p.key} onClick={()=>setPeriodKey(p.key)}
                style={{ padding:'8px 15px', borderRadius:999, fontSize:13, fontWeight:700, cursor:'pointer',
                  border:`1.5px solid ${on?'#1D4ED8':'var(--border)'}`, background:on?'rgba(29,78,216,.12)':'var(--surface)', color:on?'#1D4ED8':'var(--text2)' }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* KPI cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:22 }}>
          <div style={card}><div style={{ fontSize:12.5, color:'var(--text3)' }}>Money Out</div><div style={{ fontSize:22, fontWeight:800, color:'#DC2626', marginTop:4 }}>{money(k.moneyOut)}</div><div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{k.outCount} txns</div></div>
          <div style={card}><div style={{ fontSize:12.5, color:'var(--text3)' }}>Money In</div><div style={{ fontSize:22, fontWeight:800, color:'#047857', marginTop:4 }}>{money(k.moneyIn)}</div><div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{k.inCount} txns</div></div>
          <div style={card}><div style={{ fontSize:12.5, color:'var(--text3)' }}>Net Cash Flow</div><div style={{ fontSize:22, fontWeight:800, color:k.net>=0?'#047857':'#EF4444', marginTop:4 }}>{k.net<0?'−':''}{money(Math.abs(k.net))}</div><div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{k.net>=0?'Surplus':'Deficit'}</div></div>
          <div style={card}><div style={{ fontSize:12.5, color:'var(--text3)' }}>Avg Daily Spend</div><div style={{ fontSize:22, fontWeight:800, color:'var(--text)', marginTop:4 }}>{money(k.avgDaily)}</div></div>
          <div style={card}><div style={{ fontSize:12.5, color:'var(--text3)' }}>Transactions</div><div style={{ fontSize:22, fontWeight:800, color:'var(--text)', marginTop:4 }}>{k.txCount}</div><div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{k.outCount} out · {k.inCount} in</div></div>
        </div>

        {/* Money Flow buckets */}
        <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', margin:'8px 0 12px' }}>Smart Money Flow</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginBottom:24 }}>
          {(data.moneyFlow||[]).map(b => {
            const s = BUCKET_STYLE[b.key];
            return (
              <div key={b.key} style={{ ...card, borderLeft:`4px solid ${s.color}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ width:34, height:34, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>{s.icon}</span>
                  <span style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{b.label}</span>
                </div>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{money(b.amount)}</div>
                <div style={{ fontSize:12.5, color:'var(--text3)', marginTop:3 }}>{b.pct}% of money out · {b.count} txns{b.recipients!=null?` · ${b.recipients} people`:''}</div>
                <div style={{ height:6, borderRadius:99, background:'var(--surface2)', marginTop:10, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(100,b.pct)}%`, background:s.color, borderRadius:99 }}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Category analysis */}
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1.2fr)', gap:16, marginBottom:24 }} className="analytics-cat-grid">
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:10 }}>Spending by Category</div>
            {donut.length === 0 ? <div style={{ fontSize:13, color:'var(--text3)', padding:'30px 0', textAlign:'center' }}>No spending yet</div> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={2} strokeWidth={0}>
                    {donut.map((d,i)=><Cell key={i} fill={d.color}/>)}
                  </Pie>
                  <RTooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:12, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12 }}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:10 }}>Categories ranked</div>
            <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:230, overflowY:'auto' }}>
              {(data.categories||[]).map((c,i)=>(
                <div key={c.name} onClick={()=>goTx(c.name)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 6px', borderRadius:9, cursor:'pointer', borderBottom:'1px solid var(--border-light)' }}>
                  <span style={{ width:9, height:9, borderRadius:3, background:ACAT_COLORS[i%ACAT_COLORS.length], flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{money(c.amount)}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', width:42, textAlign:'right' }}>{c.pct}%</span>
                </div>
              ))}
              {(data.categories||[]).length===0 && <div style={{ fontSize:13, color:'var(--text3)', padding:'20px 0', textAlign:'center' }}>No categories</div>}
            </div>
          </div>
        </div>

        {/* Weekly + highest */}
        <div style={{ ...card, marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:6 }}>Weekly Spending</div>
          {data.topWeek && data.topWeek.amount>0 && (
            <div style={{ fontSize:12.5, color:'var(--text2)', marginBottom:12 }}>🔥 Highest: <b style={{ color:'#DC2626' }}>{data.topWeek.label}</b> — {money(data.topWeek.amount)}</div>
          )}
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.weekly||[]}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize:11, fill:'var(--text3)' }}/>
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize:10.5, fill:'var(--text3)' }} tickFormatter={(v)=>v>=1000?`₹${Math.round(v/1000)}K`:`₹${v}`}/>
              <RTooltip formatter={(v)=>money(v)} contentStyle={{ borderRadius:12, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12 }}/>
              <Bar dataKey="amount" radius={[6,6,0,0]}>
                {(data.weekly||[]).map((w,i)=><Cell key={i} fill={data.topWeek&&w.week===data.topWeek.week?'#DC2626':'#1D4ED8'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Highest day + top recipients */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, marginBottom:24 }}>
          {data.topDay && (
            <div style={{ ...card }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:6 }}>🔥 Highest Spending Day</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#DC2626' }}>{money(data.topDay.amount)}</div>
              <div style={{ fontSize:12.5, color:'var(--text3)', marginTop:2 }}>{new Date(data.topDay.date).toLocaleDateString('en-IN',{ day:'numeric', month:'long' })} · {data.topDay.count} txns</div>
              <button onClick={()=>goTx('')} style={{ marginTop:12, fontSize:12.5, fontWeight:700, color:'#1D4ED8', background:'rgba(29,78,216,.1)', border:'none', borderRadius:9, padding:'7px 14px', cursor:'pointer' }}>View transactions →</button>
            </div>
          )}
          <div style={{ ...card }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:10 }}>💸 Top Recipients & Merchants</div>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {(data.payees||[]).slice(0,6).map((p,i)=>(
                <div key={p.name} onClick={()=>goTx(p.name)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 6px', borderRadius:9, cursor:'pointer', borderBottom:'1px solid var(--border-light)' }}>
                  <span style={{ fontSize:13, width:22 }}>{['🥇','🥈','🥉'][i]||`${i+1}.`}</span>
                  <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{money(p.amount)}</span>
                  <span style={{ fontSize:12, color:'var(--text3)', width:52, textAlign:'right' }}>{p.count} txns</span>
                </div>
              ))}
              {(data.payees||[]).length===0 && <div style={{ fontSize:13, color:'var(--text3)', padding:'20px 0', textAlign:'center' }}>No payments yet</div>}
            </div>
          </div>
        </div>

        {/* Insights */}
        {(data.insights||[]).length>0 && (
          <>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', margin:'8px 0 12px' }}>💡 Spending Insights</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:12 }}>
              {data.insights.map((ins,i)=>(
                <div key={i} style={{ ...card, display:'flex', gap:12 }}>
                  <span style={{ fontSize:22 }}>{ins.icon}</span>
                  <div>
                    <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{ins.title}</div>
                    <div style={{ fontSize:12.5, color:'var(--text2)', marginTop:3, lineHeight:1.5 }}>{ins.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


