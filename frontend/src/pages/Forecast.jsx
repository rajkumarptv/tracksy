import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
import { AlertTriangle, CheckCircle, Wallet, TrendingDown, CalendarDays, Info } from 'lucide-react';
import { forecastAPI } from '../services/api';
import { Topbar, PageLoader } from '../components/ui';
import { useFmt } from '../i18n';

const RANGES = [30, 60, 90];
const KIND_ICON = { recurring: '🔁', card: '💳', emi: '🏦' };

const shortDate = s => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const longDate = s => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

function KpiCard({ icon, iconBg, label, value, sub, subColor }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:16, padding:'16px 18px', boxShadow:'0 2px 16px rgba(0,0,0,.07)', border:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:46, height:46, borderRadius:13, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--text3)', marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', letterSpacing:-0.3, fontFamily:'Inter,sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
        {sub && <div style={{ fontSize:11.5, fontWeight:600, color:subColor || 'var(--text3)', marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Forecast() {
  const fmt = useFmt();
  const [days, setDays] = useState(60);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['forecast', days],
    queryFn: () => forecastAPI.cashflow({ days }).then(r => r.data.data),
    staleTime: 60 * 1000,
  });

  // Gradient that turns red below zero: offset is where y=0 sits between the series max and min.
  const { offset, mode } = useMemo(() => {
    if (!data) return { offset: 1, mode: 'positive' };
    const vals = data.series.map(p => p.balance);
    const max = Math.max(...vals), min = Math.min(...vals);
    if (min >= 0) return { offset: 1, mode: 'positive' };
    if (max <= 0) return { offset: 0, mode: 'negative' };
    return { offset: max / (max - min), mode: 'split' };
  }, [data]);

  const chartData = useMemo(() => (data?.series || []).map(p => ({ ...p, label: shortDate(p.date) })), [data]);

  const eventDays = useMemo(() => {
    if (!data) return [];
    const bal = Object.fromEntries(data.series.map(p => [p.date, p.balance]));
    const grouped = {};
    data.events.forEach(e => { (grouped[e.date] = grouped[e.date] || []).push(e); });
    return Object.entries(grouped).map(([date, items]) => ({ date, items, balance: bal[date] }));
  }, [data]);

  // fmt() shows magnitudes only, so add the sign back: a negative balance must not read as a positive one
  const money = n => `${n < 0 ? '−' : ''}${fmt(Math.abs(n), { noDecimals: true })}`;

  const header = (
    <>
      <div className="mob-header">
        <div>
          <div className="mob-header-title">Forecast</div>
          <div className="mob-header-sub">Where your balance is heading</div>
        </div>
      </div>
      <Topbar title="Cash-flow forecast" subtitle="Where your bank and cash balance is heading" />
    </>
  );

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    return (
      <div>
        {header}
        <div style={{ padding:'40px 24px', textAlign:'center', color:'var(--text3)' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:8 }}>Couldn't load the forecast</div>
          <button className="btn btn-primary btn-sm" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const short = s.shortfallDate;

  return (
    <div style={{ paddingBottom: 40 }}>
      {header}
      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>

        {/* Status */}
        <div style={{
          display:'flex', gap:14, alignItems:'flex-start', padding:'16px 18px', borderRadius:16,
          background: short ? 'rgba(220,38,38,.09)' : 'rgba(4,120,87,.09)',
          border: `1px solid ${short ? 'rgba(220,38,38,.3)' : 'rgba(4,120,87,.3)'}`,
        }}>
          <div style={{ marginTop:2 }}>{short ? <AlertTriangle size={22} color="#DC2626"/> : <CheckCircle size={22} color="#047857"/>}</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>
              {short
                ? `Your balance may go below zero on ${longDate(short)}`
                : `You're on track for the next ${data.days} days`}
            </div>
            <div style={{ fontSize:13, color:'var(--text2)', marginTop:4, lineHeight:1.5 }}>
              {short
                ? `That's in ${s.daysUntilShortfall} day${s.daysUntilShortfall === 1 ? '' : 's'}. The low point is ${money(s.lowestBalance)} on ${shortDate(s.lowestDate)}, so you'd be short by ${money(s.shortfallAmount)}. Move money in or delay a payment to avoid it.`
                : `The lowest your balance gets is ${money(s.lowestBalance)} on ${shortDate(s.lowestDate)}.`}
            </div>
          </div>
        </div>

        {/* Range */}
        <div style={{ display:'flex', gap:8 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setDays(r)}
              style={{ border:`1.5px solid ${days === r ? 'var(--accent)' : 'var(--border)'}`, background: days === r ? 'var(--accent-light)' : 'var(--surface)', color: days === r ? 'var(--accent)' : 'var(--text2)', borderRadius:10, padding:'7px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {r} days
            </button>
          ))}
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
          <KpiCard icon={<Wallet size={20} color="#1D4ED8"/>} iconBg="rgba(29,78,216,.14)" label="Bank + cash today" value={money(data.startBalance)} sub="spendable balance" />
          <KpiCard icon={<TrendingDown size={20} color={s.lowestBalance < 0 ? '#DC2626' : '#D97706'}/>} iconBg={s.lowestBalance < 0 ? 'rgba(220,38,38,.14)' : 'rgba(217,119,6,.14)'}
            label="Lowest point" value={money(s.lowestBalance)} sub={shortDate(s.lowestDate)} subColor={s.lowestBalance < 0 ? '#DC2626' : undefined} />
          <KpiCard icon={<CalendarDays size={20} color="#047857"/>} iconBg="rgba(4,120,87,.14)" label={`In ${data.days} days`} value={money(s.endBalance)}
            sub={`${money(s.totalIn)} in · ${money(s.totalOut)} out`} />
        </div>

        {/* Chart */}
        <div style={{ background:'var(--surface)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Projected balance</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>
            Includes scheduled payments and about {money(s.variableSpend / Math.max(1, data.days))} a day of everyday spending
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top:6, right:8, left:-12, bottom:0 }}>
              <defs>
                <linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="#1D4ED8" stopOpacity={0.28}/>
                  <stop offset={offset} stopColor="#1D4ED8" stopOpacity={0.04}/>
                  <stop offset={offset} stopColor="#DC2626" stopOpacity={0.04}/>
                  <stop offset={1} stopColor="#DC2626" stopOpacity={0.28}/>
                </linearGradient>
                <linearGradient id="fcStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={offset} stopColor="#1D4ED8"/>
                  <stop offset={offset} stopColor="#DC2626"/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border-light)" strokeDasharray="4 6"/>
              <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28}/>
              <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} width={56}
                tickFormatter={v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}/>
              <Tooltip contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid var(--border)', background:'var(--surface)' }}
                formatter={v => [money(v), 'Balance']} labelFormatter={(_, p) => (p?.[0] ? longDate(p[0].payload.date) : '')}/>
              <ReferenceLine y={0} stroke="#DC2626" strokeDasharray="4 4" strokeOpacity={0.6}/>
              <Area type="monotone" dataKey="balance" stroke={mode === 'split' ? 'url(#fcStroke)' : mode === 'negative' ? '#DC2626' : '#1D4ED8'} strokeWidth={2.5} fill={mode === 'split' ? 'url(#fcFill)' : mode === 'negative' ? 'rgba(220,38,38,.14)' : 'rgba(29,78,216,.12)'} dot={false} activeDot={{ r:4 }}/>
              {short && <ReferenceDot x={shortDate(s.lowestDate)} y={s.lowestBalance} r={5} fill="#DC2626" stroke="#fff" strokeWidth={2}/>}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming events */}
        <div style={{ background:'var(--surface)', borderRadius:14, padding:'18px 20px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', marginBottom:12 }}>What's coming up</div>
          {eventDays.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--text3)' }}>
              Nothing scheduled. Add <Link to="/recurring" style={{ color:'var(--accent)' }}>recurring rules</Link> and set card payment days or loan EMI days to see them here.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {eventDays.map(day => (
                <div key={day.date} style={{ background:'var(--surface2)', borderRadius:12, padding:'10px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:'var(--text3)', marginBottom:6 }}>
                    <span>{longDate(day.date)}</span>
                    <span style={{ color: day.balance < 0 ? '#DC2626' : 'var(--text3)' }}>balance after: {money(day.balance)}</span>
                  </div>
                  {day.items.map((e, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', fontSize:13.5, color:'var(--text)' }}>
                      <span>{KIND_ICON[e.kind] || '•'} {e.label}</span>
                      <span style={{ fontWeight:700, color: e.amount < 0 ? '#DC2626' : '#047857', fontFamily:'Inter,sans-serif' }}>
                        {e.amount < 0 ? '−' : '+'}{money(Math.abs(e.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assumptions */}
        <div style={{ background:'var(--surface2)', borderRadius:14, padding:'16px 18px', border:'1px solid var(--border-light)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <Info size={15} color="var(--text3)"/>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>How this is calculated</span>
            <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8,
              color: data.confidence === 'high' ? '#047857' : data.confidence === 'medium' ? '#D97706' : '#DC2626',
              background: data.confidence === 'high' ? 'rgba(4,120,87,.12)' : data.confidence === 'medium' ? 'rgba(217,119,6,.12)' : 'rgba(220,38,38,.12)' }}>
              {data.confidence} confidence
            </span>
          </div>
          <ul style={{ margin:0, paddingLeft:18, fontSize:12.5, color:'var(--text2)', lineHeight:1.6 }}>
            {data.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
