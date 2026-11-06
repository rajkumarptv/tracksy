import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { transactionsAPI, categoriesAPI, walletsAPI } from '../services/api';
import { track } from '../lib/analytics';
import { Topbar, AmountText, StatusChip, PageLoader, EmptyState } from '../components/ui';
import { Plus, Upload, TrendingUp, TrendingDown, ArrowLeftRight, Search, SlidersHorizontal, Calendar, ChevronDown, Info, Paperclip } from 'lucide-react';
import BillAttachment, { BillBadge } from '../components/BillAttachment';
import { useFmt, useT } from '../i18n';
import useThemeStore from '../store/themeStore';
import styles from './Transactions.module.css';
import PaymentLogo from '../components/PaymentLogo';
import { MerchantLogo, CategoryIcon, CategoryGlyph } from '../components/icons';
import ThemedSelect from '../components/ThemedSelect';
import { invalidateFinance, resetFinance } from '../lib/cache';

/* ── Payment method definitions ──────────────────────────────────────── */
// walletTypes: which wallet types are shown in the account dropdown
// null = all wallets
const PAYMENT_METHODS = [
  { id:'gpay',        label:'GPay',        emoji:'🟣', desc:'Google Pay UPI',        walletTypes:['bank','gpay'],            isUPI:true  },
  { id:'phonepe',     label:'PhonePe',     emoji:'💜', desc:'PhonePe UPI',            walletTypes:['bank','phonepe'],         isUPI:true  },
  { id:'paytm',       label:'Paytm',       emoji:'🟦', desc:'Paytm UPI / Wallet',     walletTypes:['bank','paytm'],           isUPI:true  },
  { id:'amazon_pay',  label:'Amazon Pay',  emoji:'🛒', desc:'Amazon Pay wallet',      walletTypes:['bank','amazon_pay'],      isUPI:true  },
  { id:'irctc',       label:'IRCTC',       emoji:'🚂', desc:'IRCTC wallet',           walletTypes:['irctc','bank'],           isUPI:false },
  { id:'mobikwik',    label:'MobiKwik',    emoji:'💙', desc:'MobiKwik wallet',        walletTypes:['mobikwik','bank'],        isUPI:false },
  { id:'cash',        label:'Cash',        emoji:'💵', desc:'Physical cash',          walletTypes:['cash'],                   isUPI:false },
  { id:'credit',      label:'Credit Card', emoji:'💳', desc:'Visa / Mastercard',      walletTypes:['visa','mastercard'],      isUPI:false, isCredit:true },
  { id:'netbanking',  label:'Net Banking', emoji:'🏦', desc:'Bank account / NEFT',    walletTypes:['bank'],                   isUPI:false },
  { id:'upi',         label:'Other UPI',   emoji:'📲', desc:'Any UPI app',            walletTypes:['bank'],                   isUPI:true  },
  { id:'other',       label:'Other',       emoji:'👛', desc:'Wallet / other method',  walletTypes:null,                       isUPI:false },
];

// For income — "Received via"
const INCOME_METHODS = [
  { id:'bank_transfer', label:'Bank Transfer', emoji:'🏦', walletTypes:['bank'] },
  { id:'upi',           label:'UPI',           emoji:'📲', walletTypes:['bank','gpay','phonepe','paytm'] },
  { id:'cash',          label:'Cash',          emoji:'💵', walletTypes:['cash'] },
  { id:'irctc_refund',  label:'IRCTC Refund',  emoji:'🚂', walletTypes:['irctc','bank'] },
  { id:'other',         label:'Other',         emoji:'👛', walletTypes:null },
];

const LIMIT = 200; // load more so month filters show full picture

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2];

const CAT_COLORS = {
  Food:      { bg:'#e8f9f0', color:'#047857' },
  Income:    { bg:'#eef3ff', color:'#3B82F6' },
  Transport: { bg:'#eef3ff', color:'#3B82F6' },
  Shopping:  { bg:'#fff8ea', color:'#f5a623' },
  Health:    { bg:'#ffe8f0', color:'#e0457b' },
  Bills:     { bg:'#f0edff', color:'#1D4ED8' },
};

/* Group transactions by day — "Today", "Yesterday", then "28 May 2026" */
function groupByMonth(txList) {
  const map = {};
  const todayKey = new Date().toDateString();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yestKey = yest.toDateString();
  txList.forEach(tx => {
    const d = new Date(tx.transaction_date);
    const dk = d.toDateString();
    const key = dk === todayKey ? 'Today'
      : dk === yestKey ? 'Yesterday'
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!map[key]) map[key] = { label: key, sortKey: d.getTime(), items: [], income: 0, expense: 0 };
    if (tx.type === 'income')  map[key].income  += parseFloat(tx.amount || 0);
    else if (tx.type === 'expense') map[key].expense += parseFloat(tx.amount || 0);
    // transfers: only count 'out' legs to avoid double counting
    else if (tx.type === 'transfer' && tx.transfer_direction === 'out') map[key].expense += parseFloat(tx.amount || 0);
    map[key].items.push(tx);
  });
  return Object.values(map).sort((a,b) => b.sortKey - a.sortKey);
}

const CREDIT_WALLET_TYPES = ['visa', 'mastercard'];

/* ── Multi-segment mini donut (SVG, dashboard pie palette) ────────────── */
const DONUT_COLORS = ['#1D4ED8','#3B82F6','#DC2626','#D97706','#047857','#0D9488'];
function MiniDonut({ segments, size = 110, stroke = 14 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s,x)=>s+x, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      {segments.map((v,i) => {
        const frac = v / total;
        const dash = Math.max(0, frac * circ - 3);
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            style={{ transition:'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)' }}/>
        );
        offset += frac * circ;
        return el;
      })}
    </svg>
  );
}

