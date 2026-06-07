import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importAPI, walletsAPI, categoriesAPI, receiptAPI, transactionsAPI } from '../services/api';
import { Topbar } from '../components/ui';
import { Upload, FileText, CheckCircle, AlertCircle, X, Check, GitMerge, ScanSearch, Camera } from 'lucide-react';
import { useT, useFmt } from '../i18n';
import PaymentLogo from '../components/PaymentLogo';

const SOURCE_OPTIONS = [
  { id:'hdfc',    label:'HDFC Bank',   logo:'bank',    color:'#003087', hint:'NetBanking → Statements → Download CSV / TXT' },
  { id:'paytm',   label:'Paytm',       logo:'paytm',   color:'#00B9F1', hint:'Paytm App → Passbook → Download Statement → Excel (.xlsx) ⭐ Best! or PDF/CSV' },
  { id:'phonepe', label:'PhonePe',     logo:'phonepe', color:'#5f259f', hint:'PhonePe → Profile → Account Statement → Export CSV' },
  { id:'gpay',    label:'GPay',        logo:'gpay',    color:'#4285F4', hint:'Google Takeout → Google Pay → transactions.csv' },
  { id:'auto',    label:'Auto Detect', logo:null,      color:'#6C63FF', hint:'Let Tracksy figure out the format automatically' },
];

const TYPE_COLOR = { income:'#37D67A', expense:'#FF5B5B' };
const TYPE_BG    = { income:'rgba(55,214,122,.12)', expense:'rgba(255,91,91,.1)' };

const WALLET_ICONS   = { visa:'💳', mastercard:'💳', paypal:'🅿️', bank:'🏦', cash:'💵', crypto:'₿', loan:'📋', asset:'📈', lending:'🤝', other:'👛' };
const WALLET_GRADIENTS = [
  'linear-gradient(135deg,#6C63FF,#5B8CFF)',
  'linear-gradient(135deg,#00b894,#55efc4)',
  'linear-gradient(135deg,#e17055,#fd79a8)',
  'linear-gradient(135deg,#0984e3,#74b9ff)',
  'linear-gradient(135deg,#6ab04c,#badc58)',
  'linear-gradient(135deg,#1A1033,#3d3473)',
];

// Steps: 1=Upload  2=Pick Account  3=Review  4=Done
const STEPS = ['Upload File', 'Select Account', 'Review & Map', 'Done'];

