import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsAPI, categoriesAPI, walletsAPI } from '../services/api';
import { Topbar, AmountText, StatusChip, PageLoader, EmptyState } from '../components/ui';
import { Plus, Upload, TrendingUp, TrendingDown, ArrowLeftRight, Search, SlidersHorizontal, Calendar, ChevronDown, Info } from 'lucide-react';
import { useFmt, useT } from '../i18n';
import styles from './Transactions.module.css';
import PaymentLogo from '../components/PaymentLogo';

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
  Food:      { bg:'#e8f9f0', color:'#00a86b' },
  Income:    { bg:'#eef3ff', color:'#5B8CFF' },
  Transport: { bg:'#eef3ff', color:'#5B8CFF' },
  Shopping:  { bg:'#fff8ea', color:'#f5a623' },
  Health:    { bg:'#ffe8f0', color:'#e0457b' },
  Bills:     { bg:'#f0edff', color:'#6C63FF' },
};

/* Group transactions by "Month YYYY" */
function groupByMonth(txList) {
  const map = {};
  txList.forEach(tx => {
    const d = new Date(tx.transaction_date);
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!map[key]) map[key] = { label: key, items: [], income: 0, expense: 0 };
    if (tx.type === 'income')  map[key].income  += parseFloat(tx.amount || 0);
    else if (tx.type === 'expense') map[key].expense += parseFloat(tx.amount || 0);
    // transfers: only count 'out' legs to avoid double counting
    else if (tx.type === 'transfer' && tx.transfer_direction === 'out') map[key].expense += parseFloat(tx.amount || 0);
    map[key].items.push(tx);
  });
  return Object.values(map);
}

