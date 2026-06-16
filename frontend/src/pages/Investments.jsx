import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, BarChart2, DollarSign, Percent, Activity, Award, ChevronRight } from 'lucide-react';
import { Topbar } from '../components/ui';
import { useFmt } from '../i18n';

const ASSET_TYPES = [
  { value:'stock',   label:'Stocks',         emoji:'📈', color:'#6C63FF', bg:'rgba(108,99,255,.15)' },
  { value:'mf',      label:'Mutual Funds',   emoji:'🏦', color:'#37D67A', bg:'rgba(55,214,122,.15)' },
  { value:'etf',     label:'ETFs',           emoji:'📊', color:'#5B8CFF', bg:'rgba(91,140,255,.15)' },
  { value:'gold',    label:'Gold',           emoji:'🥇', color:'#FFB84D', bg:'rgba(255,184,77,.15)' },
  { value:'fd',      label:'Fixed Deposits', emoji:'🏛️', color:'#00CEC9', bg:'rgba(0,206,201,.15)'  },
  { value:'bond',    label:'Bonds',          emoji:'📋', color:'#A29BFE', bg:'rgba(162,155,254,.15)'},
  { value:'crypto',  label:'Crypto',         emoji:'₿',  color:'#FF7675', bg:'rgba(255,118,117,.15)'},
];

const HOLDING_STORAGE_KEY = 'tracksy_investments';

