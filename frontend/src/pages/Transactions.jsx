import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { transactionsAPI, categoriesAPI, walletsAPI } from '../services/api';
import { track } from '../lib/analytics';
import { Topbar, AmountText, StatusChip, PageLoader, EmptyState, Sheet, Button, Tabs, Field, Input, Select, Segmented } from '../components/ui';
import { Plus, Upload, TrendingUp, TrendingDown, ArrowLeftRight, Search, SlidersHorizontal, Calendar, ChevronDown, Info, Paperclip } from 'lucide-react';
import BillAttachment, { BillBadge } from '../components/BillAttachment';
import { useFmt, useT } from '../i18n';
import useThemeStore from '../store/themeStore';
import styles from './Transactions.module.css';
import PaymentLogo from '../components/PaymentLogo';
import { MerchantLogo, CategoryIcon, CategoryGlyph } from '../components/icons';
import ThemedSelect from '../components/ThemedSelect';
import { invalidateFinance, resetFinance } from '../lib/cache';
import { confirmAsync } from '../lib/confirm';

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
  const [showPeriod, setShowPeriod] = useState(false);   // phone: period picker sheet
  const [selectMode, setSelectMode] = useState(false);   // phone: checkboxes only while selecting
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
      }} className={`${styles.txDateBar} ${styles.desktopOnly}`}>
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
        {/* Search */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
        <div className={styles.mobileSearch} style={{ flex:1, marginBottom:0 }}>
          <Search size={16} color="var(--text3)" style={{ flexShrink:0 }}/>
          <input
            placeholder={t('tx_search')}
            value={filters.search}
            onChange={e => { setFilters(f => ({...f, search: e.target.value})); setPage(1); }}
            className={styles.mobileSearchInput}
            aria-label="Search transactions"
          />
        </div>
        <Button variant="primary" iconOnly onClick={openAdd} aria-label="Add transaction" icon={<Plus size={20}/>} />
        </div>

        {/* Period + select */}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button type="button" onClick={() => setShowPeriod(true)} aria-haspopup="dialog"
            style={{ flex:1, minHeight:44, display:'flex', alignItems:'center', gap:8, padding:'0 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', font:'inherit', fontSize:14, fontWeight:500, cursor:'pointer', textAlign:'left' }}>
            <Calendar size={16} color="var(--text3)"/>
            <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{periodLabel}</span>
            <SlidersHorizontal size={16} color="var(--text3)"/>
          </button>
          {txList.length > 0 && (
            <button type="button" onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
              style={{ minHeight:44, padding:'0 14px', borderRadius:10, border:'1px solid var(--border)', background: selectMode ? 'var(--accent-light)' : 'var(--surface)', color: selectMode ? 'var(--accent)' : 'var(--text2)', font:'inherit', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              {selectMode ? 'Done' : 'Select'}
            </button>
          )}
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

      {/* ── Mobile summary: one line, so the list starts above the fold ── */}
      <div className="show-mobile-only">
        <div style={{ display:'flex', gap:16, padding:'10px 16px', borderBottom:'1px solid var(--border-light)', background:'var(--surface)', fontVariantNumeric:'tabular-nums' }}>
          <span style={{ fontSize:13, color:'var(--text3)' }}>In <b style={{ color:'var(--green)', fontWeight:600 }}>+{fmt(totalIncome,{noDecimals:true})}</b></span>
          <span style={{ fontSize:13, color:'var(--text3)' }}>Out <b style={{ color:'var(--red-text)', fontWeight:600 }}>−{fmt(totalExpense,{noDecimals:true})}</b></span>
          <span style={{ fontSize:13, color:'var(--text3)', marginLeft:'auto' }}>{pagination.total ?? txList.length} {(pagination.total ?? txList.length) === 1 ? t('tx_count') : t('tx_count_pl')}</span>
        </div>
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
              {selectMode && txList.length > 0 && (
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
                            onClick={() => { if (selectMode) { toggleSelect(tx.id); return; } if (isConfirming) { setDeleteConfirmId(null); return; } if (!isTransfer) openEdit(tx); }}>
                            {/* Select checkbox */}
                            {selectMode && <input type="checkbox" checked={selectedIds.has(tx.id)}
                              onChange={() => toggleSelect(tx.id)}
                              onClick={e => e.stopPropagation()}
                              aria-label={`Select ${tx.description || 'transaction'}`}
                              style={{ width:20, height:20, cursor:'pointer', accentColor:'var(--accent)', flexShrink:0, marginRight:4 }}
                            />}
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
                                {isTransfer ? (
                                  <span style={{ color:'var(--blue-text)', fontWeight:600 }}>{isOut ? t('tx_sent') : t('tx_received')}</span>
                                ) : tx.category_name ? (
                                  <span>{tx.category_emoji} {tx.category_name}</span>
                                ) : null}
                                {tx.wallet_name && (
                                  <>
                                    {(isTransfer || tx.category_name) && <span className={styles.txDot}>·</span>}
                                    <span>{tx.wallet_name}{tx.last_four ? ` ••${tx.last_four}` : ''}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Amount + actions */}
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                              <div className={styles.txAmount} style={{ color: amtColor }}>
                                {amtPrefix}{fmt(parseFloat(tx.amount))}
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

      <Sheet open={showPeriod} onClose={() => setShowPeriod(false)} title="Period"
        footer={<Button variant="primary" block onClick={() => setShowPeriod(false)}>Show {periodLabel}</Button>}>
        <Tabs label="Period type" value={dateMode} onChange={(k) => { setDateMode(k); setPage(1); }}
          tabs={[{ key:'monthly', label:t('tx_monthly') }, { key:'weekly', label:t('tx_weekly') }]} />
        <div style={{ height:16 }} />
        {dateMode === 'monthly' ? (
          <>
            <Field label="Year">
              <ThemedSelect value={selYear} onChange={v => { setSelYear(Number(v)); setPage(1); }} options={YEARS.map(y => ({ value:y, label:String(y) }))}/>
            </Field>
            <Field label="Month">
              <ThemedSelect value={selMonth} onChange={v => { setSelMonth(Number(v)); setPage(1); }}
                options={[{ value:0, label:t('tx_all_months') }, ...MONTHS_FULL.map((m, i) => ({ value:i+1, label:m }))]}/>
            </Field>
          </>
        ) : (
          <Field label="Week">
            <input type="week" className="ds-input" value={selWeek} onChange={e => { setSelWeek(e.target.value); setPage(1); }} />
          </Field>
        )}
      </Sheet>

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
    <div style={{ background:'var(--surface2)', borderRadius:'var(--radius)', padding:14, border:'1px solid var(--border)' }}>
      <Field label="Category name" error={err}>
        <Input autoFocus placeholder="e.g. Pets" value={name} maxLength={40}
          onChange={e => { setName(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()} />
      </Field>
      <div className="ds-field__label" style={{ marginBottom:8 }}>Icon</div>
      <div className="tx-chips" style={{ maxHeight:'none', marginBottom:14 }}>
        {emojiList.map(e => (
          <button key={e} type="button" className="tx-chip" aria-pressed={emoji === e} aria-label={`Icon ${e}`} onClick={() => setEmoji(e)}
            style={{ minWidth:40, justifyContent:'center', padding:0, fontSize:18 }}>{e}</button>
        ))}
      </div>
      <div className="ds-field__label" style={{ marginBottom:8 }}>Colour</div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14 }}>
        {QUICK_COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={color === c}
            style={{ width:32, height:32, borderRadius:'50%', background:c, cursor:'pointer', border: color === c ? '3px solid var(--text)' : '2px solid transparent' }}/>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <Button onClick={onCancel} style={{ flex:1 }}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!name.trim()} style={{ flex:2 }}>Create category</Button>
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

  const typeOptions = [
    { key:'expense',  label:t('tx_expense'),  tone:'expense'  },
    { key:'income',   label:t('tx_income'),   tone:'income'   },
    { key:'transfer', label:t('tx_transfer'), tone:'transfer' },
  ];
  const [showMore, setShowMore] = useState(false);
  const walletOpt = (w) => ({ value:w.id, label:`${w.name}${w.last_four?` ••${w.last_four}`:''}`, sub: CREDIT_WALLET_TYPES.includes(w.type) ? `Outstanding ${fmt(Math.abs(w.balance||0))}` : `Balance ${fmt(w.balance||0)}` });
  const statusOpts = [{ value:'completed', label:'Completed' }, { value:'pending', label:'Pending' }, { value:'failed', label:'Failed' }];
  const onAmount = (v) => { const clean = v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'); if (/^\d*\.?\d{0,2}$/.test(clean)) setAmount(clean); };
  const desktop = !window.matchMedia?.('(pointer: coarse)').matches;

  const title = isEdit ? 'Edit transaction' : 'Add transaction';
  const saveLabel = isTransfer ? 'Save transfer'
    : isEdit ? 'Save changes'
    : isCreditSelected && hasInterest && interestAmount ? 'Save with interest'
    : `Save ${txType}`;

  // Bill attach step — shown after a new transaction is saved
  if (savedTxId) {
    return (
      <BillAttachment txId={savedTxId.id} txName={savedTxId.name}
        onClose={() => { onSaved?.(); onClose(); }} skipLabel="Skip" />
    );
  }

  const removeTx = () => confirmAsync('Delete this transaction?').then(ok => ok && onDelete(tx.id));

  return (
    <>
      {showBills && tx?.id && (
        <BillAttachment txId={tx.id} txName={tx.description || tx.payment_name || 'Transaction'} onClose={() => setShowBills(false)} />
      )}
      <Sheet open onClose={onClose} title={title}
        footer={<>
          {isEdit && <Button variant="danger" onClick={removeTx}>Delete</Button>}
          <Button variant="primary" loading={saving} onClick={handleSubmit} style={{ flex:1 }}>{saveLabel}</Button>
        </>}>

        {!isEdit && (
          <div style={{ marginBottom:4 }}>
            <Segmented label="Transaction type" options={typeOptions} value={txType}
              onChange={(key) => { setTxType(key); setPayMethod(null); setWalletId(''); setError(''); setShowNewCat(false); setCatId(''); }} />
          </div>
        )}

        {/* Amount comes first: it is the one thing every transaction needs */}
        <div className="tx-amount">
          <span className="tx-amount__cur" aria-hidden="true">₹</span>
          <input className="tx-amount__input" inputMode="decimal" placeholder="0" aria-label="Amount"
            value={amount} onChange={e => onAmount(e.target.value)} autoFocus={desktop}
            style={{ width: `${Math.max(amount.length, 1) + 0.6}ch` }} />
        </div>

        {error && <div className="tx-error" role="alert"><span aria-hidden="true">⚠</span><span>{error}</span></div>}

        {isTransfer ? (<>
          <div className="ds-field">
            <span className="ds-field__label">From</span>
            <Select value={fromWalletId} onChange={setFromWalletId} placeholder="Choose source account" options={(wallets||[]).map(walletOpt)} />
          </div>
          <div className="ds-field">
            <span className="ds-field__label">To</span>
            <Select value={toWalletId} onChange={setToWalletId} placeholder="Choose destination account" options={(wallets||[]).filter(w => w.id !== fromWalletId).map(walletOpt)} />
          </div>
          {CREDIT_WALLET_TYPES.includes((wallets||[]).find(w => w.id === toWalletId)?.type) && (
            <div className="tx-note"><span aria-hidden="true">💳</span><span><strong>Credit card payment.</strong> This reduces the card's outstanding balance from the source account.</span></div>
          )}
          <div className="tx-row2">
            <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
            <Field label="Note (optional)"><Input placeholder="What was it for?" value={note} onChange={e => setNote(e.target.value)} /></Field>
          </div>
        </>) : (<>
          <div className="ds-field">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span className="ds-field__label">Category</span>
              <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => setShowNewCat(v => !v)}>{showNewCat ? 'Cancel' : 'New category'}</button>
            </div>
            {showNewCat ? (
              <NewCategoryInline txType={txType} onCancel={() => setShowNewCat(false)}
                onCreated={cat => { setCatId(cat.id); setShowNewCat(false); qc.invalidateQueries({ queryKey:['categories'] }); }} />
            ) : (
              <div className="tx-chips" role="group" aria-label="Category">
                {catsLoading && filteredCats.length === 0 && <span style={{ fontSize:13, color:'var(--text3)' }}>Loading categories…</span>}
                {!catsLoading && filteredCats.length === 0 && <span style={{ fontSize:13, color:'var(--text3)' }}>No categories yet. Use “New category”.</span>}
                {filteredCats.map(c => (
                  <button key={c.id} type="button" className="tx-chip" aria-pressed={catId === c.id} onClick={() => setCatId(catId === c.id ? '' : c.id)}>
                    <CategoryGlyph name={c.name} emoji={c.emoji} icon={c.icon} size={16}/>{c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ds-field">
            <span className="ds-field__label">{isCreditSelected ? 'Credit card' : txType === 'income' ? 'Received in' : 'Paid from'}</span>
            {allowedWallets.length === 0 ? (
              <div className="tx-note">No account to use yet. Add one in Accounts first.</div>
            ) : (
              <Select value={walletId} onChange={setWalletId} placeholder="Choose account" options={allowedWallets.map(walletOpt)} />
            )}
          </div>

          <div className="tx-row2">
            <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
            <Field label={txType === 'income' ? 'Source' : 'Payee'}>
              <Input placeholder={txType === 'income' ? 'e.g. Salary' : 'e.g. Swiggy'} value={payName} onChange={e => setPayName(e.target.value)} />
            </Field>
          </div>
          <Field label="Note (optional)"><Input placeholder="Add a note" value={note} onChange={e => setNote(e.target.value)} /></Field>

          {isCreditSelected && walletId && (<>
            <button type="button" role="switch" aria-checked={hasInterest} className="tx-switch" onClick={() => setHasInterest(h => !h)}>
              <span>
                <strong style={{ display:'block', fontSize:14 }}>Add interest charges</strong>
                <span style={{ fontSize:12, color:'var(--text3)' }}>Saved as a separate expense</span>
              </span>
              <span className="tx-switch__track" aria-hidden="true" />
            </button>
            {hasInterest && (
              <div className="tx-row2">
                <Field label="Interest amount"><Input inputMode="decimal" placeholder="0" value={interestAmount} onChange={e => setInterestAmount(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                <div className="ds-field">
                  <span className="ds-field__label">Interest category</span>
                  <Select value={interestCatId} onChange={setInterestCatId} placeholder="Choose category"
                    options={expenseCats.map(c => ({ value:c.id, label:c.name, emoji:c.emoji || '' }))} />
                </div>
                <div className="tx-note" style={{ gridColumn:'1/-1' }}>Total on the card: <strong>{fmt(parseFloat(amount||0) + parseFloat(interestAmount||0))}</strong></div>
              </div>
            )}
          </>)}
        </>)}

        <button type="button" className="tx-more" aria-expanded={showMore} onClick={() => setShowMore(v => !v)}>
          {showMore ? 'Hide options' : 'More options'}
        </button>
        {showMore && (
          <div className="ds-field">
            <span className="ds-field__label">Status</span>
            <Select value={status} onChange={setStatus} options={statusOpts} />
          </div>
        )}

        {isEdit && (
          <Button block icon={<Paperclip size={16}/>} onClick={() => setShowBills(true)}>Receipts and bills</Button>
        )}
      </Sheet>
    </>
  );
}