export default function Import() {
  const qc = useQueryClient();
  const t = useT();
  const fmt = useFmt();
  const fileRef = useRef();

  const [step,      setStep]     = useState(1);
  const [source,    setSource]   = useState('auto');
  const [preview,   setPreview]  = useState(null);
  const [rows,      setRows]     = useState([]);
  const [walletId,  setWalletId] = useState(null);
  const [filter,    setFilter]   = useState('all');
  const [dragOver,  setDragOver] = useState(false);
  const [result,    setResult]   = useState(null);
  const [search,    setSearch]   = useState('');
  const [reconciled, setReconciled] = useState(false);

  // Receipt scan (from Paytm/GPay "Share → Tracksy" or manual upload)
  const [scanned,  setScanned]  = useState(null);  // parsed receipt for review
  const [scanning, setScanning] = useState(false);
  const [scanErr,  setScanErr]  = useState('');
  const receiptRef = useRef();

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsAPI.getAll().then(r => r.data.data),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getAll().then(r => r.data.data),
  });

  const runScan = async (file) => {
    if (!file) return;
    setScanning(true); setScanErr('');
    try {
      const res = await receiptAPI.scan(file);
      setScanned(res.data.data);
    } catch (e) {
      setScanErr(e.response?.data?.message || 'Could not read the screenshot. Try a clearer image.');
    }
    setScanning(false);
  };

  // Picked up a shared image from the PWA share-target (Paytm → Share → Tracksy)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('shared') !== '1') return;
    (async () => {
      try {
        const cache = await caches.open('tracksy-shared');
        const resp  = await cache.match('/__shared_receipt');
        if (resp) {
          const blob = await resp.blob();
          await cache.delete('/__shared_receipt');
          await runScan(new File([blob], 'receipt.jpg', { type: blob.type || 'image/jpeg' }));
        }
        window.history.replaceState({}, '', '/import'); // clean the URL
      } catch (_) {}
    })();
  }, []);

  // Only non-debt wallets for account selection
  const bankWallets = wallets.filter(w => !['visa','mastercard','loan'].includes(w.type));

  const previewMut = useMutation({
    mutationFn: (formData) => importAPI.preview(formData).then(r => r.data),
    onSuccess: (data) => {
      setPreview(data.data);
      setRows(data.data.transactions.map((t, i) => ({ ...t, _id: i, skip: false, status: 'new' })));
      setStep(2);
    },
  });

  const reconcileMut = useMutation({
    mutationFn: (txns) => importAPI.reconcile(txns).then(r => r.data),
    onSuccess: (data) => {
      setRows(data.data.transactions.map((t, i) => ({
        ...t, _id: i,
        // auto-skip already matched; possible duplicates default to skip too
        skip: t.status === 'matched' || t.status === 'possible_duplicate',
      })));
      setReconciled(true);
    },
  });

  const confirmMut = useMutation({
    mutationFn: () => importAPI.confirm(rows, walletId).then(r => r.data),
    onSuccess: (data) => {
      setResult(data.data);
      setStep(4);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
    },
  });

  const handleFile = (file) => {
    if (!file) return;
    // Always send as multipart FormData — works for both PDF and CSV
    const fd = new FormData();
    fd.append('file', file);
    fd.append('filename', file.name);
    fd.append('source', source || 'auto');
    previewMut.mutate(fd);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const toggleSkip      = (id) => setRows(r => r.map(row => row._id===id ? {...row, skip:!row.skip} : row));
  const unskipAll       = ()   => setRows(r => r.map(row => ({...row, skip:false})));
  const skipVisible     = ()   => setRows(r => r.map(row => visibleIds.has(row._id) ? {...row,skip:true} : row));
  const updateCategory  = (id, category_id, category_name) =>
    setRows(r => r.map(row => row._id===id ? {...row,category_id,category_name} : row));

  const visibleIds = new Set(
    rows.filter(row => {
      if (filter !== 'all' && row.type !== filter) return false;
      if (search && !`${row.merchant} ${row.description} ${row.category_name}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).map(row => row._id)
  );
  const visible      = rows.filter(row => visibleIds.has(row._id));
  const activeCount  = rows.filter(row => !row.skip).length;
  const incomeTotal  = rows.filter(row => !row.skip && row.type==='income').reduce((s,row)=>s+row.amount,0);
  const expenseTotal = rows.filter(row => !row.skip && row.type==='expense').reduce((s,row)=>s+row.amount,0);

  const selectedWallet = wallets.find(w => w.id === walletId);

  const reset = () => {
    setStep(1); setPreview(null); setRows([]); setWalletId(null);
    setResult(null); setFilter('all'); setSearch(''); setReconciled(false);
    previewMut.reset(); reconcileMut.reset(); confirmMut.reset();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <Topbar title={t('import_title')} subtitle={t('import_sub')}/>
      <div style={{ padding:'24px 32px 40px', flex:1, overflow:'auto' }}>

        {/* ── Step indicator ── */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:32, maxWidth:600 }}>
          {STEPS.map((label, i) => {
            const s = i + 1;
            const done   = step > s;
            const active = step === s;
            return (
              <div key={s} style={{ display:'flex', alignItems:'center', flex: i < STEPS.length-1 ? 1 : 'none' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                  <div style={{
                    width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:700, fontSize:13, transition:'all .3s',
                    background: done ? '#37D67A' : active ? '#6C63FF' : 'var(--surface3)',
                    color: done||active ? '#fff' : 'var(--text3)',
                    boxShadow: active ? '0 4px 14px rgba(108,99,255,.45)' : 'none',
                  }}>
                    {done ? <Check size={15}/> : s}
                  </div>
                  <span style={{ fontSize:10.5, fontWeight:600, color: active?'var(--accent)':'var(--text3)', whiteSpace:'nowrap' }}>{label}</span>
                </div>
                {i < STEPS.length-1 && (
                  <div style={{ flex:1, height:2, margin:'0 6px 18px', transition:'background .3s',
                    background: done ? '#37D67A' : 'var(--surface3)' }}/>
                )}
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════
            STEP 1 — Upload
        ══════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ maxWidth:600 }}>

            {/* ── Scan a payment screenshot ── */}
            <div style={{ marginBottom:22, padding:'16px 18px', borderRadius:16, border:'1.5px solid var(--accent)', background:'var(--accent-light)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <div style={{ width:42, height:42, borderRadius:12, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Camera size={22} color="#fff"/>
                </div>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>Scan a payment screenshot</div>
                  <div style={{ fontSize:12, color:'var(--text3)' }}>Paytm / GPay / PhonePe receipt → auto-filled transaction</div>
                </div>
                <input ref={receiptRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => runScan(e.target.files[0])}/>
                <button onClick={() => receiptRef.current?.click()} disabled={scanning}
                  style={{ padding:'10px 18px', borderRadius:11, border:'none', background:'var(--accent)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                  {scanning ? '⟳ Reading…' : '📷 Upload Screenshot'}
                </button>
              </div>
              {scanErr && <div style={{ marginTop:10, fontSize:12.5, color:'#FF5B5B' }}>⚠️ {scanErr}</div>}
              <div style={{ marginTop:10, fontSize:11.5, color:'var(--text3)' }}>
                💡 Tip: install Tracksy to your home screen, then use <strong>Share → Tracksy</strong> directly from Paytm/GPay.
              </div>
            </div>

            {/* ── Source picker ── */}
            <div style={{ marginBottom:22 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text2)', marginBottom:12 }}>
                📂 Or import a statement file:
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
                {SOURCE_OPTIONS.map(opt => {
                  const sel = source === opt.id;
                  return (
                    <button key={opt.id} onClick={() => setSource(opt.id)}
                      style={{
                        padding:'14px 8px 10px', borderRadius:16, border:'2px solid',
                        borderColor: sel ? opt.color : 'var(--border)',
                        background: sel ? `${opt.color}15` : 'var(--surface)',
                        cursor:'pointer', textAlign:'center', transition:'all .18s',
                        boxShadow: sel ? `0 4px 16px ${opt.color}30` : 'none',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                      }}>
                      {/* Logo or fallback icon */}
                      <div style={{ position:'relative' }}>
                        {opt.logo ? (
                          <PaymentLogo method={opt.logo} size={40}
                            style={{ borderRadius:12, boxShadow: sel ? `0 2px 10px ${opt.color}44` : '0 1px 4px rgba(0,0,0,.1)' }}/>
                        ) : (
                          <div style={{ width:40, height:40, borderRadius:12, background:`${opt.color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <ScanSearch size={20} color={opt.color}/>
                          </div>
                        )}
                        {sel && (
                          <div style={{ position:'absolute', top:-4, right:-4, width:16, height:16, borderRadius:'50%', background:opt.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Check size={9} color="#fff" strokeWidth={3}/>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color: sel ? opt.color : 'var(--text3)', lineHeight:1.2 }}>{opt.label}</div>
                    </button>
                  );
                })}
              </div>
              {source && (
                <div style={{ marginTop:10, fontSize:12, color:'var(--text3)', background:'var(--surface2)', borderRadius:9, padding:'8px 12px' }}>
                  💡 {SOURCE_OPTIONS.find(s=>s.id===source)?.hint}
                </div>
              )}
            </div>

            {/* ── Drop zone ── */}
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border:`2px dashed ${dragOver?'#6C63FF':'var(--border)'}`,
                borderRadius:24, padding:'48px 32px', textAlign:'center', cursor:'pointer',
                background: dragOver?'rgba(108,99,255,.06)':'var(--surface)',
                transition:'all .2s', marginBottom:16,
              }}>
              <input ref={fileRef} type="file" accept=".txt,.csv,.pdf,.xlsx,.xls" style={{display:'none'}}
                onChange={e => handleFile(e.target.files[0])}/>
              <div style={{ width:64, height:64, borderRadius:20, background:'rgba(108,99,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <Upload size={28} color="#6C63FF"/>
              </div>
              <div style={{ fontSize:17, fontWeight:800, color:'var(--text)', marginBottom:6 }}>
                {dragOver ? 'Drop it here!' : 'Drop your statement here'}
              </div>
              <div style={{ fontSize:12.5, color:'var(--text3)', marginBottom:18 }}>
                Supports <strong>Excel .xlsx</strong> ⭐ · PDF · CSV · TXT
              </div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 22px', borderRadius:20,
                background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', color:'#fff', fontWeight:700, fontSize:13,
                boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
                <FileText size={15}/> Choose File
              </div>
            </div>

            {previewMut.isPending && (
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'var(--text3)', fontSize:13, padding:'12px 0' }}>
                <div style={{ width:18, height:18, border:'2px solid #6C63FF', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
                Parsing statement...
              </div>
            )}
            {previewMut.isError && (
              <div style={{ display:'flex', alignItems:'center', gap:8, color:'#FF5B5B', fontSize:13, padding:'12px 16px', background:'rgba(255,91,91,.08)', borderRadius:12, border:'1px solid rgba(255,91,91,.2)', marginBottom:16 }}>
                <AlertCircle size={16}/> {previewMut.error?.response?.data?.message || 'Could not parse file. Try selecting the correct source above.'}
              </div>
            )}

            {/* Supported formats */}
            <div style={{ background:'var(--surface)', borderRadius:16, padding:'14px 18px', border:'1px solid var(--border-light)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>Supported Formats</div>
              <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                {[
                  {l:'✅ Paytm Excel ⭐'},
                  {l:'✅ Paytm PDF'},
                  {l:'✅ HDFC Bank CSV'},
                  {l:'✅ PhonePe CSV'},
                  {l:'✅ GPay CSV'},
                  {l:'🔜 ICICI / SBI'},
                ].map(b => (
                  <span key={b.l} style={{ padding:'4px 11px', borderRadius:20,
                    background: b.l.startsWith('✅') ? 'rgba(55,214,122,.1)' : 'var(--surface2)',
                    color: b.l.startsWith('✅') ? '#37D67A' : 'var(--text3)',
                    fontSize:11.5, fontWeight:600 }}>{b.l}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 2 — Select Account
        ══════════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ maxWidth:620 }}>
            {/* Summary of parsed file */}
            <div style={{ background:'rgba(108,99,255,.07)', border:'1px solid rgba(108,99,255,.2)', borderRadius:16, padding:'14px 18px', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'rgba(108,99,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <FileText size={18} color="#6C63FF"/>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{preview?.filename || 'Statement'}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                  {preview?.total} transactions found · {fmt(preview?.total_credit||0)} credits · {fmt(preview?.total_debit||0)} debits
                </div>
              </div>
            </div>

            <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', marginBottom:6 }}>
              {t('import_which_acc')}
            </div>
            <div style={{ fontSize:13, color:'var(--text3)', marginBottom:20 }}>
              Transactions will be linked to the selected account. You can also skip this.
            </div>

            {/* Account cards grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:20 }}>

              {/* "No account" option */}
              <div onClick={() => setWalletId(null)}
                style={{
                  borderRadius:18, padding:'18px 16px', cursor:'pointer', transition:'all .2s',
                  border: walletId===null ? '2px solid #6C63FF' : '2px solid var(--border)',
                  background: walletId===null ? 'rgba(108,99,255,.08)' : 'var(--surface)',
                  boxShadow: walletId===null ? '0 4px 16px rgba(108,99,255,.2)' : 'none',
                  position:'relative',
                }}>
                {walletId===null && (
                  <div style={{ position:'absolute', top:10, right:10, width:20, height:20, borderRadius:'50%', background:'#6C63FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Check size={12} color="#fff"/>
                  </div>
                )}
                <div style={{ fontSize:28, marginBottom:8 }}>🚫</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{t('import_no_acc')}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Import without linking</div>
              </div>

              {/* Real wallet cards */}
              {bankWallets.map((w, i) => {
                const selected = walletId === w.id;
                const bal = parseFloat(w.balance || 0);
                return (
                  <div key={w.id} onClick={() => setWalletId(w.id)}
                    style={{
                      borderRadius:18, padding:'18px 16px', cursor:'pointer', transition:'all .2s',
                      border: selected ? '2px solid #6C63FF' : '2px solid transparent',
                      background: selected
                        ? 'rgba(108,99,255,.08)'
                        : WALLET_GRADIENTS[i % WALLET_GRADIENTS.length],
                      boxShadow: selected ? '0 4px 20px rgba(108,99,255,.25)' : '0 4px 16px rgba(0,0,0,.12)',
                      position:'relative', color: selected ? 'var(--text)' : '#fff',
                      transform: selected ? 'translateY(-3px)' : 'none',
                    }}>
                    {selected && (
                      <div style={{ position:'absolute', top:10, right:10, width:22, height:22, borderRadius:'50%', background:'#6C63FF', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(108,99,255,.5)' }}>
                        <Check size={13} color="#fff"/>
                      </div>
                    )}
                    {/* Decorative circle */}
                    {!selected && <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.07)' }}/>}

                    <div style={{ fontSize:26, marginBottom:8 }}>{WALLET_ICONS[w.type]||'👛'}</div>
                    <div style={{ fontSize:13, fontWeight:800, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</div>
                    <div style={{ fontSize:11, opacity: selected ? 0.6 : 0.75, textTransform:'capitalize', marginBottom:8 }}>{w.type}</div>
                    <div style={{ fontSize:14, fontWeight:900, fontFamily:'Space Grotesk, Inter, sans-serif' }}>
                      {fmt(Math.abs(bal),{noDecimals:true})}
                    </div>
                    {w.last_four && (
                      <div style={{ fontSize:10, opacity:0.65, marginTop:4, letterSpacing:2 }}>•••• {w.last_four}</div>
                    )}
                  </div>
                );
              })}

              {bankWallets.length === 0 && (
                <div style={{ gridColumn:'1/-1', padding:'20px', textAlign:'center', color:'var(--text3)', fontSize:13, background:'var(--surface2)', borderRadius:14 }}>
                  No accounts yet. You can still import without linking.
                </div>
              )}
            </div>

            {/* Selected summary */}
            <div style={{ background:'var(--surface)', borderRadius:14, padding:'13px 18px', border:'1px solid var(--border-light)', marginBottom:24, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:20 }}>{selectedWallet ? WALLET_ICONS[selectedWallet.type]||'👛' : '🚫'}</div>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:13, color:'var(--text3)' }}>Importing to: </span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
                  {selectedWallet ? selectedWallet.name : 'No account (unlinked)'}
                </span>
              </div>
            </div>

            <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
              <button onClick={reset} style={{ padding:'10px 20px', borderRadius:12, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                {t('common_back')}
              </button>
              <button onClick={() => { reconcileMut.mutate(rows); setStep(3); }}
                style={{ padding:'11px 28px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 14px rgba(108,99,255,.35)', display:'flex', alignItems:'center', gap:8 }}>
                <GitMerge size={15}/> Reconcile & Review
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 3 — Review & Map
        ══════════════════════════════════════════ */}
        {step === 3 && preview && (
          <div>
            {/* Account badge */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:20, background:'rgba(108,99,255,.1)', border:'1px solid rgba(108,99,255,.25)', marginBottom:16, cursor:'pointer' }}
              onClick={() => setStep(2)}>
              <span style={{ fontSize:16 }}>{selectedWallet ? WALLET_ICONS[selectedWallet.type]||'👛' : '🚫'}</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#6C63FF' }}>{selectedWallet ? selectedWallet.name : 'No account'}</span>
              <span style={{ fontSize:11, color:'var(--text3)' }}>· tap to change</span>
            </div>

            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:18 }}>
              {[
                { label:'Total Found',      value:preview.total,            color:'var(--text)',  mono:false },
                { label:'To Import',        value:activeCount,              color:'#6C63FF',      mono:false },
                { label:'Credits',          value: fmt(incomeTotal),         color:'#37D67A',      mono:true  },
                { label:'Debits',           value: fmt(expenseTotal),        color:'#FF5B5B',      mono:true  },
              ].map(({label,value,color,mono}) => (
                <div key={label} style={{ background:'var(--surface)', borderRadius:14, padding:'12px 16px', border:'1px solid var(--border-light)' }}>
                  <div style={{ fontSize:10.5, color:'var(--text3)', fontWeight:600, marginBottom:3 }}>{label}</div>
                  <div className={mono?'mono':''} style={{ fontSize:17, fontWeight:800, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              <div style={{ display:'flex', gap:3, background:'var(--surface2)', borderRadius:10, padding:3 }}>
                {['all','income','expense'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding:'6px 13px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, transition:'all .18s',
                      background: filter===f ? 'var(--surface)' : 'transparent',
                      color: filter===f ? (f==='income'?'#37D67A':f==='expense'?'#FF5B5B':'var(--accent)') : 'var(--text3)',
                      boxShadow: filter===f ? '0 2px 6px rgba(0,0,0,.08)' : 'none' }}>
                    {f[0].toUpperCase()+f.slice(1)}
                  </button>
                ))}
              </div>
              <input placeholder="Search merchant…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ flex:1, minWidth:160, padding:'7px 13px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, outline:'none' }}/>
              <button onClick={unskipAll}   style={{ padding:'7px 13px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, fontWeight:600, cursor:'pointer' }}>Select All</button>
              <button onClick={skipVisible} style={{ padding:'7px 13px', borderRadius:10, border:'1px solid rgba(255,91,91,.3)', background:'rgba(255,91,91,.07)', color:'#FF5B5B', fontSize:12, fontWeight:600, cursor:'pointer' }}>Skip Visible</button>
            </div>

            {/* Reconciliation summary */}
            {reconciled && (
              <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                {[
                  { label:'✅ Already in App', count: rows.filter(r=>r.status==='matched').length,            bg:'rgba(55,214,122,.1)',  color:'#37D67A' },
                  { label:'🆕 New — needs approval', count: rows.filter(r=>r.status==='new').length,         bg:'rgba(108,99,255,.1)', color:'var(--accent)' },
                  { label:'⚠️ Possible duplicate', count: rows.filter(r=>r.status==='possible_duplicate').length, bg:'rgba(255,184,77,.1)', color:'#FFB84D' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:12, background:s.bg }}>
                    <span style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.count}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.label}</span>
                  </div>
                ))}
                {reconcileMut.isPending && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text3)' }}>
                    <div style={{ width:14, height:14, border:'2px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
                    Checking against existing transactions...
                  </div>
                )}
              </div>
            )}

            {/* Table */}
            <div style={{ background:'var(--surface)', borderRadius:18, border:'1px solid var(--border-light)', overflow:'hidden', marginBottom:18 }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
                  <thead>
                    <tr style={{ background:'var(--surface2)', borderBottom:'1px solid var(--border-light)' }}>
                      {['','Date','Merchant','Amount','Category','Status','Action'].map((h,i) => (
                        <th key={i} style={{ padding:'10px 13px', textAlign:i===3?'right':'left', fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 && (
                      <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>No transactions match filters</td></tr>
                    )}
                    {visible.map(tx => (
                      <tr key={tx._id} style={{ borderBottom:'1px solid var(--border-light)', opacity:tx.skip?.38:1, transition:'opacity .15s', background:tx.skip?'var(--surface2)':'transparent' }}>
                        {/* Checkbox */}
                        <td style={{ padding:'9px 8px 9px 13px', width:30 }}>
                          <div onClick={() => toggleSkip(tx._id)} style={{ width:18, height:18, borderRadius:5, cursor:'pointer',
                            border: tx.skip?'1.5px solid var(--border)':'1.5px solid #6C63FF',
                            background: tx.skip?'transparent':'#6C63FF',
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {!tx.skip && <Check size={10} color="#fff"/>}
                          </div>
                        </td>
                        {/* Date */}
                        <td style={{ padding:'9px 13px', fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>
                          {new Date(tx.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}
                        </td>
                        {/* Merchant */}
                        <td style={{ padding:'9px 13px', maxWidth:200 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.merchant}</div>
                          <div style={{ fontSize:10.5, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:190 }}>{tx.narration.substring(0,55)}</div>
                        </td>
                        {/* Amount */}
                        <td style={{ padding:'9px 13px', textAlign:'right', whiteSpace:'nowrap' }}>
                          <span className="mono" style={{ fontSize:13, fontWeight:800, color:TYPE_COLOR[tx.type] }}>
                            {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                          </span>
                        </td>
                        {/* Category */}
                        <td style={{ padding:'7px 13px', minWidth:130 }}>
                          <select value={tx.category_id||''} onChange={e => {
                            const cat = categories.find(c=>c.id===e.target.value);
                            updateCategory(tx._id, e.target.value||null, cat?.name||tx.category_name);
                          }} style={{ padding:'4px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:12, cursor:'pointer', maxWidth:145 }}>
                            <option value="">— {tx.category_name} —</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                          </select>
                        </td>
                        {/* Status badge */}
                        <td style={{ padding:'7px 13px', whiteSpace:'nowrap' }}>
                          {tx.status === 'matched' ? (
                            <span style={{ padding:'3px 9px', borderRadius:20, fontSize:10.5, fontWeight:700, background:'rgba(55,214,122,.12)', color:'#37D67A' }}>✅ Matched</span>
                          ) : tx.status === 'possible_duplicate' ? (
                            <span style={{ padding:'3px 9px', borderRadius:20, fontSize:10.5, fontWeight:700, background:'rgba(255,184,77,.12)', color:'#FFB84D' }}>⚠️ Duplicate?</span>
                          ) : (
                            <span style={{ padding:'3px 9px', borderRadius:20, fontSize:10.5, fontWeight:700, background:'rgba(108,99,255,.1)', color:'var(--accent)' }}>🆕 New</span>
                          )}
                        </td>
                        {/* Approve toggle */}
                        <td style={{ padding:'7px 10px', width:60, textAlign:'center' }}>
                          {tx.status !== 'matched' && (
                            <button onClick={() => toggleSkip(tx._id)}
                              title={tx.skip ? 'Click to approve' : 'Click to skip'}
                              style={{ padding:'4px 10px', borderRadius:8, border:'1.5px solid', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .15s',
                                borderColor: tx.skip ? 'var(--border)' : '#37D67A',
                                background: tx.skip ? 'var(--surface2)' : 'rgba(55,214,122,.1)',
                                color: tx.skip ? 'var(--text3)' : '#37D67A',
                              }}>
                              {tx.skip ? 'Skip' : 'Add'}
                            </button>
                          )}
                          {tx.status === 'matched' && (
                            <span style={{ fontSize:11, color:'var(--text3)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:12, alignItems:'center', justifyContent:'flex-end' }}>
              <button onClick={() => setStep(2)} style={{ padding:'10px 20px', borderRadius:12, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                {t('common_back')}
              </button>
              <button onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending || activeCount===0}
                style={{ padding:'11px 28px', borderRadius:12, border:'none', fontWeight:700, fontSize:14, cursor:activeCount===0?'not-allowed':'pointer', transition:'all .2s',
                  background: activeCount===0 ? 'var(--surface3)' : 'linear-gradient(135deg,#6C63FF,#5B8CFF)',
                  color: activeCount===0 ? 'var(--text3)' : '#fff',
                  boxShadow: activeCount>0 ? '0 4px 14px rgba(108,99,255,.35)' : 'none' }}>
                {confirmMut.isPending ? `⏳ ${t('common_loading')}` : `${t('import_import_btn')} (${activeCount})`}
              </button>
            </div>
            {confirmMut.isError && (
              <div style={{ marginTop:10, color:'#FF5B5B', fontSize:13 }}>⚠️ {confirmMut.error?.response?.data?.message||'Import failed. Try again.'}</div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 4 — Done
        ══════════════════════════════════════════ */}
        {step === 4 && result && (
          <div style={{ maxWidth:460, textAlign:'center', margin:'0 auto', padding:'48px 0' }}>
            <div style={{ width:84, height:84, borderRadius:'50%', background:'rgba(55,214,122,.12)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px', boxShadow:'0 0 0 14px rgba(55,214,122,.06)' }}>
              <CheckCircle size={42} color="#37D67A"/>
            </div>
            <div style={{ fontSize:24, fontWeight:900, color:'var(--text)', marginBottom:6 }}>{t('import_done')}</div>
            {selectedWallet && (
              <div style={{ fontSize:13, color:'var(--text3)', marginBottom:6 }}>
                Linked to <strong style={{color:'var(--text)'}}>{selectedWallet.name}</strong>
              </div>
            )}
            <div style={{ fontSize:13, color:'var(--text3)', marginBottom:28 }}>Your transactions have been added to Tracksy</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:32 }}>
              {[
                { label:'Imported', value:result.imported, color:'#37D67A' },
                { label:'Skipped',  value:result.skipped,  color:'#FFB84D' },
                { label:'Total',    value:result.total,    color:'var(--text)' },
              ].map(({label,value,color}) => (
                <div key={label} style={{ background:'var(--surface)', borderRadius:16, padding:'16px', border:'1px solid var(--border-light)' }}>
                  <div style={{ fontSize:26, fontWeight:900, color, marginBottom:4 }}>{value}</div>
                  <div style={{ fontSize:12, color:'var(--text3)', fontWeight:600 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button onClick={reset} style={{ padding:'11px 24px', borderRadius:12, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Import Another
              </button>
              <a href="/transactions" style={{ padding:'11px 24px', borderRadius:12, background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', color:'#fff', fontWeight:700, fontSize:13, textDecoration:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
                View Transactions →
              </a>
            </div>
          </div>
        )}
      </div>

      {scanned && (
        <ReceiptReviewModal
          data={scanned}
          wallets={wallets}
          categories={categories}
          fmt={fmt}
          onClose={() => setScanned(null)}
          onSaved={() => {
            setScanned(null);
            qc.invalidateQueries({ queryKey:['transactions'] });
            qc.invalidateQueries({ queryKey:['dashboard-summary'] });
            qc.invalidateQueries({ queryKey:['wallets'] });
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Review a scanned receipt before saving ───────────────────────────── */
function ReceiptReviewModal({ data, wallets, categories, fmt, onClose, onSaved }) {
  const [amount,   setAmount]   = useState(String(data.amount ?? ''));
  const [type,     setType]     = useState(data.type || 'expense');
  const [merchant, setMerchant] = useState(data.merchant || '');
  const [date,     setDate]     = useState(data.date || new Date().toISOString().split('T')[0]);
  const [catId,    setCatId]    = useState('');
  const [walletId, setWalletId] = useState(wallets?.[0]?.id || '');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  const catOpts = (categories || []).filter(c => c.type === type || c.type === 'both');
  const inputSt = { width:'100%', padding:'10px 13px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box' };
  const labelSt = { fontSize:11.5, fontWeight:700, color:'var(--text3)', marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'.05em' };

  const save = async () => {
    if (!amount || parseFloat(amount) <= 0) { setErr('Enter a valid amount'); return; }
    setSaving(true); setErr('');
    try {
      await transactionsAPI.create({
        type, amount: parseFloat(amount),
        description: merchant || 'Scanned receipt',
        payment_name: `Scanned (${data.source || 'upi'})`,
        wallet_id: walletId || null,
        category_id: catId || null,
        status: 'completed',
        transaction_date: date,
      });
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save'); setSaving(false);
    }
  };

  const typeColor = type === 'income' ? '#37D67A' : '#FF5B5B';

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:460 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:`${typeColor}1f`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>📷</div>
          <div style={{ flex:1 }}>
            <div className="modal-title" style={{ margin:0 }}>Review Scanned Receipt</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>From {data.source || 'screenshot'}{data.ref ? ` · Ref ${data.ref}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--text3)', cursor:'pointer' }}>×</button>
        </div>

        {err && <div style={{ background:'var(--red-light)', color:'#FF5B5B', padding:'9px 13px', borderRadius:10, marginBottom:14, fontSize:13 }}>⚠️ {err}</div>}

        {/* Type toggle */}
        <div style={{ display:'flex', background:'var(--surface2)', borderRadius:12, padding:4, marginBottom:14, gap:4 }}>
          {[['expense','📤 Expense','#FF5B5B'],['income','📥 Income','#37D67A']].map(([v,l,c]) => (
            <button key={v} onClick={() => { setType(v); setCatId(''); }}
              style={{ flex:1, padding:'8px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                background: type===v ? `${c}1f` : 'transparent', color: type===v ? c : 'var(--text3)' }}>{l}</button>
          ))}
        </div>

        <div style={{ display:'grid', gap:12 }}>
          <div>
            <label style={labelSt}>Amount *</label>
            <input style={{ ...inputSt, fontSize:18, fontWeight:800, color:typeColor }} type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/>
          </div>
          <div>
            <label style={labelSt}>Merchant / Note</label>
            <input style={inputSt} value={merchant} onChange={e=>setMerchant(e.target.value)}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={labelSt}>Category</label>
              <select style={inputSt} value={catId} onChange={e=>setCatId(e.target.value)}>
                <option value="">No category</option>
                {catOpts.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Date</label>
              <input style={inputSt} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
          </div>
          <div>
            <label style={labelSt}>Account</label>
            <select style={inputSt} value={walletId} onChange={e=>setWalletId(e.target.value)}>
              <option value="">No account</option>
              {(wallets||[]).map(w => <option key={w.id} value={w.id}>{w.name}{w.last_four?` *${w.last_four}`:''}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ padding:'10px 24px', borderRadius:12, border:'none', fontWeight:700, fontSize:14, cursor:'pointer', color:'#fff',
              background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', boxShadow:'0 4px 14px rgba(108,99,255,.3)' }}>
            {saving ? 'Saving…' : '✓ Save Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
}