function loadHoldings() {
  try { return JSON.parse(localStorage.getItem(HOLDING_STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveHoldings(h) { localStorage.setItem(HOLDING_STORAGE_KEY, JSON.stringify(h)); }

function genId() { return Math.random().toString(36).slice(2,10); }

/* ── KPI Card ── */
function KpiCard({ icon, iconBg, label, value, change, changePos }) {
  const isPos = changePos !== false;
  return (
    <div style={{ background:'var(--surface)', borderRadius:16, padding:'18px 20px', boxShadow:'0 2px 16px rgba(0,0,0,.07)', border:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ width:52, height:52, borderRadius:14, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--text3)', marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:900, color:'var(--text)', letterSpacing:-0.5, fontFamily:'Space Grotesk,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
        {change !== undefined && (
          <div style={{ fontSize:11.5, fontWeight:600, color: isPos ? '#37D67A':'#FF5B5B', marginTop:2 }}>
            {isPos?'▲':'▼'} {Math.abs(parseFloat(change)||0).toFixed(2)}% overall
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Add Holding Modal ── */
function AddModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name:'', type:'stock', units:'', buyPrice:'', currentPrice:'', date: new Date().toISOString().split('T')[0] });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const invested = parseFloat(form.units||0) * parseFloat(form.buyPrice||0);
  const current  = parseFloat(form.units||0) * parseFloat(form.currentPrice||0);
  const pl = current - invested;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:480 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div className="modal-title" style={{ margin:0 }}>Add Investment</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--text3)', cursor:'pointer' }}>×</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="form-label">Asset Type</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:6 }}>
              {ASSET_TYPES.map(t=>(
                <button key={t.value} onClick={()=>set('type',t.value)}
                  style={{ padding:'6px 14px', borderRadius:10, fontSize:12.5, fontWeight:600, cursor:'pointer', border:`1.5px solid ${form.type===t.value?t.color:'var(--border)'}`, background: form.type===t.value?t.bg:'var(--surface2)', color: form.type===t.value?t.color:'var(--text3)' }}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div><label className="form-label">Name / Symbol</label><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. RELIANCE, SBI Bluechip MF"/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label className="form-label">Units / Quantity</label><input className="form-input" type="number" value={form.units} onChange={e=>set('units',e.target.value)} placeholder="0"/></div>
            <div><label className="form-label">Buy Price (₹)</label><input className="form-input" type="number" value={form.buyPrice} onChange={e=>set('buyPrice',e.target.value)} placeholder="0.00"/></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label className="form-label">Current Price (₹)</label><input className="form-input" type="number" value={form.currentPrice} onChange={e=>set('currentPrice',e.target.value)} placeholder="0.00"/></div>
            <div><label className="form-label">Purchase Date</label><input className="form-input" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
          </div>
          {invested > 0 && (
            <div style={{ background: pl >= 0 ? 'rgba(55,214,122,.08)':'rgba(255,91,91,.08)', borderRadius:12, padding:'12px 16px', border:`1px solid ${pl>=0?'rgba(55,214,122,.2)':'rgba(255,91,91,.2)'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <div><div style={{ fontSize:11, color:'var(--text3)' }}>Invested</div><div style={{ fontSize:16, fontWeight:800, color:'var(--text)', fontFamily:'Space Grotesk,sans-serif' }}>₹{invested.toLocaleString('en-IN',{minimumFractionDigits:2})}</div></div>
                <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'var(--text3)' }}>P&L</div><div style={{ fontSize:16, fontWeight:800, color: pl>=0?'#37D67A':'#FF5B5B', fontFamily:'Space Grotesk,sans-serif' }}>{pl>=0?'+':''}₹{Math.abs(pl).toLocaleString('en-IN',{minimumFractionDigits:2})}</div></div>
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" style={{ flex:1 }}
              onClick={()=>{ if(!form.name||!form.units||!form.buyPrice||!form.currentPrice) return; onSave({ id:genId(), ...form, units:parseFloat(form.units), buyPrice:parseFloat(form.buyPrice), currentPrice:parseFloat(form.currentPrice) }); onClose(); }}>
              Add Holding
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = ['#6C63FF','#37D67A','#5B8CFF','#FFB84D','#00CEC9','#A29BFE','#FF7675'];

export default function Investments() {
  const fmt = useFmt();
  const [holdings, setHoldings] = useState(loadHoldings);
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [deleteId, setDeleteId] = useState(null);

  const save = (h) => { setHoldings(h); saveHoldings(h); };
  const addHolding = (h) => save([...holdings, h]);
  const removeHolding = (id) => { save(holdings.filter(h=>h.id!==id)); setDeleteId(null); };

  const filtered = filterType === 'all' ? holdings : holdings.filter(h=>h.type===filterType);

  const stats = useMemo(() => {
    const totalInvested = holdings.reduce((s,h)=>s+(h.units*h.buyPrice),0);
    const totalCurrent  = holdings.reduce((s,h)=>s+(h.units*h.currentPrice),0);
    const totalPL = totalCurrent - totalInvested;
    const plPct   = totalInvested > 0 ? (totalPL/totalInvested)*100 : 0;
    // By type breakdown
    const byType = {};
    ASSET_TYPES.forEach(t=>{ byType[t.value]={ label:t.label, emoji:t.emoji, color:t.color, value:0, count:0 }; });
    holdings.forEach(h=>{ if(byType[h.type]){ byType[h.type].value += h.units*h.currentPrice; byType[h.type].count++; } });
    const pieData = Object.values(byType).filter(t=>t.value>0);
    return { totalInvested, totalCurrent, totalPL, plPct, pieData };
  }, [holdings]);

  const MOCK_TREND = ['Jan','Feb','Mar','Apr','May','Jun'].map((m,i)=>({ name:m, value: stats.totalCurrent * (0.7 + i*0.06) }));

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <Topbar title="Investments" subtitle="Track your portfolio across all asset classes">
        <button className="btn btn-primary btn-sm" style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none' }} onClick={()=>setShowAdd(true)}>
          <Plus size={13}/> Add Holding
        </button>
      </Topbar>

      <div style={{ padding:'24px 28px 40px', flex:1, overflow:'auto' }}>

        {/* KPI Row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:24 }}>
          <KpiCard icon={<BarChart2 size={22} color="#6C63FF"/>} iconBg="rgba(108,99,255,.14)" label="Portfolio Value"    value={fmt(stats.totalCurrent)} change={stats.plPct} changePos={stats.plPct>=0}/>
          <KpiCard icon={<DollarSign size={22} color="#5B8CFF"/>} iconBg="rgba(91,140,255,.14)" label="Total Invested"   value={fmt(stats.totalInvested)}/>
          <KpiCard icon={stats.totalPL>=0?<TrendingUp size={22} color="#37D67A"/>:<TrendingDown size={22} color="#FF5B5B"/>} iconBg={stats.totalPL>=0?'rgba(55,214,122,.14)':'rgba(255,91,91,.14)'} label="Total P&L" value={`${stats.totalPL>=0?'+':''}${fmt(stats.totalPL)}`} change={stats.plPct} changePos={stats.totalPL>=0}/>
          <KpiCard icon={<Activity size={22} color="#FFB84D"/>} iconBg="rgba(255,184,77,.14)" label="Holdings" value={`${holdings.length} assets`}/>
        </div>

        {/* Charts Row */}
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16, marginBottom:20 }}>

          {/* Portfolio Trend */}
          <div style={{ background:'var(--surface)', borderRadius:18, padding:'20px 22px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Portfolio Trend</div>
            {holdings.length === 0 ? (
              <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13 }}>Add holdings to see trend</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={MOCK_TREND} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                  <defs>
                    <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.22}/>
                      <stop offset="100%" stopColor="#6C63FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="3 3"/>
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <Tooltip contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }} formatter={v=>[fmt(v),'Value']}/>
                  <Area type="monotone" dataKey="value" stroke="#6C63FF" strokeWidth={2.5} fill="url(#portGrad)" dot={false} activeDot={{ r:4 }}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Asset Allocation */}
          <div style={{ background:'var(--surface)', borderRadius:18, padding:'20px 22px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:16 }}>Asset Allocation</div>
            {stats.pieData.length === 0 ? (
              <div style={{ height:180, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13, gap:6 }}>
                <span style={{ fontSize:32 }}>📊</span> Add holdings to see allocation
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={76} dataKey="value" paddingAngle={2}>
                        {stats.pieData.map((c,i)=><Cell key={i} fill={c.color||PIE_COLORS[i%PIE_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v,_,p)=>[fmt(v),p.payload.label]} contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1 }}>
                  {stats.pieData.map((c,i)=>{
                    const pct = stats.totalCurrent > 0 ? Math.round((c.value/stats.totalCurrent)*100) : 0;
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:14 }}>{c.emoji}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ fontSize:11.5, color:'var(--text2)', fontWeight:600 }}>{c.label}</span>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'var(--text)' }}>{pct}%</span>
                          </div>
                          <div style={{ height:4, background:'var(--surface3)', borderRadius:20, marginTop:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:c.color, borderRadius:20 }}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {[{ v:'all', l:'All Assets' }, ...ASSET_TYPES.map(t=>({ v:t.value, l:t.label }))].map(({ v, l })=>(
            <button key={v} onClick={()=>setFilterType(v)}
              style={{ padding:'7px 16px', borderRadius:10, fontSize:12.5, fontWeight:600, cursor:'pointer', border: filterType===v?'1.5px solid var(--accent)':'1.5px solid var(--border)', background: filterType===v?'var(--accent-light)':'var(--surface)', color: filterType===v?'var(--accent)':'var(--text3)', transition:'all .15s' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Holdings Table */}
        <div style={{ background:'var(--surface)', borderRadius:18, border:'1px solid var(--border-light)', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,.05)' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-light)', fontWeight:700, fontSize:14.5, color:'var(--text)' }}>Holdings</div>
          {filtered.length === 0 ? (
            <div style={{ padding:'40px 0', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📈</div>
              No {filterType === 'all' ? '' : ASSET_TYPES.find(t=>t.value===filterType)?.label} holdings yet.{' '}
              <span style={{ color:'var(--accent)', cursor:'pointer', fontWeight:600 }} onClick={()=>setShowAdd(true)}>Add one →</span>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:640, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--surface2)' }}>
                    {['Asset','Type','Units','Buy Price','Current','Invested','Value','P&L',''].map(h=>(
                      <th key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'left', padding:'10px 14px', borderBottom:'1px solid var(--border-light)', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(h=>{
                    const meta = ASSET_TYPES.find(t=>t.value===h.type)||ASSET_TYPES[0];
                    const invested = h.units * h.buyPrice;
                    const current  = h.units * h.currentPrice;
                    const pl = current - invested;
                    const plPct = invested > 0 ? (pl/invested)*100 : 0;
                    return (
                      <tr key={h.id} onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'} onMouseLeave={e=>e.currentTarget.style.background=''} style={{ transition:'background .1s' }}>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:32, height:32, borderRadius:9, background:meta.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{meta.emoji}</div>
                            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap' }}>{h.name}</div>
                          </div>
                        </td>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)' }}>
                          <span style={{ fontSize:11, fontWeight:700, color:meta.color, background:meta.bg, borderRadius:8, padding:'3px 8px', whiteSpace:'nowrap' }}>{meta.label}</span>
                        </td>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)', fontSize:13, color:'var(--text)', fontWeight:600, whiteSpace:'nowrap' }}>{h.units}</td>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text3)', whiteSpace:'nowrap' }}>₹{h.buyPrice.toLocaleString('en-IN')}</td>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text)', fontWeight:600, whiteSpace:'nowrap' }}>₹{h.currentPrice.toLocaleString('en-IN')}</td>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text3)', whiteSpace:'nowrap' }}>₹{invested.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)', fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', fontFamily:'Space Grotesk,sans-serif' }}>₹{current.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)', whiteSpace:'nowrap' }}>
                          <div style={{ fontSize:13, fontWeight:800, color: pl>=0?'#37D67A':'#FF5B5B', fontFamily:'Space Grotesk,sans-serif' }}>{pl>=0?'+':''}₹{Math.abs(pl).toLocaleString('en-IN',{maximumFractionDigits:0})}</div>
                          <div style={{ fontSize:10.5, color: pl>=0?'#37D67A':'#FF5B5B', fontWeight:600 }}>{plPct>=0?'+':''}{plPct.toFixed(2)}%</div>
                        </td>
                        <td style={{ padding:'12px 14px', borderBottom:'1px solid var(--border-light)' }}>
                          <button onClick={()=>setDeleteId(h.id)} style={{ background:'rgba(255,91,91,.1)', border:'none', borderRadius:8, padding:'5px 8px', cursor:'pointer', color:'#FF5B5B' }}>
                            <Trash2 size={13}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddModal onSave={addHolding} onClose={()=>setShowAdd(false)}/>}
      {deleteId && (
        <div className="modal-overlay" onClick={()=>setDeleteId(null)}>
          <div className="modal" style={{ maxWidth:360 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Remove Holding?</div>
            <p style={{ color:'var(--text3)', fontSize:14, marginBottom:20 }}>This holding will be permanently removed.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex:1, background:'#FF5B5B', color:'#fff', border:'none', borderRadius:10, padding:'10px', fontWeight:700, cursor:'pointer' }} onClick={()=>removeHolding(deleteId)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