const CREDIT_WALLET_TYPES = ['visa', 'mastercard'];

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
        style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px 4px 7px', borderRadius:20, border:'1.5px solid transparent', cursor: saving ? 'wait' : 'pointer',
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
                  <span style={{ width:22, height:22, borderRadius:6, background:`${c.color||'#6C63FF'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{c.emoji}</span>
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
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState({ type: 'all', search: '' });
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx]   = useState(null);
  const [showSearch, setShowSearch] = useState(false);

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
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });

  const patchCatMutation = useMutation({
    mutationFn: ({ txId, catId }) => transactionsAPI.update(txId, { category_id: catId || null }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['transactions'] }),
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
    } catch(e) {
      alert('Export failed. Please try again.');
    }
    setExporting(false);
  };

  return (
    <div className={styles.page}>

      {/* ── Desktop Topbar ── */}
      <div className={styles.desktopOnly}>
        <Topbar title={t('tx_title')} subtitle={t('tx_subtitle')}>
          <button className="btn btn-ghost btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={handleExportCSV} disabled={exporting}>
            <Upload size={13}/> {exporting ? 'Exporting…' : t('tx_export')}
          </button>
          <button className="btn btn-primary btn-sm"
            style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}
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
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <select value={selYear} onChange={e => { setSelYear(Number(e.target.value)); setPage(1); }}
                style={{ appearance:'none', padding:'5px 28px 5px 10px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12.5, fontWeight:600, cursor:'pointer', outline:'none' }}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown size={12} color="var(--text3)" style={{ position:'absolute', right:8, pointerEvents:'none' }}/>
            </div>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <select value={selMonth} onChange={e => { setSelMonth(Number(e.target.value)); setPage(1); }}
                style={{ appearance:'none', padding:'5px 28px 5px 10px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12.5, fontWeight:600, cursor:'pointer', outline:'none' }}>
                <option value={0}>{t('tx_all_months')}</option>
                {MONTHS_FULL.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <ChevronDown size={12} color="var(--text3)" style={{ position:'absolute', right:8, pointerEvents:'none' }}/>
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
            <Plus size={20} color="#6C63FF"/>
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

      <div className={styles.content}>

        {/* ── Summary cards ── */}
        <div className={styles.summaryGrid}>
          {[
            { label: t('tx_total_income'),  value: totalIncome,                hexColor:'#37D67A', bg:'rgba(55,214,122,.1)',  icon:<TrendingUp    size={18} color="#37D67A"/> },
            { label: t('tx_total_expense'), value: totalExpense,               hexColor:'#FF5B5B', bg:'rgba(255,91,91,.1)',   icon:<TrendingDown  size={18} color="#FF5B5B"/> },
            { label: t('tx_net_balance'),   value: totalIncome - totalExpense,
              hexColor: (totalIncome-totalExpense) >= 0 ? '#6C63FF' : '#FF5B5B',
              bg:'rgba(108,99,255,.1)', icon:<ArrowLeftRight size={18} color="#6C63FF"/> },
          ].map(({ label, value, hexColor, bg, icon }) => (
            <div key={label} className={styles.summaryCard}>
              <div style={{ width:40, height:40, borderRadius:12, background:bg,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>{label}</div>
                <div className="mono" style={{ fontSize:16, fontWeight:800, color:hexColor, letterSpacing:-0.4, lineHeight:1 }}>
                  {fmt(Math.abs(value))}
                </div>
              </div>
            </div>
          ))}
        </div>

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
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'var(--surface2)' }}>
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
                        ? { bg:'rgba(91,140,255,.1)', color:'#5B8CFF' }
                        : (CAT_COLORS[tx.category_name] || { bg:'var(--accent-light)', color:'var(--accent)' });
                      const amtColor = isTransfer
                        ? (isOut ? '#FF5B5B' : '#37D67A')
                        : tx.type === 'income' ? '#37D67A' : '#FF5B5B';
                      const amtPrefix = isTransfer ? (isOut ? '−' : '+') : tx.type === 'income' ? '+' : '−';
                      return (
                        <tr key={tx.id}
                          onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background=''}
                          style={{ transition:'background .1s', cursor:'default' }}>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text3)', whiteSpace:'nowrap' }}>
                            {new Date(tx.transaction_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)', fontWeight:700, color:amtColor, fontFamily:'Space Grotesk, Inter, sans-serif', fontSize:13.5 }}>
                            {amtPrefix}{tx.amount}
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:34, height:34, borderRadius:10, background:catColor.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, fontWeight:700 }}>
                                {isTransfer ? '🔄' : (tx.category_emoji || (tx.description||tx.payment_name||'?')[0].toUpperCase())}
                              </div>
                              <div>
                                <div style={{ fontWeight:600, fontSize:13.5, color:'var(--text)' }}>{tx.description || tx.payment_name}</div>
                                {isTransfer ? (
                                  <div style={{ fontSize:11, color:'#5B8CFF', marginTop:1, fontWeight:600 }}>
                                    {isOut ? t('tx_sent') : t('tx_received')} · {tx.wallet_name}{tx.last_four ? ` *${tx.last_four}` : ''}
                                  </div>
                                ) : tx.payment_name && tx.description ? (
                                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:1, fontFamily:'Space Grotesk, Inter, sans-serif', letterSpacing:0 }}>Ref: {tx.payment_name}</div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text2)', fontWeight:500, whiteSpace:'nowrap' }}>
                            {tx.wallet_name}{tx.last_four ? ` *${tx.last_four}` : ''}
                          </td>
                          <td style={{ padding:'13px 18px', borderBottom:'1px solid var(--border-light)' }}>
                            {isTransfer ? (
                              <span style={{ fontSize:11.5, fontWeight:700, padding:'4px 10px', borderRadius:20, background:'rgba(91,140,255,.12)', color:'#5B8CFF' }}>
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
                                  style={{ padding:'5px 10px', borderRadius:8, border:'none', background:'#FF5B5B', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                                  Yes
                                </button>
                                <button onClick={() => setDeleteConfirmId(null)}
                                  style={{ padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text3)', fontSize:12, cursor:'pointer' }}>
                                  No
                                </button>
                              </div>
                            ) : (
                              <div style={{ display:'flex', gap:4 }}>
                                {!isTransfer && (
                                  <button onClick={() => openEdit(tx)}
                                    style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', padding:'5px 8px', fontSize:12, color:'var(--text3)' }}
                                    title="Edit">✏️</button>
                                )}
                                <button onClick={() => setDeleteConfirmId(tx.id)}
                                  style={{ background:'var(--red-light)', border:'1px solid rgba(255,91,91,.2)', borderRadius:8, cursor:'pointer', padding:'5px 8px', fontSize:12 }}
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
              {!txList.length && (
                <EmptyState icon="💳" title={t('tx_no_tx')} description={t('tx_no_tx_desc')} />
              )}
              {grouped.map(group => (
                <div key={group.label} className={styles.monthGroup}>
                  {/* Month header */}
                  <div className={styles.monthHeader}>
                    <span className={styles.monthLabel}>{group.label.split(' ')[0]}</span>
                    <span className={styles.monthTotal} style={{ color: group.income - group.expense >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {group.income - group.expense >= 0 ? '+' : '-'}{fmt(Math.abs(group.income - group.expense))}
                    </span>
                  </div>

                  {/* Transaction cards */}
                  <div className={styles.txGroup}>
                    {group.items.map((tx, idx) => {
                      const isTransfer = tx.type === 'transfer';
                      const isOut      = tx.transfer_direction === 'out';
                      const isIncome   = tx.type === 'income';
                      const catColor   = isTransfer
                        ? { bg:'rgba(91,140,255,.13)', color:'#5B8CFF' }
                        : (CAT_COLORS[tx.category_name] || { bg:'rgba(108,99,255,.1)', color:'var(--accent)' });
                      const circleColor = isTransfer ? 'rgba(91,140,255,.13)' : isIncome ? 'rgba(55,214,122,.15)' : 'rgba(108,99,255,.13)';
                      const iconColor   = isTransfer ? '#5B8CFF' : isIncome ? '#37D67A' : '#6C63FF';
                      const amtColor    = isTransfer ? (isOut ? 'var(--red)' : 'var(--green)') : isIncome ? 'var(--green)' : 'var(--red)';
                      const amtPrefix   = isTransfer ? (isOut ? '−' : '+') : isIncome ? '+' : '−';
                      const d = new Date(tx.transaction_date);
                      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const isLast = idx === group.items.length - 1;
                      const isConfirming = deleteConfirmId === tx.id;
                      return (
                        <div key={tx.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-light)' }}>
                          {/* Main row */}
                          <div className={styles.txRow} style={{ borderBottom:'none' }}
                            onClick={() => { if (isConfirming) { setDeleteConfirmId(null); return; } if (!isTransfer) openEdit(tx); }}>
                            {/* Icon */}
                            <div className={styles.txCircle} style={{ background: circleColor }}>
                              {isTransfer
                                ? <span style={{ fontSize:15 }}>🔄</span>
                                : <ArrowLeftRight size={16} color={iconColor}/>
                              }
                            </div>

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
                                    <span style={{ color:'#5B8CFF', fontWeight:600 }}>{isOut ? t('tx_sent') : t('tx_received')}</span>
                                  </>
                                ) : tx.category_name && (
                                  <>
                                    <span className={styles.txDot}>·</span>
                                    <span style={{ color: catColor.color }}>{tx.category_emoji} {tx.category_name}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Amount + trash */}
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                              <div className={styles.txAmount} style={{ color: amtColor }}>
                                {amtPrefix}{fmt(parseFloat(tx.amount))}
                              </div>
                              <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(isConfirming ? null : tx.id); }}
                                style={{ background:'none', border:'none', padding:'2px 4px', cursor:'pointer', fontSize:13, opacity:0.45, lineHeight:1, borderRadius:6, transition:'opacity .15s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity='1'}
                                onMouseLeave={e => e.currentTarget.style.opacity='0.45'}
                                title="Delete">🗑️</button>
                            </div>
                          </div>

                          {/* Inline delete confirm bar */}
                          {isConfirming && (
                            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'rgba(255,91,91,.06)', borderTop:'1px solid rgba(255,91,91,.12)', animation:'dropFade .15s ease' }}>
                              <span style={{ flex:1, fontSize:12.5, color:'#FF5B5B', fontWeight:600 }}>Delete this transaction?</span>
                              <button onClick={() => { deleteMutation.mutate(tx.id); setDeleteConfirmId(null); }}
                                style={{ padding:'6px 14px', borderRadius:9, border:'none', background:'#FF5B5B', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
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

      {/* ── Mobile FAB ── */}
      <button className={styles.fab} onClick={openAdd}>
        <Plus size={26} color="#fff"/>
      </button>

      {showModal && (
        <TransactionModal
          tx={editTx}
          onClose={() => { setShowModal(false); setEditTx(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey:['transactions'] });
            qc.invalidateQueries({ queryKey:['dashboard-summary'] });
            setShowModal(false);
          }}
          onDelete={(id) => {
            deleteMutation.mutate(id);
            qc.invalidateQueries({ queryKey:['dashboard-summary'] });
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
const QUICK_COLORS = ['#6C63FF','#FF5B5B','#37D67A','#FFB84D','#5B8CFF','#00CEC9','#fd79a8','#a29bfe','#e17055','#00b894'];

function NewCategoryInline({ txType, onCreated, onCancel }) {
  const [name,   setName]   = useState('');
  const [emoji,  setEmoji]  = useState('');
  const [color,  setColor]  = useState('#6C63FF');
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
          background:'linear-gradient(135deg,var(--accent),#5B8CFF)', color:'#fff',
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

function TransactionModal({ tx, onClose, onSaved, onDelete }) {
  const t   = useT();
  const fmt = useFmt();
  const qc  = useQueryClient();

  // Don't allow editing transfer transactions — they're managed as pairs
  const isEditTransfer = tx?.type === 'transfer';
  const isEdit = !!tx && !isEditTransfer;

  /* ── Type ──────────────────────────────────────────────── */
  const [txType, setTxType] = useState(
    tx?.type === 'transfer' ? 'expense' : (tx?.type || 'expense')
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

  /* ── Data ─────────────────────────────────────────────── */
  const { data: wallets }    = useQuery({ queryKey:['wallets'],    queryFn:() => walletsAPI.getAll().then(r=>r.data.data) });
  const { data: categories } = useQuery({ queryKey:['categories'], queryFn:() => categoriesAPI.getAll().then(r=>r.data.data) });

  /* Which payment methods to show based on tx type */
  const methodList = txType === 'income' ? INCOME_METHODS : PAYMENT_METHODS;

  /* Selected method config */
  const methodCfg = methodList.find(m => m.id === payMethod) || null;

  /* Filter wallets based on chosen payment method */
  const allowedWallets = useMemo(() => {
    if (!wallets) return [];
    if (!methodCfg || !methodCfg.walletTypes) return wallets; // "other" = all
    return wallets.filter(w => methodCfg.walletTypes.includes(w.type));
  }, [wallets, methodCfg]);

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

  const typeColor = isTransfer ? '#5B8CFF' : txType === 'income' ? '#37D67A' : '#FF5B5B';

  /* ── Submit ───────────────────────────────────────────── */
  const handleSubmit = async () => {
    setError('');
    if (!amount || parseFloat(amount) <= 0) { setError('Please enter a valid amount'); return; }

    if (isTransfer) {
      if (!fromWalletId || !toWalletId) { setError('Please select both source and destination accounts'); return; }
      if (fromWalletId === toWalletId)  { setError('Source and destination must be different'); return; }
    }

    setSaving(true);
    try {
      const payMethodLabel = methodCfg?.label || '';
      const fullPayName = payName || payMethodLabel;

      if (isTransfer) {
        await transactionsAPI.create({
          type: 'transfer', amount, description: note,
          payment_name: fullPayName || 'Transfer',
          from_wallet_id: fromWalletId, to_wallet_id: toWalletId,
          status, transaction_date: date,
        });
      } else if (isEdit) {
        await transactionsAPI.update(tx.id, {
          type: txType, amount, description: note, payment_name: payName,
          wallet_id: walletId || null, category_id: catId || null,
          status, transaction_date: date,
        });
      } else {
        // New transaction
        const mainPayName = fullPayName || (txType === 'income' ? 'Income' : 'Expense');
        await transactionsAPI.create({
          type: txType, amount, description: note, payment_name: mainPayName,
          wallet_id: walletId || null, category_id: catId || null,
          status, transaction_date: date,
        });

        // Credit card interest transaction
        if (methodCfg?.isCredit && hasInterest && interestAmount && parseFloat(interestAmount) > 0) {
          // Ensure "Credit Card Interest" category exists
          let intCatId = interestCatId;
          if (!intCatId) {
            try {
              const newCat = await categoriesAPI.create({
                name: 'Credit Card Interest', type: 'expense', emoji: '💳', color: '#FF5B5B',
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
      }

      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
      onSaved?.();
      onClose();
    } catch(e) {
      setError(e.response?.data?.message || 'Error saving transaction');
    } finally {
      setSaving(false);
    }
  };

  const TAB_OPTS = [
    { key:'expense',  label:`📤 ${t('tx_expense')}`,  color:'var(--red)',   activeColor:'rgba(255,91,91,.1)'   },
    { key:'income',   label:`📥 ${t('tx_income')}`,   color:'var(--green)', activeColor:'rgba(55,214,122,.1)'  },
    { key:'transfer', label:`🔄 ${t('tx_transfer')}`, color:'#5B8CFF',      activeColor:'rgba(91,140,255,.1)'  },
  ];

  const headerBg = isTransfer
    ? 'rgba(91,140,255,.12)'
    : txType === 'income' ? 'rgba(55,214,122,.12)' : 'rgba(255,91,91,.12)';

  /* ── Show payment method grid for NEW non-transfer transactions ── */
  const showMethodPicker = !isEdit && !isTransfer;

  /* ── Styles ───────────────────────────────────────────── */
  const labelSt = { fontSize:11.5, fontWeight:700, color:'var(--text3)', marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'.05em' };
  const inputSt = { width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:520, maxHeight:'92vh', overflowY:'auto' }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:headerBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
            {isTransfer ? '🔄' : txType === 'income' ? '📥' : '📤'}
          </div>
          <div className="modal-title" style={{ margin:0, flex:1 }}>
            {isEdit ? t('modal_edit_tx') : t('modal_add_tx')}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--text3)', cursor:'pointer', lineHeight:1, padding:4 }}>×</button>
        </div>

        {/* ── Type tabs (new only) ── */}
        {!isEdit && (
          <div style={{ display:'flex', background:'var(--surface2)', borderRadius:12, padding:4, marginBottom:18, gap:4 }}>
            {TAB_OPTS.map(({ key, label, color, activeColor }) => (
              <button key={key}
                onClick={() => { setTxType(key); setPayMethod(null); setWalletId(''); setError(''); setShowNewCat(false); }}
                style={{ flex:1, padding:'8px 4px', borderRadius:9, fontSize:12.5, fontWeight:600, border:'none', cursor:'pointer',
                  transition:'all .15s', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  background: txType===key ? activeColor : 'transparent',
                  color:      txType===key ? color       : 'var(--text3)',
                  boxShadow:  txType===key ? '0 2px 8px rgba(0,0,0,.08)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'9px 13px', borderRadius:10, marginBottom:14, fontSize:13 }}>
            {error}
          </div>
        )}

        {/* ══ TRANSFER FLOW ══ */}
        {isTransfer ? (
          <div style={{ display:'grid', gap:12 }}>
            <div>
              <label style={labelSt}>Amount</label>
              <input style={{ ...inputSt, fontSize:18, fontWeight:800, color:'#5B8CFF' }}
                type="number" step="0.01" placeholder="0.00"
                value={amount} onChange={e=>setAmount(e.target.value)}/>
            </div>
            <div>
              <label style={labelSt}>From Account</label>
              <CustomSelect
                value={fromWalletId}
                onChange={setFromWalletId}
                placeholder="Select source account"
                options={(wallets||[]).map(w => ({ value:w.id, label:`${w.name}${w.last_four?` *${w.last_four}`:''}`, sub:`Balance: ${fmt(w.balance||0)}` }))}
              />
            </div>
            <div>
              <label style={labelSt}>To Account</label>
              <CustomSelect
                value={toWalletId}
                onChange={setToWalletId}
                placeholder="Select destination account"
                options={(wallets||[]).filter(w=>w.id!==fromWalletId).map(w => ({ value:w.id, label:`${w.name}${w.last_four?` *${w.last_four}`:''}`, emoji: CREDIT_WALLET_TYPES.includes(w.type)?'💳':undefined, sub:`Balance: ${fmt(w.balance||0)}` }))}
              />
            </div>
            {/* CC payment note */}
            {CREDIT_WALLET_TYPES.includes((wallets||[]).find(w=>w.id===toWalletId)?.type) && (
              <div style={{ display:'flex', gap:8, background:'rgba(255,166,0,.08)', border:'1px solid rgba(255,166,0,.3)', borderRadius:10, padding:'10px 12px' }}>
                <span style={{ fontSize:18 }}>💳</span>
                <div>
                  <div style={{ fontSize:12.5, fontWeight:700, color:'#e67e00' }}>Credit Card Bill Payment</div>
                  <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:2 }}>
                    Money moves from your bank account to clear the credit card balance.
                  </div>
                </div>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={labelSt}>Status</label>
                <CustomSelect
                  value={status}
                  onChange={setStatus}
                  placeholder="Select status"
                  options={[
                    { value:'completed', label:'Completed', emoji:'✅' },
                    { value:'pending',   label:'Pending',   emoji:'⏳' },
                    { value:'failed',    label:'Failed',    emoji:'❌' },
                  ]}
                />
              </div>
              <div>
                <label style={labelSt}>Date</label>
                <input style={inputSt} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
              </div>
            </div>
            <div>
              <label style={labelSt}>Note (optional)</label>
              <input style={inputSt} placeholder="Transfer description..." value={note} onChange={e=>setNote(e.target.value)}/>
            </div>
          </div>

        ) : (
          /* ══ INCOME / EXPENSE FLOW ══ */
          <div style={{ display:'grid', gap:14 }}>

            {/* ── Step 1: Payment method picker (new tx only) ── */}
            {showMethodPicker && (
              <div>
                <label style={labelSt}>
                  {txType === 'income' ? '💰 Received via' : '💸 How did you pay?'}
                </label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {methodList.map(m => {
                    const sel = payMethod === m.id;
                    const hasAccounts = !m.walletTypes || (wallets||[]).some(w=>m.walletTypes.includes(w.type));
                    return (
                      <button key={m.id} onClick={() => {
                        setPayMethod(m.id); setWalletId(''); setError('');
                        setHasInterest(false); setInterestAmount('');
                      }}
                        style={{
                          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                          padding:'10px 6px', borderRadius:12, border:'2px solid',
                          borderColor: sel ? typeColor : 'var(--border)',
                          background: sel ? (txType==='income'?'rgba(55,214,122,.08)':'rgba(255,91,91,.06)') : 'var(--surface2)',
                          cursor: hasAccounts ? 'pointer' : 'not-allowed',
                          opacity: hasAccounts ? 1 : 0.4,
                          transition:'all .15s', gap:4,
                        }}>
                        <PaymentLogo method={m.id} size={34}
                          style={{ boxShadow: sel ? `0 3px 10px ${typeColor}44` : 'none', transition:'box-shadow .15s' }}/>
                        <span style={{ fontSize:11, fontWeight:700, color: sel ? typeColor : 'var(--text3)', textAlign:'center', lineHeight:1.2 }}>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 2: Account selector (filtered by method) ── */}
            {(payMethod !== null || isEdit) && (
              <>
                {/* Amount */}
                <div>
                  <label style={labelSt}>Amount *</label>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:16, fontWeight:800, color:typeColor, pointerEvents:'none' }}>
                      {fmt(0).replace(/[\d.,\s]/g,'').trim() || '$'}
                    </span>
                    <input style={{ ...inputSt, paddingLeft:32, fontSize:18, fontWeight:800, color:typeColor }}
                      type="number" step="0.01" placeholder="0.00"
                      value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label style={labelSt}>
                    {txType==='income' ? 'Income Source *' : 'Payment Name *'}
                  </label>
                  <input style={inputSt}
                    placeholder={txType==='income' ? 'e.g. Salary, Freelance, Dividend…' : 'e.g. Swiggy, Netflix, Rent…'}
                    value={payName} onChange={e=>setPayName(e.target.value)}/>
                </div>

                {/* Account — filtered */}
                <div>
                  <label style={labelSt}>
                    {methodCfg?.isCredit ? '💳 Credit Card Account *' : txType==='income' ? 'Credited To' : 'Paid From'}
                    {methodCfg && (
                      <span style={{ marginLeft:6, fontSize:10, fontWeight:600, color:'var(--text3)', background:'var(--surface3)', borderRadius:6, padding:'1px 7px' }}>
                        {methodCfg.emoji} {methodCfg.label}
                      </span>
                    )}
                  </label>
                  {allowedWallets.length === 0 ? (
                    <div style={{ background:'rgba(255,184,77,.08)', border:'1px solid rgba(255,184,77,.3)', borderRadius:10, padding:'10px 12px', fontSize:12.5, color:'#b8860b' }}>
                      ⚠️ No {methodCfg?.walletTypes?.join('/')} account found.{' '}
                      <span style={{ fontWeight:700 }}>Add one in Accounts first.</span>
                    </div>
                  ) : (
                    <CustomSelect
                      value={walletId}
                      onChange={setWalletId}
                      placeholder="Select account"
                      options={allowedWallets.map(w => ({
                        value: w.id,
                        label: `${w.name}${w.last_four ? ` *${w.last_four}` : ''}`,
                        sub:   `Balance: ${fmt(w.balance||0)}`,
                      }))}
                    />
                  )}
                </div>

                {/* ── Credit Card specific: interest ── */}
                {methodCfg?.isCredit && walletId && (
                  <div style={{ background:'rgba(255,91,91,.06)', border:'1px solid rgba(255,91,91,.15)', borderRadius:12, padding:'14px 16px' }}>
                    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                        <span style={{ fontSize:18 }}>💰</span>
                        <div>
                          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>Add Interest / Finance Charges?</div>
                          <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:2 }}>
                            Credit card interest will be logged as a separate expense
                          </div>
                        </div>
                      </div>
                      <div onClick={() => setHasInterest(h=>!h)} style={{
                        width:40, height:22, borderRadius:11, cursor:'pointer', transition:'background .2s',
                        background: hasInterest ? '#FF5B5B' : 'var(--surface3)',
                        position:'relative', flexShrink:0,
                      }}>
                        <div style={{
                          position:'absolute', top:3, left: hasInterest ? 21 : 3,
                          width:16, height:16, borderRadius:'50%', background:'#fff',
                          boxShadow:'0 1px 3px rgba(0,0,0,.3)', transition:'left .2s',
                        }}/>
                      </div>
                    </label>

                    {hasInterest && (
                      <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                        <div>
                          <label style={labelSt}>Interest Amount</label>
                          <input style={{ ...inputSt, color:'#FF5B5B', fontWeight:700 }}
                            type="number" step="0.01" placeholder="0.00"
                            value={interestAmount} onChange={e=>setInterestAmount(e.target.value)}/>
                        </div>
                        <div>
                          <label style={labelSt}>Interest Category</label>
                          <CustomSelect
                            value={interestCatId}
                            onChange={setInterestCatId}
                            placeholder="Auto (CC Interest)"
                            options={expenseCats.map(c => ({ value:c.id, label:c.name, emoji:c.emoji, color:c.color }))}
                          />
                        </div>
                        <div style={{ gridColumn:'1/-1' }}>
                          <div style={{ fontSize:12, color:'var(--text3)', background:'var(--surface2)', borderRadius:8, padding:'8px 11px', display:'flex', alignItems:'center', gap:8 }}>
                            <Info size={13} color="var(--text3)"/>
                            <span>
                              Total spend = <strong style={{color:'var(--text)'}}>{fmt(parseFloat(amount||0) + parseFloat(interestAmount||0))}</strong>
                              {' '}({fmt(parseFloat(amount||0))} + {fmt(parseFloat(interestAmount||0))} interest)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Category + Note */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                      <label style={{ ...labelSt, marginBottom:0 }}>Category</label>
                      <button type="button" onClick={() => setShowNewCat(v => !v)}
                        style={{ fontSize:11, fontWeight:700, color: showNewCat ? 'var(--red)' : 'var(--accent)', background: showNewCat ? 'rgba(255,91,91,.08)' : 'var(--accent-light)', border:'none', borderRadius:7, padding:'3px 9px', cursor:'pointer', transition:'all .15s' }}>
                        {showNewCat ? '✕ Cancel' : '+ New'}
                      </button>
                    </div>
                    {showNewCat ? (
                      <NewCategoryInline
                        txType={txType}
                        onCancel={() => setShowNewCat(false)}
                        onCreated={cat => {
                          setCatId(cat.id);
                          setShowNewCat(false);
                          qc.invalidateQueries({ queryKey:['categories'] });
                        }}
                      />
                    ) : (
                      <CustomSelect
                        value={catId}
                        onChange={setCatId}
                        placeholder="No category"
                        options={filteredCats.map(c => ({ value:c.id, label:c.name, emoji:c.emoji, color:c.color }))}
                      />
                    )}
                  </div>
                  <div>
                    <label style={labelSt}>Note (optional)</label>
                    <input style={inputSt} placeholder="Add a note…" value={note} onChange={e=>setNote(e.target.value)}/>
                  </div>
                </div>

                {/* Status + Date */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={labelSt}>Status</label>
                    <select style={inputSt} value={status} onChange={e=>setStatus(e.target.value)}>
                      <option value="completed">✅ Completed</option>
                      <option value="pending">⏳ Pending</option>
                      <option value="failed">❌ Failed</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Date</label>
                    <input style={inputSt} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
                  </div>
                </div>
              </>
            )}

          </div>
        )}

        {/* ── Footer buttons ── */}
        <div style={{ display:'flex', gap:10, marginTop:20, paddingTop:16, borderTop:'1px solid var(--border-light)', alignItems:'center' }}>

          {/* Delete section — edit mode only */}
          {isEdit && (
            confirmDelete ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, animation:'dropFade .15s ease', marginRight:'auto' }}>
                <span style={{ fontSize:12.5, color:'#FF5B5B', fontWeight:600 }}>Delete this transaction?</span>
                <button onClick={() => onDelete(tx.id)}
                  style={{ padding:'7px 14px', borderRadius:9, border:'none', background:'#FF5B5B', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Yes, delete
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  style={{ padding:'7px 10px', borderRadius:9, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text3)', fontSize:13, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                style={{ marginRight:'auto', display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, border:'1.5px solid rgba(255,91,91,.3)', background:'var(--red-light)', color:'#FF5B5B', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s' }}>
                🗑️ Delete
              </button>
            )
          )}

          {!confirmDelete && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>{t('modal_cancel')}</button>
              <button
                disabled={saving || (showMethodPicker && !payMethod && !isTransfer)}
                onClick={handleSubmit}
                style={{
                  padding:'10px 24px', borderRadius:12, border:'none', fontWeight:700, fontSize:14, cursor:'pointer',
                  background: isTransfer
                    ? 'linear-gradient(135deg,#5B8CFF,#4facfe)'
                    : txType==='income'
                      ? 'linear-gradient(135deg,#37D67A,#00b894)'
                      : 'linear-gradient(135deg,#6C63FF,#5B8CFF)',
                  color:'#fff', boxShadow:'0 4px 14px rgba(108,99,255,.3)',
                  opacity: (saving || (showMethodPicker && !payMethod && !isTransfer)) ? .6 : 1,
                  display:'flex', alignItems:'center', gap:8,
                }}>
                {saving ? (
                  <><span style={{ display:'inline-block', animation:'spin .8s linear infinite' }}>⟳</span> Saving…</>
                ) : isTransfer ? `🔄 ${t('tx_transfer')}` : isEdit ? t('modal_save') : (
                  methodCfg?.isCredit && hasInterest && interestAmount
                    ? `💳 Save + Add Interest`
                    : t('modal_add_tx')
                )}
              </button>
            </>
          )}
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes dropFade{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    </div>
  );
}