/* ── Mobile spend-summary card (reference design, dashboard colors) ───── */
function TxSummaryCard({ txList, fmt, isDark, periodLabel }) {
  const income  = txList.filter(t=>t.type==='income').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const expense = txList.filter(t=>t.type==='expense').reduce((s,t)=>s+parseFloat(t.amount||0),0);
  const net = income - expense;

  // top expense categories → donut segments
  const catMap = {};
  txList.filter(t=>t.type==='expense').forEach(t => {
    const k = t.category_name || 'Other';
    catMap[k] = (catMap[k]||0) + parseFloat(t.amount||0);
  });
  const segs = Object.values(catMap).sort((a,b)=>b-a).slice(0,6);

  const green = isDark ? '#34D399' : '#047857';
  const pink  = isDark ? '#F87171' : '#DC2626';
  const blue  = isDark ? '#4F8DFF' : '#3B82F6';

  return (
    <div style={{
      margin:'0 16px 4px', padding:'18px 18px', borderRadius:14,
      background: isDark ? 'linear-gradient(135deg, #0B1136 0%, #09152B 100%)' : '#FFFFFF',
      border: `1px solid ${isDark ? 'rgba(29,78,216,0.25)' : '#C7CCFA'}`,
      boxShadow: isDark
        ? '0 20px 40px rgba(0,0,0,0.45), 0 0 40px rgba(29,78,216,0.1)'
        : '0 10px 40px rgba(16,24,40,0.06)',
      display:'flex', alignItems:'center', gap:14,
    }}>
      {/* Left: total spent */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, color: isDark ? '#B8C2D1' : '#667085', display:'flex', alignItems:'center', gap:5 }}>
          {periodLabel} <ChevronDown size={12}/>
        </div>
        <div style={{ fontSize:26, fontWeight:800, color: isDark ? '#fff' : '#101828', fontFamily:'Inter, sans-serif', letterSpacing:'-1px', marginTop:4 }}>
          {fmt(expense,{noDecimals:true})}
        </div>
        <div style={{ fontSize:12, color: isDark ? '#B8C2D1' : '#667085', marginTop:2 }}>Total Spent</div>
      </div>

      {/* Center: donut */}
      {segs.length > 0 && (
        <div style={{ position:'relative', flexShrink:0 }}>
          <MiniDonut segments={segs}/>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', border:`1.5px solid ${isDark?'rgba(29,78,216,.5)':'#C7CCFA'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <TrendingUp size={15} color="#1D4ED8"/>
            </div>
          </div>
        </div>
      )}

      {/* Right: income / expenses / net */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
        <div>
          <div style={{ fontSize:11, color: isDark ? '#B8C2D1' : '#667085' }}>Income</div>
          <div style={{ fontSize:13.5, fontWeight:800, color:green, fontFamily:'Inter, sans-serif' }}>{fmt(income,{noDecimals:true})}</div>
        </div>
        <div>
          <div style={{ fontSize:11, color: isDark ? '#B8C2D1' : '#667085' }}>Expenses</div>
          <div style={{ fontSize:13.5, fontWeight:800, color:pink, fontFamily:'Inter, sans-serif' }}>{fmt(expense,{noDecimals:true})}</div>
        </div>
        <div>
          <div style={{ fontSize:11, color: isDark ? '#B8C2D1' : '#667085' }}>Net Savings</div>
          <div style={{ fontSize:13.5, fontWeight:800, color:blue, fontFamily:'Inter, sans-serif' }}>{net>=0?'':'−'}{fmt(Math.abs(net),{noDecimals:true})}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CustomSelect — silky smooth replacement for native <select>
   options: [{ value, label, emoji?, color?, sub? }]
───────────────────────────────────────────────────────────────────────── */
function CustomSelect({ value, onChange, options = [], placeholder = 'Select…' }) {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState('');
  const ref               = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options;

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width:'100%', display:'flex', alignItems:'center', gap:8,
        padding:'10px 13px', borderRadius:10, boxSizing:'border-box',
        border: open ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
        background:'var(--surface2)', color:'var(--text)', fontSize:14,
        cursor:'pointer', outline:'none', justifyContent:'space-between',
        transition:'border-color .15s, box-shadow .15s',
        boxShadow: open ? '0 0 0 3px var(--accent-light)' : 'none',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
          {selected?.emoji && (
            <span style={{ width:24, height:24, borderRadius:7, background: selected.color ? `${selected.color}22` : 'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
              {selected.emoji}
            </span>
          )}
          <div style={{ minWidth:0 }}>
            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight: selected ? 600 : 400, color: selected ? 'var(--text)' : 'var(--text3)', textAlign:'left', fontSize:13.5 }}>
              {selected ? selected.label : placeholder}
            </div>
            {selected?.sub && <div style={{ fontSize:11, color:'var(--text3)', textAlign:'left', marginTop:1 }}>{selected.sub}</div>}
          </div>
        </div>
        <ChevronDown size={13} color="var(--text3)" style={{ flexShrink:0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform .2s' }}/>
      </button>

      {/* Floating panel */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
          background:'var(--surface)', border:'1.5px solid var(--border)',
          borderRadius:14, boxShadow:'0 16px 48px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.08)',
          zIndex:1002, overflow:'hidden',
          animation:'dropFade .14s ease',
        }}>
          {options.length > 5 && (
            <div style={{ padding:'10px 10px 6px', borderBottom:'1px solid var(--border-light)' }}>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search…" onClick={e => e.stopPropagation()}
                style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:12.5, outline:'none', boxSizing:'border-box' }}/>
            </div>
          )}
          <div style={{ maxHeight:220, overflowY:'auto', padding:6, scrollbarWidth:'thin' }}>
            {/* "None" option */}
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQ(''); }}
              style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:9, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontSize:13, transition:'background .1s',
                background: !value ? 'var(--accent-light)' : 'transparent',
                color: !value ? 'var(--accent)' : 'var(--text3)',
              }}>
              <span style={{ width:24, height:24, borderRadius:7, background:'var(--surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>—</span>
              {placeholder}
            </button>
            {filtered.map(o => {
              const isSel = String(o.value) === String(value);
              return (
                <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                  style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:9, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontSize:13, transition:'background .1s',
                    background: isSel ? 'var(--accent-light)' : 'transparent',
                    color:      isSel ? 'var(--accent)'       : 'var(--text)',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='var(--surface2)'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent'; }}>
                  {o.emoji !== undefined && (
                    <span style={{ width:24, height:24, borderRadius:7, background: o.color ? `${o.color}22` : 'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                      {o.emoji || ''}
                    </span>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.label}</div>
                    {o.sub && <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>{o.sub}</div>}
                  </div>
                  {isSel && <span style={{ color:'var(--accent)', fontSize:15, flexShrink:0 }}>✓</span>}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding:'14px', textAlign:'center', fontSize:13, color:'var(--text3)' }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   InlineCategoryCell — click-to-edit category badge in the table
───────────────────────────────────────────────────────────────────────── */
function InlineCategoryCell({ tx, categories, onSave, catColor }) {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const ref               = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const typeCats = (categories || []).filter(c => c.type === tx.type || c.type === 'both');

  const handleSelect = async (catId) => {
    if (saving) return;
    setSaving(true);
    try { await onSave(tx.id, catId); } catch (e) {}
    setSaving(false);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-block' }}>
      <button type="button" onClick={() => !saving && setOpen(o => !o)}
        title="Click to change category"
        style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px 4px 7px', borderRadius:14, border:'1.5px solid transparent', cursor: saving ? 'wait' : 'pointer',
          background: catColor.bg, color: catColor.color, fontSize:11.5, fontWeight:700,
          transition:'all .15s', opacity: saving ? 0.6 : 1,
          outline:'none',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor=catColor.color+'55'}
        onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
        {tx.category_emoji && <span style={{ fontSize:12 }}>{tx.category_emoji}</span>}
        <span>{saving ? '…' : (tx.category_name || 'No Category')}</span>
        <ChevronDown size={9} style={{ opacity:0.65, transform: open ? 'rotate(180deg)' : '', transition:'transform .2s' }}/>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, width:230,
          background:'var(--surface)', border:'1.5px solid var(--border)',
          borderRadius:14, boxShadow:'0 16px 48px rgba(0,0,0,.2), 0 4px 12px rgba(0,0,0,.1)',
          zIndex:1003, overflow:'hidden',
          animation:'dropFade .14s ease',
        }}>
          <div style={{ padding:'10px 14px 7px', borderBottom:'1px solid var(--border-light)', fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em' }}>
            Change Category
          </div>
          <div style={{ maxHeight:210, overflowY:'auto', padding:6, scrollbarWidth:'thin' }}>
            <button type="button" onClick={() => handleSelect(null)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontSize:12.5, textAlign:'left',
                background: !tx.category_id ? 'var(--accent-light)' : 'transparent',
                color: !tx.category_id ? 'var(--accent)' : 'var(--text3)',
              }}>
              <span style={{ width:22, height:22, borderRadius:6, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>—</span>
              No Category
            </button>
            {typeCats.map(c => {
              const isSel = String(c.id) === String(tx.category_id);
              return (
                <button key={c.id} type="button" onClick={() => handleSelect(c.id)}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:9, border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontSize:12.5, textAlign:'left', transition:'background .1s',
                    background: isSel ? 'var(--accent-light)' : 'transparent',
                    color:      isSel ? 'var(--accent)'       : 'var(--text)',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='var(--surface2)'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent'; }}>
                  <span style={{ width:22, height:22, borderRadius:6, background:`${c.color||'#1D4ED8'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{c.emoji}</span>
                  <span style={{ fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                  {isSel && <span style={{ color:'var(--accent)', fontSize:13, flexShrink:0 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Transactions() {
  const qc = useQueryClient();
  const fmt = useFmt();
  const t = useT();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState({ type: 'all', search: '' });
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx]   = useState(null);
  const [addType, setAddType] = useState(null); // pre-selected type from FAB
  const [showSearch, setShowSearch] = useState(false);
  const [billModalTx, setBillModalTx] = useState(null); // { id, description }
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open add modal when navigated from the FAB with ?add=income|expense|transfer,
  // or pre-fill search when arriving from the dashboard search (?search=…)
  useEffect(() => {
    const type = searchParams.get('add');
    const q = searchParams.get('search');
    if (type && ['income','expense','transfer'].includes(type)) {
      setEditTx(null);
      setAddType(type);
      setShowModal(true);
      setSearchParams({}, { replace: true });
    } else if (q) {
      setFilters(f => ({ ...f, search: q }));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  /* ── Date filter: Monthly / Weekly ── */
  const now = new Date();
  const [dateMode, setDateMode] = useState('monthly'); // 'monthly' | 'weekly'

  // Monthly state
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1); // 1-based; 0 = all months

  // Weekly state — <input type="week"> value like "2026-W21"
  const [selWeek, setSelWeek] = useState(() => {
    // Compute current ISO week string
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const wk = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
  });

  /* Convert week string "YYYY-Www" → {start_date, end_date} (Mon–Sun inclusive, end exclusive) */
  function weekToRange(weekStr) {
    const [yr, wk] = weekStr.split('-W').map(Number);
    const jan4 = new Date(yr, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (wk - 1) * 7);
    const nextMon = new Date(monday); nextMon.setDate(monday.getDate() + 7);
    const fmt = d => d.toISOString().split('T')[0];
    return { start_date: fmt(monday), end_date: fmt(nextMon) };
  }

  /* Build dateParams for the API */
  const dateParams = useMemo(() => {
    if (dateMode === 'weekly') return weekToRange(selWeek);
    if (selMonth > 0) {
      const sd = `${selYear}-${String(selMonth).padStart(2,'0')}-01`;
      const ed = selMonth === 12
        ? `${selYear + 1}-01-01`
        : `${selYear}-${String(selMonth + 1).padStart(2,'0')}-01`;
      return { start_date: sd, end_date: ed };
    }
    return { start_date: `${selYear}-01-01`, end_date: `${selYear + 1}-01-01` };
  }, [dateMode, selWeek, selYear, selMonth]);

  /* Human-readable period label */
  const periodLabel = useMemo(() => {
    if (dateMode === 'weekly') {
      const { start_date, end_date } = weekToRange(selWeek);
      const s = new Date(start_date + 'T00:00:00');
      const e = new Date(end_date   + 'T00:00:00'); e.setDate(e.getDate() - 1); // inclusive Sunday
      const opts = { month: 'short', day: 'numeric' };
      return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    }
    return selMonth > 0
      ? `${MONTHS_FULL[selMonth - 1]} ${selYear}`
      : `All of ${selYear}`;
  }, [dateMode, selWeek, selYear, selMonth]);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, filters, dateMode, selYear, selMonth, selWeek],
    queryFn: () => transactionsAPI.getAll({
      page, limit: LIMIT,
      search: filters.search || undefined,
      type:   filters.type === 'all' ? undefined : filters.type,
      ...dateParams,
    }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => transactionsAPI.delete(id),
    onSuccess:  () => { track('transaction_deleted'); invalidateFinance(qc); },
  });

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const bulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkDeleting(true);
    for (const id of selectedIds) {
      await transactionsAPI.delete(id).catch(() => {});
    }
    setSelectedIds(new Set());
    setBulkDeleting(false);
    // Bulk destructive change → drop cached copies outright so nothing stale
    // can be re-served from the persisted localStorage snapshot.
    resetFinance(qc);
  };

  const patchCatMutation = useMutation({
    mutationFn: ({ txId, catId }) => transactionsAPI.update(txId, { category_id: catId || null }),
    onSuccess:  () => { track('transaction_category_changed'); invalidateFinance(qc); },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getAll().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  /* 6-month sparkline trend (always full history, not filtered) */
  const { data: trendTx } = useQuery({
    queryKey: ['tx-trend'],
    queryFn: () => transactionsAPI.getAll({ limit: 1000 }).then(r => r.data.data || []),
    staleTime: 5 * 60 * 1000,
  });

  const { incomeTrend, expenseTrend, netTrend } = useMemo(() => {
    const inc = [], exp = [], net = [];
    const _now = new Date();
    for (let i = 5; i >= 0; i--) {
      const yr = _now.getFullYear(), mo = _now.getMonth() - i;
      const start = new Date(yr, mo, 1);
      const end   = new Date(yr, mo + 1, 0, 23, 59, 59);
      const slice = (trendTx || []).filter(tx => {
        const d = new Date(tx.transaction_date); return d >= start && d <= end;
      });
      const i_ = slice.filter(tx => tx.type === 'income') .reduce((s, tx) => s + parseFloat(tx.amount||0), 0);
      const e_ = slice.filter(tx => tx.type === 'expense').reduce((s, tx) => s + parseFloat(tx.amount||0), 0);
      inc.push(i_); exp.push(e_); net.push(Math.max(0, i_ - e_));
    }
    return { incomeTrend: inc, expenseTrend: exp, netTrend: net };
  }, [trendTx]);

  const txList     = data?.data || [];
  const pagination = data?.pagination || {};
  const totalIncome  = txList.filter(tx => tx.type === 'income') .reduce((s,tx) => s + parseFloat(tx.amount||0), 0);
  const totalExpense = txList.filter(tx => tx.type === 'expense').reduce((s,tx) => s + parseFloat(tx.amount||0), 0);
  const grouped = groupByMonth(txList);

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const openAdd  = () => { setEditTx(null); setShowModal(true); };
  const openEdit = (tx) => { setEditTx(tx);  setShowModal(true); };

  const [exporting, setExporting] = useState(false);
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await transactionsAPI.exportCSV(dateParams);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tracksy-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      track('transactions_exported');
    } catch(e) {
      alert('Export failed. Please try again.');
    }
    setExporting(false);
  };

  return (
    <div className={styles.page}>

      {/* ── Desktop Topbar ── */}
      <div className={styles.desktopOnly}>
        <Topbar title={t('tx_title')} subtitle={t('tx_subtitle')} showSearch={false}>
          <button className="btn btn-ghost btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={handleExportCSV} disabled={exporting}>
            <Upload size={13}/> {exporting ? 'Exporting…' : t('tx_export')}
          </button>
          <button className="btn btn-primary btn-sm"
            style={{ display:'flex', alignItems:'center', gap:6, background:'#1D4ED8', border:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}
            onClick={openAdd}>
            <Plus size={13}/> {t('tx_add')}
          </button>
        </Topbar>
      </div>

      {/* ── Date Filter Bar (shared desktop + mobile) ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'9px 28px',
        background:'var(--surface)', borderBottom:'1px solid var(--border-light)',
        flexWrap:'wrap', rowGap:8,
      }} className={styles.txDateBar}>
        <Calendar size={14} color="var(--text3)" style={{ flexShrink:0 }}/>

        {/* Monthly / Weekly mode toggle */}
        <div style={{ display:'flex', background:'var(--surface2)', borderRadius:10, padding:3, gap:3, flexShrink:0 }}>
          {[{ key:'monthly', labelKey:'tx_monthly' }, { key:'weekly', labelKey:'tx_weekly' }].map(({ key, labelKey }) => (
            <button key={key}
              onClick={() => { setDateMode(key); setPage(1); }}
              style={{
                padding:'4px 12px', borderRadius:8, fontSize:12, fontWeight:700, border:'none', cursor:'pointer',
                background: dateMode === key ? 'var(--accent)' : 'transparent',
                color:      dateMode === key ? '#fff'           : 'var(--text3)',
                transition:'all .15s',
              }}>
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Monthly controls */}
        {dateMode === 'monthly' && (
          <>
            <div style={{ width:96 }}>
              <ThemedSelect compact value={selYear} onChange={v => { setSelYear(Number(v)); setPage(1); }}
                options={YEARS.map(y => ({ value:y, label:String(y) }))}/>
            </div>
            <div style={{ width:140 }}>
              <ThemedSelect compact value={selMonth} onChange={v => { setSelMonth(Number(v)); setPage(1); }}
                options={[{ value:0, label:t('tx_all_months') }, ...MONTHS_FULL.map((m, i) => ({ value:i+1, label:m }))]}/>
            </div>
          </>
        )}

        {/* Weekly control */}
        {dateMode === 'weekly' && (
          <input
            type="week"
            value={selWeek}
            onChange={e => { setSelWeek(e.target.value); setPage(1); }}
            style={{
              padding:'5px 10px', borderRadius:10, border:'1.5px solid var(--border)',
              background:'var(--surface)', color:'var(--text)', fontSize:12.5, fontWeight:600,
              cursor:'pointer', outline:'none',
            }}
          />
        )}

        {/* Period label */}
        <span style={{ marginLeft:'auto', fontSize:11.5, color:'var(--accent)', fontWeight:700,
          background:'var(--accent-light)', borderRadius:8, padding:'3px 10px', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <Calendar size={10}/> {periodLabel}
        </span>
      </div>

      {/* ── Mobile Header ── */}
      <div className={styles.mobileHeader}>
        <div className={styles.mobileHeaderRow}>
          <h1 className={styles.mobileTitle}>{t('tx_title')}</h1>
          <button className={styles.mobileDownload} onClick={openAdd}>
            <Plus size={20} color="#1D4ED8"/>
          </button>
        </div>

        {/* Search */}
        <div className={styles.mobileSearch}>
          <Search size={16} color="var(--text3)" style={{ flexShrink:0 }}/>
          <input
            placeholder={t('tx_search')}
            value={filters.search}
            onChange={e => { setFilters(f => ({...f, search: e.target.value})); setPage(1); }}
            className={styles.mobileSearchInput}
          />
          <SlidersHorizontal size={16} color="var(--text3)" style={{ flexShrink:0 }}/>
        </div>

        {/* Filter chips */}
        <div className={styles.filterChips}>
          {['all','income','expense','transfer'].map(type => (
            <button key={type}
              onClick={() => { setFilters(f => ({...f, type})); setPage(1); }}
              className={`${styles.chip} ${filters.type === type ? styles.chipActive : ''}`}>
              {type === 'all' ? t('tx_all') : type === 'income' ? t('tx_income') : type === 'expense' ? t('tx_expense') : `🔄 ${t('tx_transfer')}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile spend summary (reference design) ── */}
      <div className="show-mobile-only">
        <TxSummaryCard txList={txList} fmt={fmt} isDark={isDark} periodLabel={periodLabel}/>
      </div>

      <div className={styles.content}>

        {/* ── Desktop filters ── */}
        <div className={styles.desktopFilters}>
          <div style={{ display:'flex', gap:6 }}>
            {['all','income','expense','transfer'].map(type => (
              <button key={type} onClick={() => { setFilters(f=>({...f,type})); setPage(1); }}
                style={{
                  padding:'7px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer',
                  border: filters.type===type ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  background: filters.type===type ? 'var(--accent-light)' : 'var(--surface)',
                  color: filters.type===type ? 'var(--accent)' : 'var(--text3)',
                  textTransform:'capitalize', transition:'all .15s',
                }}>
                {type === 'all' ? t('tx_all') : type === 'income' ? t('tx_income') : type === 'expense' ? t('tx_expense') : `🔄 ${t('tx_transfer')}`}
              </button>
            ))}
          </div>
          <input
            placeholder={t('tx_search')}
            value={filters.search}
            onChange={e => { setFilters(f=>({...f,search:e.target.value})); setPage(1); }}
            style={{ height:38, padding:'0 14px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, outline:'none', minWidth:220 }}
          />
          {pagination.total > 0 && (
            <span style={{ fontSize:12, color:'var(--text3)', marginLeft:'auto', fontWeight:500 }}>
              {pagination.total} {pagination.total!==1 ? t('tx_count_pl') : t('tx_count')}
            </span>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding:48, display:'flex', justifyContent:'center' }}><PageLoader /></div>
        ) : (
          <>
            {/* ── DESKTOP: table view ── */}
            <div className={`${styles.desktopOnly} ${styles.tableCard}`}>
              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 18px', background:'rgba(220,38,38,.07)', borderBottom:'1px solid rgba(220,38,38,.15)' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
                    {selectedIds.size} selected
                  </span>
                  <div style={{ flex:1 }} />
                  <button onClick={() => setSelectedIds(new Set())}
                    style={{ padding:'6px 14px', borderRadius:9, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                    Deselect All
                  </button>
                  <button onClick={bulkDelete} disabled={bulkDeleting}
                    style={{ padding:'6px 16px', borderRadius:9, border:'none', background:'#DC2626', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', opacity: bulkDeleting ? .6 : 1 }}>
                    {bulkDeleting ? '⏳ Deleting…' : `🗑 Delete ${selectedIds.size}`}
                  </button>
                </div>
              )}
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'var(--surface2)' }}>
                      {/* Select-all checkbox */}
                      <th style={{ padding:'14px 10px 14px 18px', borderBottom:'1px solid var(--border-light)', width:36 }}>
                        <input type="checkbox"
                          checked={txList.length > 0 && txList.every(tx => selectedIds.has(tx.id))}
                          onChange={e => setSelectedIds(e.target.checked ? new Set(txList.map(t => t.id)) : new Set())}
                          style={{ width:15, height:15, cursor:'pointer', accentColor:'#1D4ED8' }}
                        />
                      </th>
                      {[t('tx_col_date'),t('tx_col_amount'),t('tx_col_name'),t('tx_col_wallet'),t('tx_col_category'),t('tx_col_status'),''].map(h => (
                        <th key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'left', padding:'14px 18px', borderBottom:'1px solid var(--border-light)', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txList.map(tx => {
                      const isTransfer = tx.type === 'transfer';
                      const isOut      = tx.transfer_direction === 'out';
                      const catColor   = isTransfer
                        ? { bg:'rgba(59,130,246,.1)', color:'#3B82F6' }
                        : (CAT_COLORS[tx.category_name] || { bg:'var(--accent-light)', color:'var(--accent)' });
                      const amtColor = isTransfer
                        ? (isOut ? '#DC2626' : '#047857')
                        : tx.type === 'income' ? '#047857' : '#DC2626';
                      const amtPrefix = isTransfer ? (isOut ? '−' : '+') : tx.type === 'income' ? '+' : '−';
                      return (
                        <tr key={tx.id}
                          onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background=selectedIds.has(tx.id)?'rgba(29,78,216,.06)':''}
                          style={{ transition:'background .1s', cursor:'default', background: selectedIds.has(tx.id) ? 'rgba(29,78,216,.06)' : '' }}>
                          <td style={{ padding:'13px 10px 13px 18px', borderBottom:'1px solid var(--border-light)', width:36 }}>
                            <input type="checkbox" checked={selectedIds.has(tx.id)}
                              onChange={() => toggleSelect(tx.id)}
                              style={{ width:15, height:15, cursor:'pointer', accentColor:'#1D4ED8' }}
                            />
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text3)', whiteSpace:'nowrap' }}>
                            {new Date(tx.transaction_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)', fontWeight:700, color:amtColor, fontFamily:'Inter, sans-serif', fontSize:13.5 }}>
                            {amtPrefix}{fmt(parseFloat(tx.amount))}
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              {isTransfer ? (
                                <div style={{ width:34, height:34, borderRadius:10, background:'rgba(59,130,246,.13)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>🔄</div>
                              ) : (tx.description || tx.payment_name) ? (
                                <MerchantLogo name={tx.description || tx.payment_name} size={34}/>
                              ) : (
                                <CategoryIcon name={tx.category_name||''} emoji={tx.category_emoji} size={34} iconSize={15}/>
                              )}
                              <div>
                                <div style={{ fontWeight:600, fontSize:13.5, color:'var(--text)' }}>{tx.description || tx.payment_name}</div>
                                {isTransfer ? (
                                  <div style={{ fontSize:11, color:'#3B82F6', marginTop:1, fontWeight:600 }}>
                                    {isOut ? t('tx_sent') : t('tx_received')} · {tx.wallet_name}{tx.last_four ? ` *${tx.last_four}` : ''}
                                  </div>
                                ) : tx.payment_name && tx.description ? (
                                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:1, fontFamily:'Inter, sans-serif', letterSpacing:0 }}>Ref: {tx.payment_name}</div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text2)', fontWeight:500, whiteSpace:'nowrap' }}>
                            {tx.wallet_name}{tx.last_four ? ` *${tx.last_four}` : ''}
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)' }}>
                            {isTransfer ? (
                              <span style={{ fontSize:11.5, fontWeight:700, padding:'4px 10px', borderRadius:14, background:'rgba(59,130,246,.12)', color:'#3B82F6' }}>
                                🔄 Transfer
                              </span>
                            ) : (
                              <InlineCategoryCell
                                tx={tx}
                                categories={categories}
                                catColor={catColor}
                                onSave={(txId, catId) => patchCatMutation.mutateAsync({ txId, catId })}
                              />
                            )}
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)' }}>
                            <StatusChip status={tx.status}/>
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)' }}>
                            {deleteConfirmId === tx.id ? (
                              <div style={{ display:'flex', alignItems:'center', gap:6, animation:'dropFade .15s ease' }}>
                                <span style={{ fontSize:11.5, color:'var(--text3)', whiteSpace:'nowrap' }}>Delete?</span>
                                <button onClick={() => { deleteMutation.mutate(tx.id); setDeleteConfirmId(null); }}
                                  style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'#DC2626', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                                  Yes
                                </button>
                                <button onClick={() => setDeleteConfirmId(null)}
                                  style={{ padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text3)', fontSize:12, cursor:'pointer' }}>
                                  No
                                </button>
                              </div>
                            ) : (
                              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                {!isTransfer && (
                                  <button onClick={() => openEdit(tx)}
                                    style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', padding:'5px 8px', fontSize:12, color:'var(--text3)' }}
                                    title="Edit">✏️</button>
                                )}
                                <button onClick={() => setBillModalTx(tx)}
                                  style={{ background:'rgba(29,78,216,.1)', border:'1px solid rgba(29,78,216,.2)', borderRadius:8, cursor:'pointer', padding:'5px 8px', fontSize:12, color:'#1D4ED8', display:'flex', alignItems:'center', gap:3 }}
                                  title="Attach Bill">
                                  <Paperclip size={12}/>
                                </button>
                                <BillBadge txId={tx.id} onClick={() => setBillModalTx(tx)}/>
                                <button onClick={() => setDeleteConfirmId(tx.id)}
                                  style={{ background:'var(--red-light)', border:'1px solid rgba(220,38,38,.2)', borderRadius:8, cursor:'pointer', padding:'5px 8px', fontSize:12 }}
                                  title="Delete">🗑️</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!txList.length && (
                      <tr><td colSpan={7}>
                        <EmptyState icon="💳" title={t('tx_no_tx')} description={t('tx_no_tx_desc')} />
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {pagination.pages > 1 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'16px 20px', borderTop:'1px solid var(--border-light)' }}>
                  <button disabled={page===1} onClick={() => setPage(p=>p-1)}
                    style={{ padding:'7px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor:page===1?'not-allowed':'pointer', border:'1.5px solid var(--border)', background:'var(--surface)', color:page===1?'var(--text3)':'var(--text)', opacity:page===1?.5:1 }}>
                    {t('tx_prev')}
                  </button>
                  <span style={{ fontSize:13, color:'var(--text3)', fontWeight:500 }}>{t('tx_page')} {page} {t('tx_page_of')} {pagination.pages}</span>
                  <button disabled={page===pagination.pages} onClick={() => setPage(p=>p+1)}
                    style={{ padding:'7px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor:page===pagination.pages?'not-allowed':'pointer', border:'1.5px solid var(--border)', background:'var(--surface)', color:page===pagination.pages?'var(--text3)':'var(--text)', opacity:page===pagination.pages?.5:1 }}>
                    {t('tx_next')}
                  </button>
                </div>
              )}
            </div>

            {/* ── MOBILE: grouped list view ── */}
            <div className={styles.mobileList}>
              {/* Mobile bulk bar */}
              {txList.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--surface)', borderBottom:'1px solid var(--border-light)', position:'sticky', top:0, zIndex:5 }}>
                  <input type="checkbox"
                    checked={txList.every(tx => selectedIds.has(tx.id))}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(txList.map(t => t.id)) : new Set())}
                    style={{ width:16, height:16, cursor:'pointer', accentColor:'#1D4ED8' }}
                  />
                  <span style={{ fontSize:12.5, fontWeight:600, color:'var(--text3)' }}>
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                  </span>
                  {selectedIds.size > 0 && (
                    <>
                      <div style={{ flex:1 }} />
                      <button onClick={bulkDelete} disabled={bulkDeleting}
                        style={{ padding:'6px 14px', borderRadius:9, border:'none', background:'#DC2626', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
                        {bulkDeleting ? '⏳' : `🗑 Delete ${selectedIds.size}`}
                      </button>
                    </>
                  )}
                </div>
              )}
              {!txList.length && (
                <EmptyState icon="💳" title={t('tx_no_tx')} description={t('tx_no_tx_desc')} />
              )}
              {grouped.map(group => (
                <div key={group.label} className={styles.monthGroup}>
                  {/* Day header — "Today · Total Spent ₹2,450 ⌄" */}
                  <div className={styles.monthHeader}>
                    <span className={styles.monthLabel}>{group.label}</span>
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12, color:'var(--text3)', fontWeight:500 }}>
                        {group.expense > 0 ? 'Total Spent' : 'Total In'}
                      </span>
                      <span className={styles.monthTotal} style={{ color:'var(--text)' }}>
                        {group.expense > 0 ? fmt(group.expense,{noDecimals:true}) : fmt(group.income,{noDecimals:true})}
                      </span>
                      <ChevronDown size={14} color="var(--text3)"/>
                    </span>
                  </div>

                  {/* Transaction cards */}
                  <div className={styles.txGroup}>
                    {group.items.map((tx, idx) => {
                      const isTransfer = tx.type === 'transfer';
                      const isOut      = tx.transfer_direction === 'out';
                      const isIncome   = tx.type === 'income';
                      const catColor   = isTransfer
                        ? { bg:'rgba(59,130,246,.13)', color:'#3B82F6' }
                        : (CAT_COLORS[tx.category_name] || { bg:'rgba(29,78,216,.1)', color:'var(--accent)' });
                      const circleColor = isTransfer ? 'rgba(59,130,246,.13)' : isIncome ? 'rgba(4,120,87,.15)' : 'rgba(29,78,216,.13)';
                      const iconColor   = isTransfer ? '#3B82F6' : isIncome ? '#047857' : '#1D4ED8';
                      const amtColor    = isTransfer ? (isOut ? 'var(--red)' : 'var(--green)') : isIncome ? 'var(--green)' : 'var(--red)';
                      const amtPrefix   = isTransfer ? (isOut ? '−' : '+') : isIncome ? '+' : '−';
                      const d = new Date(tx.transaction_date);
                      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const isLast = idx === group.items.length - 1;
                      const isConfirming = deleteConfirmId === tx.id;
                      return (
                        <div key={tx.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                          {/* Main row */}
                          <div className={styles.txRow} style={{ borderBottom:'none', background: selectedIds.has(tx.id) ? 'rgba(29,78,216,.06)' : '' }}
                            onClick={() => { if (isConfirming) { setDeleteConfirmId(null); return; } if (!isTransfer) openEdit(tx); }}>
                            {/* Select checkbox */}
                            <input type="checkbox" checked={selectedIds.has(tx.id)}
                              onChange={() => toggleSelect(tx.id)}
                              onClick={e => e.stopPropagation()}
                              style={{ width:15, height:15, cursor:'pointer', accentColor:'#1D4ED8', flexShrink:0, marginRight:4 }}
                            />
                            {/* Icon — merchant logo for named tx, category icon otherwise */}
                            {isTransfer ? (
                              <div className={styles.txCircle} style={{ background:'rgba(59,130,246,.13)' }}>
                                <span style={{ fontSize:15 }}>🔄</span>
                              </div>
                            ) : (tx.description || tx.payment_name) ? (
                              <MerchantLogo name={tx.description || tx.payment_name} size={44}/>
                            ) : (
                              <CategoryIcon name={tx.category_name || ''} emoji={tx.category_emoji} size={44} iconSize={18}/>
                            )}

                            {/* Info */}
                            <div className={styles.txInfo}>
                              <div className={styles.txName}>{tx.description || tx.payment_name || '—'}</div>
                              <div className={styles.txMeta}>
                                <span>{dayLabel}</span>
                                {tx.wallet_name && (
                                  <>
                                    <span className={styles.txDot}>·</span>
                                    <span>{tx.wallet_name}{tx.last_four ? ` *${tx.last_four}` : ''}</span>
                                  </>
                                )}
                                {isTransfer ? (
                                  <>
                                    <span className={styles.txDot}>·</span>
                                    <span style={{ color:'#3B82F6', fontWeight:600 }}>{isOut ? t('tx_sent') : t('tx_received')}</span>
                                  </>
                                ) : tx.category_name && (
                                  <>
                                    <span className={styles.txDot}>·</span>
                                    <span style={{ color: catColor.color }}>{tx.category_emoji} {tx.category_name}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Amount + actions */}
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                              <div className={styles.txAmount} style={{ color: amtColor }}>
                                {amtPrefix}{fmt(parseFloat(tx.amount))}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                <button onClick={e => { e.stopPropagation(); setBillModalTx(tx); }}
                                  style={{ background:'none', border:'none', padding:'2px 4px', cursor:'pointer', fontSize:13, opacity:0.55, lineHeight:1, borderRadius:6, transition:'opacity .15s', display:'flex', alignItems:'center', gap:2, color:'#1D4ED8' }}
                                  onMouseEnter={e => e.currentTarget.style.opacity='1'}
                                  onMouseLeave={e => e.currentTarget.style.opacity='0.55'}
                                  title="Attach Bill">
                                  <Paperclip size={13}/>
                                </button>
                                <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(isConfirming ? null : tx.id); }}
                                  style={{ background:'none', border:'none', padding:'2px 4px', cursor:'pointer', fontSize:13, opacity:0.45, lineHeight:1, borderRadius:6, transition:'opacity .15s' }}
                                  onMouseEnter={e => e.currentTarget.style.opacity='1'}
                                  onMouseLeave={e => e.currentTarget.style.opacity='0.45'}
                                  title="Delete">🗑️</button>
                              </div>
                              <BillBadge txId={tx.id} onClick={() => setBillModalTx(tx)}/>
                            </div>
                          </div>

                          {/* Inline delete confirm bar */}
                          {isConfirming && (
                            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'rgba(220,38,38,.06)', borderTop:'1px solid rgba(220,38,38,.12)', animation:'dropFade .15s ease' }}>
                              <span style={{ flex:1, fontSize:12.5, color:'#DC2626', fontWeight:600 }}>Delete this transaction?</span>
                              <button onClick={() => { deleteMutation.mutate(tx.id); setDeleteConfirmId(null); }}
                                style={{ padding:'6px 14px', borderRadius:9, border:'none', background:'#DC2626', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
                                Delete
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)}
                                style={{ padding:'6px 12px', borderRadius:9, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text3)', fontSize:12.5, cursor:'pointer' }}>
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Load more */}
              {pagination.pages > 1 && page < pagination.pages && (
                <button onClick={() => setPage(p=>p+1)} className={styles.loadMore}>
                  {t('tx_load_more')}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {billModalTx && (
        <BillAttachment
          txId={billModalTx.id}
          txName={billModalTx.description || billModalTx.payment_name || 'Transaction'}
          onClose={() => setBillModalTx(null)}
        />
      )}

      {showModal && (
        <TransactionModal
          tx={editTx}
          initialType={editTx ? undefined : addType}
          onClose={() => { setShowModal(false); setEditTx(null); setAddType(null); }}
          onSaved={() => {
            invalidateFinance(qc);
            invalidateFinance(qc);
            setShowModal(false);
          }}
          onDelete={(id) => {
            deleteMutation.mutate(id);
            invalidateFinance(qc);
            setShowModal(false);
            setEditTx(null);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   NewCategoryInline — quick-create a category without leaving the modal
───────────────────────────────────────────────────────────────────────── */
const QUICK_EMOJIS_EXPENSE = ['🍔','🚗','🏠','🎭','💊','📚','✈️','🛍️','⚡','📱','🎮','☕','🐾','🧴','💇','🎵'];
const QUICK_EMOJIS_INCOME  = ['💰','💼','🎁','📈','🏆','💵','🎯','💳','🤝','🧑‍💻','🏗️','📦'];
const QUICK_COLORS = ['#1D4ED8','#DC2626','#047857','#D97706','#3B82F6','#0D9488','#fd79a8','#60A5FA','#D97706','#047857'];

function NewCategoryInline({ txType, onCreated, onCancel }) {
  const [name,   setName]   = useState('');
  const [emoji,  setEmoji]  = useState('');
  const [color,  setColor]  = useState('#1D4ED8');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const emojiList = txType === 'income' ? QUICK_EMOJIS_INCOME : QUICK_EMOJIS_EXPENSE;

  const handleSave = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    try {
      const res = await categoriesAPI.create({
        name: name.trim(),
        type: txType === 'transfer' ? 'expense' : txType,
        emoji: emoji || '📌',
        color,
      });
      track('category_created');
      onCreated(res.data.data);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create');
      setSaving(false);
    }
  };

  return (
    <div style={{ background:'var(--surface2)', borderRadius:14, padding:'14px 16px', border:'1.5px solid var(--accent)', boxShadow:'0 0 0 3px var(--accent-light)', animation:'dropFade .15s ease' }}>

      {/* Emoji row */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:7 }}>Pick an emoji</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {emojiList.map(e => (
            <button key={e} type="button" onClick={() => setEmoji(e)} style={{
              width:32, height:32, borderRadius:8, fontSize:17, cursor:'pointer',
              border: emoji === e ? '2px solid var(--accent)' : '1.5px solid var(--border)',
              background: emoji === e ? 'var(--accent-light)' : 'var(--surface)',
              transition:'all .12s',
            }}>{e}</button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div style={{ marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {emoji && (
            <div style={{ width:36, height:36, borderRadius:10, background:`${color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
              {emoji}
            </div>
          )}
          <input autoFocus placeholder="Category name…" value={name}
            onChange={e => { setName(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={{ flex:1, padding:'9px 12px', borderRadius:9, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13.5, outline:'none', boxSizing:'border-box' }}/>
        </div>
      </div>

      {/* Color row */}
      <div style={{ display:'flex', gap:6, marginBottom:12, alignItems:'center' }}>
        <span style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginRight:2 }}>Color</span>
        {QUICK_COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)} style={{
            width:22, height:22, borderRadius:'50%', background:c, flexShrink:0, cursor:'pointer',
            border: color === c ? '3px solid var(--text)' : '2px solid transparent',
            transform: color === c ? 'scale(1.2)' : 'scale(1)', transition:'all .12s',
          }}/>
        ))}
      </div>

      {err && <div style={{ fontSize:12, color:'var(--red)', marginBottom:8 }}>{err}</div>}

      {/* Buttons */}
      <div style={{ display:'flex', gap:8 }}>
        <button type="button" onClick={onCancel} style={{ flex:1, padding:'8px', borderRadius:9, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text3)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving || !name.trim()} style={{
          flex:2, padding:'8px', borderRadius:9, border:'none', fontSize:13, fontWeight:700, cursor: saving ? 'wait' : 'pointer',
          background:'linear-gradient(135deg,var(--accent),#3B82F6)', color:'#fff',
          opacity: (!name.trim() || saving) ? 0.55 : 1, transition:'opacity .15s',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          {saving
            ? <><span style={{ animation:'spin .7s linear infinite', display:'inline-block' }}>⟳</span> Creating…</>
            : `✨ Create "${name || 'category'}"`}
        </button>
      </div>
    </div>
  );
}

function TransactionModal({ tx, onClose, onSaved, onDelete, initialType }) {
  const t   = useT();
  const fmt = useFmt();
  const qc  = useQueryClient();

  // Don't allow editing transfer transactions — they're managed as pairs
  const isEditTransfer = tx?.type === 'transfer';
  const isEdit = !!tx && !isEditTransfer;

  /* ── Type ──────────────────────────────────────────────── */
  const [txType, setTxType] = useState(
    initialType || (tx?.type === 'transfer' ? 'expense' : (tx?.type || 'expense'))
  );
  const isTransfer = txType === 'transfer';

  /* ── Payment method (shown only for new transactions) ─── */
  const [payMethod, setPayMethod] = useState(null); // null = not chosen yet

  /* ── Core form fields ─────────────────────────────────── */
  const [amount,   setAmount]   = useState(tx?.amount || '');
  const [payName,  setPayName]  = useState(tx?.payment_name || '');
  const [note,     setNote]     = useState(tx?.description || '');
  const [walletId, setWalletId] = useState(tx?.wallet_id || '');
  const [catId,    setCatId]    = useState(tx?.category_id || '');
  const [status,   setStatus]   = useState(tx?.status || 'completed');
  const [date,     setDate]     = useState(
    tx?.transaction_date ? tx.transaction_date.split('T')[0] : new Date().toISOString().split('T')[0]
  );

  /* ── Transfer fields ──────────────────────────────────── */
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId,   setToWalletId]   = useState('');

  /* ── Credit card interest ─────────────────────────────── */
  const [hasInterest,      setHasInterest]      = useState(false);
  const [interestAmount,   setInterestAmount]   = useState('');
  const [interestCatId,    setInterestCatId]    = useState('');

  const [showNewCat,     setShowNewCat]     = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [savedTxId, setSavedTxId] = useState(null); // after save → show bill step
  const [showBills, setShowBills] = useState(false); // for edit mode

  /* ── Data ─────────────────────────────────────────────── */
  const { data: wallets }    = useQuery({ queryKey:['wallets'],    queryFn:() => walletsAPI.getAll().then(r=>r.data.data) });
  const { data: categories, isLoading: catsLoading } = useQuery({ queryKey:['categories'], queryFn:() => categoriesAPI.getAll().then(r=>r.data.data) });

  /* Show the accounts the user actually added in the Accounts tab.
     Exclude pure loans/lending (you don't spend "from" those). Credit cards
     stay in — you can pay with a card. */
  const NON_PAYABLE = ['home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','bnpl','family_borrow','emi','lending'];
  const allowedWallets = useMemo(() => (wallets || []).filter(w => !NON_PAYABLE.includes(w.type)), [wallets]);

  /* Credit-card detection now comes from the SELECTED account, not a method grid */
  const selectedWallet = (wallets || []).find(w => String(w.id) === String(walletId)) || null;
  const isCreditSelected = selectedWallet && CREDIT_WALLET_TYPES.includes(selectedWallet.type);

  /* Auto-select wallet if only one matches */
  useMemo(() => {
    if (allowedWallets.length === 1 && !walletId && !isEdit) {
      setWalletId(allowedWallets[0].id);
    }
  }, [allowedWallets]);

  /* All wallets of credit-card type */
  const creditWallets = (wallets||[]).filter(w => CREDIT_WALLET_TYPES.includes(w.type));

  /* Find or auto-select CC interest category */
  const ccInterestCat = (categories||[]).find(c =>
    c.name?.toLowerCase().includes('credit card interest') ||
    c.name?.toLowerCase().includes('card interest') ||
    c.name?.toLowerCase().includes('interest')
  );

  /* Set interest cat when it loads */
  useMemo(() => {
    if (ccInterestCat && !interestCatId) setInterestCatId(ccInterestCat.id);
  }, [ccInterestCat]);

  /* filtered expense categories for interest */
  const expenseCats = (categories||[]).filter(c => c.type === 'expense' || c.type === 'both');
  /* filtered cats for main tx */
  const filteredCats = (categories||[]).filter(c => c.type === txType || c.type === 'both');

  const typeColor = isTransfer ? '#3B82F6' : txType === 'income' ? '#047857' : '#DC2626';

  /* ── Submit ───────────────────────────────────────────── */
  const handleSubmit = async () => {
    setError('');
    if (!amount || parseFloat(amount) <= 0) { setError('Please enter a valid amount'); return; }

    if (isTransfer) {
      if (!fromWalletId || !toWalletId) { setError('Please select both source and destination accounts'); return; }
      if (fromWalletId === toWalletId)  { setError('Source and destination must be different'); return; }
    } else if (!walletId && (wallets||[]).length > 0 && (!isEdit || tx?.wallet_id)) {
      setError('Please select the account this was paid from / received in');
      return;
    }

    setSaving(true);
    try {
      const fullPayName = payName || (selectedWallet?.name || '');

      if (isTransfer) {
        await transactionsAPI.create({
          type: 'transfer', amount, description: note,
          payment_name: fullPayName || 'Transfer',
          from_wallet_id: fromWalletId, to_wallet_id: toWalletId,
          status, transaction_date: date,
        });
        track('transaction_added', { tx_type: 'transfer', tx_source: 'manual' });
      } else if (isEdit) {
        await transactionsAPI.update(tx.id, {
          type: txType, amount, description: note, payment_name: payName,
          wallet_id: walletId || null, category_id: catId || null,
          status, transaction_date: date,
        });
        track('transaction_edited', { tx_type: txType });
      } else {
        // New transaction
        const mainPayName = fullPayName || (txType === 'income' ? 'Income' : 'Expense');
        const newTx = await transactionsAPI.create({
          type: txType, amount, description: note, payment_name: mainPayName,
          wallet_id: walletId || null, category_id: catId || null,
          status, transaction_date: date,
        });
        track('transaction_added', { tx_type: txType, tx_source: 'manual' });
        const newTxId = newTx.data?.data?.id || newTx.data?.id;

        // Credit card interest transaction
        if (isCreditSelected && hasInterest && interestAmount && parseFloat(interestAmount) > 0) {
          let intCatId = interestCatId;
          if (!intCatId) {
            try {
              const newCat = await categoriesAPI.create({
                name: 'Credit Card Interest', type: 'expense', emoji: '💳', color: '#DC2626',
              });
              intCatId = newCat.data.data.id;
              qc.invalidateQueries({ queryKey: ['categories'] });
            } catch(e) {}
          }
          await transactionsAPI.create({
            type: 'expense',
            amount: interestAmount,
            payment_name: `${wallets?.find(w=>w.id===walletId)?.name || 'Credit Card'} Interest`,
            description: `Interest charges on ${mainPayName}`,
            wallet_id: walletId || null,
            category_id: intCatId || null,
            status, transaction_date: date,
          });
        }

        invalidateFinance(qc);
        invalidateFinance(qc);
        // Show bill attachment step — don't call onSaved/onClose yet
        if (newTxId) {
          setSavedTxId({ id: newTxId, name: mainPayName || note || 'Transaction' });
          setSaving(false);
          return;
        }
        onSaved?.();
        onClose();
        return;
      }

      invalidateFinance(qc);
      invalidateFinance(qc);
      onSaved?.();
      onClose();
    } catch(e) {
      setError(e.response?.data?.message || 'Error saving transaction');
    } finally {
      setSaving(false);
    }
  };

  const TAB_OPTS = [
    { key:'expense',  label:`📤 ${t('tx_expense')}`,  color:'var(--red)',   activeColor:'rgba(220,38,38,.1)'   },
    { key:'income',   label:`📥 ${t('tx_income')}`,   color:'var(--green)', activeColor:'rgba(4,120,87,.1)'  },
    { key:'transfer', label:`🔄 ${t('tx_transfer')}`, color:'#3B82F6',      activeColor:'rgba(59,130,246,.1)'  },
  ];

  const headerBg = isTransfer
    ? 'rgba(59,130,246,.12)'
    : txType === 'income' ? 'rgba(4,120,87,.12)' : 'rgba(220,38,38,.12)';

  /* Payment-method grid removed — transactions use the user's real accounts directly. */
  const showMethodPicker = false;

  /* ── Styles ───────────────────────────────────────────── */
  const labelSt = { fontSize:11.5, fontWeight:700, color:'var(--text3)', marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'.05em' };
  const inputSt = { width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' };

  /* ── Premium type config ── */
  const TYPE_CFG = {
    expense:  { color:'#DC2626', bg:'rgba(220,38,38,.14)',  border:'rgba(220,38,38,.3)',  gradient:'#DC2626', icon:'📤', label:'Expense'  },
    income:   { color:'#047857', bg:'rgba(4,120,87,.14)',   border:'rgba(4,120,87,.3)',   gradient:'#047857',  icon:'📥', label:'Income'   },
    transfer: { color:'#3B82F6', bg:'rgba(59,130,246,.14)',  border:'rgba(59,130,246,.3)',  gradient:'linear-gradient(135deg,#3B82F6,#60A5FA)',  icon:'🔄', label:'Transfer' },
  };
  const tc = TYPE_CFG[txType] || TYPE_CFG.expense;

  const sheetSt = {
    position:'fixed', bottom:0, left:0, right:0, zIndex:1100,
    background:'var(--surface)', borderRadius:'28px 28px 0 0',
    boxShadow:'0 -12px 60px rgba(0,0,0,.2)',
    height:'auto',
    display:'flex', flexDirection:'column', overflow:'hidden',
  };
  const scrollSt = { flex:1, minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch' };
  const footerSt = {
    flexShrink:0, borderTop:'1px solid var(--border-light)', background:'var(--surface)',
    padding:'12px 20px', paddingBottom:'calc(12px + env(safe-area-inset-bottom,0px))',
  };
  const overlayStyle = {
    position:'fixed', inset:0, zIndex:1099,
    background:'rgba(0,0,0,.45)', backdropFilter:'blur(4px)',
  };
  const fieldLbl = { fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6, display:'block' };
  const fieldIn  = { width:'100%', padding:'12px 14px', borderRadius:14, border:'1.5px solid var(--border-light)', background:'var(--surface2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };

  // Bill attach step — shown after a new transaction is saved
  if (savedTxId) {
    return (
      <BillAttachment
        txId={savedTxId.id}
        txName={savedTxId.name}
        onClose={() => { onSaved?.(); onClose(); }}
        skipLabel="Skip"
      />
    );
  }

  return (
    <>
      {showBills && tx?.id && (
        <BillAttachment
          txId={tx.id}
          txName={tx.description || tx.payment_name || 'Transaction'}
          onClose={() => setShowBills(false)}
        />
      )}
      <div style={overlayStyle} onClick={onClose}/>
      <div className="txSheet" style={sheetSt}>

        {/* Handle */}
        <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'12px auto 0' }}/>

        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', padding:'16px 20px 0', gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:14, background:tc.bg, border:`1.5px solid ${tc.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
            {tc.icon}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--text)', letterSpacing:'-0.3px' }}>
              {isEdit ? 'Edit Transaction' : 'Add Transaction'}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:1 }}>
              {isEdit ? `Editing ${tc.label.toLowerCase()}` : 'Fill in the details below'}
            </div>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:10, background:'var(--surface2)', border:'1.5px solid var(--border-light)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text3)', fontSize:18, lineHeight:1 }}>×</button>
        </div>

        {/* Type selector — premium icon tabs */}
        {!isEdit && (
          <div style={{ display:'flex', gap:8, padding:'16px 20px 0' }}>
            {Object.entries(TYPE_CFG).map(([key, cfg]) => {
              const active = txType === key;
              return (
                <button key={key}
                  onClick={() => { setTxType(key); setPayMethod(null); setWalletId(''); setError(''); setShowNewCat(false); }}
                  style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'12px 8px', borderRadius:16, border:`1.5px solid ${active ? cfg.border : 'var(--border-light)'}`, background: active ? cfg.bg : 'var(--surface2)', cursor:'pointer', transition:'all .15s' }}>
                  <div style={{ width:40, height:40, borderRadius:13, background: active ? cfg.bg : 'var(--surface3)', border:`1.5px solid ${active ? cfg.border : 'transparent'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                    {cfg.icon}
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color: active ? cfg.color : 'var(--text3)' }}>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ margin:'12px 20px 0', background:'rgba(220,38,38,.08)', border:'1.5px solid rgba(220,38,38,.25)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#DC2626', fontWeight:500 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ ...scrollSt, padding:'16px 20px', display:'grid', gap:14, alignContent:'start' }}>

          {/* ══ AMOUNT — big hero input ══ */}
          <div style={{ background:`linear-gradient(135deg,${tc.bg},${tc.bg.replace('.14','.07')})`, border:`1.5px solid ${tc.border}`, borderRadius:14, padding:'20px 20px 16px', textAlign:'center' }}>
            <div style={{ fontSize:11, fontWeight:700, color:tc.color, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Amount</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <span style={{ fontSize:28, fontWeight:900, color:tc.color, fontFamily:'Inter,sans-serif' }}>₹</span>
              <input
                type="number" step="0.01" placeholder="0.00"
                value={amount} onChange={e=>setAmount(e.target.value)}
                autoFocus
                style={{ fontSize:36, fontWeight:900, color:tc.color, border:'none', background:'transparent', outline:'none', textAlign:'center', width:'100%', fontFamily:'Inter,sans-serif', caretColor:tc.color }}
              />
            </div>
          </div>

          {/* ══ TRANSFER FLOW ══ */}
          {isTransfer ? (<>
            <div>
              <label style={fieldLbl}>From Account</label>
              <CustomSelect value={fromWalletId} onChange={setFromWalletId} placeholder="Select source account"
                options={(wallets||[]).map(w => ({ value:w.id, label:`${w.name}${w.last_four?` *${w.last_four}`:''}`, sub:`Balance: ${fmt(w.balance||0)}` }))}/>
            </div>
            <div>
              <label style={fieldLbl}>To Account</label>
              <CustomSelect value={toWalletId} onChange={setToWalletId} placeholder="Select destination account"
                options={(wallets||[]).filter(w=>w.id!==fromWalletId).map(w => ({ value:w.id, label:`${w.name}${w.last_four?` *${w.last_four}`:''}`, emoji: CREDIT_WALLET_TYPES.includes(w.type)?'💳':undefined, sub:`Balance: ${fmt(w.balance||0)}` }))}/>
            </div>
            {CREDIT_WALLET_TYPES.includes((wallets||[]).find(w=>w.id===toWalletId)?.type) && (
              <div style={{ display:'flex', gap:10, background:'rgba(217,119,6,.08)', border:'1.5px solid rgba(217,119,6,.25)', borderRadius:14, padding:'12px 14px' }}>
                <span style={{ fontSize:20 }}>💳</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#D97706' }}>Credit Card Bill Payment</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Clears the credit card balance from your bank account.</div>
                </div>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={fieldLbl}>Status</label>
                <CustomSelect value={status} onChange={setStatus} placeholder="Status"
                  options={[{value:'completed',label:'Completed',emoji:'✅'},{value:'pending',label:'Pending',emoji:'⏳'},{value:'failed',label:'Failed',emoji:'❌'}]}/>
              </div>
              <div><label style={fieldLbl}>Date</label><input style={fieldIn} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            </div>
            <div><label style={fieldLbl}>Note (optional)</label><input style={fieldIn} placeholder="Transfer description…" value={note} onChange={e=>setNote(e.target.value)}/></div>
          </>) : (<>

            {/* ══ INCOME / EXPENSE FLOW ══ */}

            {(<>

              {/* Merchant / source name */}
              <div>
                <label style={fieldLbl}>{txType==='income' ? 'Income Source' : 'Merchant / Payee'}</label>
                <input style={fieldIn} placeholder={txType==='income' ? 'e.g. Salary, Freelance…' : 'e.g. Swiggy, Amazon…'} value={payName} onChange={e=>setPayName(e.target.value)}/>
              </div>

              {/* Category grid — visual icons */}
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <label style={{ ...fieldLbl, marginBottom:0 }}>Category</label>
                  <button type="button" onClick={() => setShowNewCat(v=>!v)}
                    style={{ fontSize:11, fontWeight:700, color: showNewCat ? '#DC2626' : 'var(--accent)', background: showNewCat ? 'rgba(220,38,38,.08)' : 'var(--accent-light)', border:'none', borderRadius:8, padding:'4px 10px', cursor:'pointer' }}>
                    {showNewCat ? '✕ Cancel' : '+ New'}
                  </button>
                </div>
                {showNewCat ? (
                  <NewCategoryInline txType={txType} onCancel={() => setShowNewCat(false)}
                    onCreated={cat => { setCatId(cat.id); setShowNewCat(false); qc.invalidateQueries({ queryKey:['categories'] }); }}/>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, maxHeight:224, overflowY:'auto', paddingRight:2, scrollbarWidth:'thin' }}>
                    {catsLoading && filteredCats.length === 0 && (
                      <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'18px 8px', fontSize:12.5, color:'var(--text3)' }}>Loading categories…</div>
                    )}
                    {!catsLoading && filteredCats.length === 0 && (
                      <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'18px 8px', fontSize:12.5, color:'var(--text3)' }}>
                        No categories yet — tap “+ New” to add one.
                      </div>
                    )}
                    {filteredCats.map(c => {
                      const sel = catId === c.id;
                      const col = c.color || '#1D4ED8';
                      return (
                        <button key={c.id} onClick={() => setCatId(sel ? '' : c.id)}
                          style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 6px', borderRadius:14, border:`1.5px solid ${sel ? col+'60' : 'var(--border-light)'}`, background: sel ? col+'18' : 'var(--surface2)', cursor:'pointer', transition:'all .15s', gap:5 }}>
                          <div style={{ width:36, height:36, borderRadius:11, background: sel ? col+'25' : 'var(--surface3)', border:`1.5px solid ${sel ? col+'50' : 'transparent'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>
                            <CategoryGlyph name={c.name} emoji={c.emoji} icon={c.icon} size={18}/>
                          </div>
                          <span style={{ fontSize:10, fontWeight:700, color: sel ? col : 'var(--text3)', textAlign:'center', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%' }}>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Account */}
              <div>
                <label style={fieldLbl}>
                  {isCreditSelected ? 'Credit Card' : txType==='income' ? 'Credited To' : 'Paid From'}
                </label>
                {allowedWallets.length === 0 ? (
                  <div style={{ background:'rgba(217,119,6,.08)', border:'1.5px solid rgba(217,119,6,.25)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#D97706' }}>
                    ⚠️ No matching account. Add one in Accounts first.
                  </div>
                ) : (
                  <CustomSelect value={walletId} onChange={setWalletId} placeholder="Select account"
                    options={allowedWallets.map(w => ({ value:w.id, label:`${w.name}${w.last_four?` *${w.last_four}`:''}`, sub:`Balance: ${fmt(w.balance||0)}` }))}/>
                )}
              </div>

              {/* Credit card interest toggle */}
              {isCreditSelected && walletId && (
                <div style={{ background:'rgba(220,38,38,.06)', border:'1.5px solid rgba(220,38,38,.18)', borderRadius:16, padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <div style={{ width:36, height:36, borderRadius:11, background:'rgba(220,38,38,.12)', border:'1.5px solid rgba(220,38,38,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>💳</div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Add Interest Charges?</div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>Logged as separate expense</div>
                      </div>
                    </div>
                    <div onClick={() => setHasInterest(h=>!h)} style={{ width:44, height:24, borderRadius:12, cursor:'pointer', transition:'background .2s', background: hasInterest ? '#DC2626' : 'var(--surface3)', position:'relative', flexShrink:0 }}>
                      <div style={{ position:'absolute', top:4, left: hasInterest ? 24 : 4, width:16, height:16, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.25)', transition:'left .2s' }}/>
                    </div>
                  </div>
                  {hasInterest && (
                    <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <div><label style={fieldLbl}>Interest Amount</label>
                        <input style={{ ...fieldIn, color:'#DC2626', fontWeight:700 }} type="number" step="0.01" placeholder="0.00" value={interestAmount} onChange={e=>setInterestAmount(e.target.value)}/></div>
                      <div><label style={fieldLbl}>Interest Category</label>
                        <CustomSelect value={interestCatId} onChange={setInterestCatId} placeholder="CC Interest"
                          options={expenseCats.map(c => ({ value:c.id, label:c.name, emoji:c.emoji, color:c.color }))}/></div>
                      <div style={{ gridColumn:'1/-1', background:'var(--surface2)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:8 }}>
                        <Info size={13}/> Total = <strong style={{color:'var(--text)'}}>{fmt(parseFloat(amount||0)+parseFloat(interestAmount||0))}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Date + Note */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={fieldLbl}>Date</label><input style={fieldIn} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
                <div><label style={fieldLbl}>Status</label>
                  <CustomSelect value={status} onChange={setStatus} placeholder="Status"
                    options={[{value:'completed',label:'Completed',emoji:'✅'},{value:'pending',label:'Pending',emoji:'⏳'},{value:'failed',label:'Failed',emoji:'❌'}]}/></div>
              </div>
              <div><label style={fieldLbl}>Note (optional)</label><input style={fieldIn} placeholder="Add a note…" value={note} onChange={e=>setNote(e.target.value)}/></div>

            </>)}
          </>)}
        </div>

        {/* ── Sticky Footer ── */}
        <div style={footerSt}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

            {/* Attach Bill — edit mode */}
            {isEdit && !confirmDelete && (
              <button onClick={() => setShowBills(true)}
                style={{ padding:'12px', borderRadius:14, border:'1.5px solid rgba(29,78,216,.3)', background:'rgba(29,78,216,.08)', color:'#1D4ED8', fontSize:13, fontWeight:700, cursor:'pointer', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <Paperclip size={15}/> Attach Bill / Receipt
              </button>
            )}

            {/* Delete — edit mode */}
            {isEdit && (
              confirmDelete ? (
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:12.5, color:'#DC2626', fontWeight:600, flex:1 }}>Delete this transaction?</span>
                  <button onClick={() => onDelete(tx.id)} style={{ padding:'9px 16px', borderRadius:12, border:'none', background:'#DC2626', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding:'9px 14px', borderRadius:12, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text3)', fontSize:13, cursor:'pointer' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ padding:'12px', borderRadius:14, border:'1.5px solid rgba(220,38,38,.3)', background:'rgba(220,38,38,.06)', color:'#DC2626', fontSize:13, fontWeight:700, cursor:'pointer', width:'100%' }}>
                  🗑️ Delete Transaction
                </button>
              )
            )}

            {!confirmDelete && (
              <button disabled={saving}
                onClick={handleSubmit}
                style={{ width:'100%', padding:'15px', borderRadius:16, border:'none', fontWeight:800, fontSize:15, cursor:'pointer', background: tc.gradient, color:'#fff', boxShadow:`0 6px 20px ${tc.color}44`, opacity: saving?.6:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, letterSpacing:'-0.2px' }}>
                {saving ? <><span style={{ display:'inline-block', animation:'spin .8s linear infinite' }}>⟳</span> Saving…</>
                  : isTransfer ? '🔄 Save Transfer'
                  : isEdit ? '✓ Save Changes'
                  : isCreditSelected && hasInterest && interestAmount ? '💳 Save + Interest'
                  : `${tc.icon} Save ${tc.label}`}
              </button>
            )}
          </div>

        </div>
        <style>{`
          @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          .txSheet{ max-height:88vh; max-height:88dvh; max-height:88svh; }
          @media (max-width:768px){ .txSheet{ max-height:92vh; max-height:92dvh; max-height:92svh; } }
        `}</style>
      </div>
    </>
  );
}
