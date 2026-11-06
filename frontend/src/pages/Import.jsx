import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importAPI, walletsAPI, categoriesAPI, receiptAPI, transactionsAPI } from '../services/api';
import { Topbar } from '../components/ui';
import { Upload, FileText, CheckCircle, AlertCircle, X, Check, GitMerge, ScanSearch, Camera, Wallet, Ban } from 'lucide-react';
import { useT, useFmt } from '../i18n';
import PaymentLogo from '../components/PaymentLogo';
import ThemedSelect from '../components/ThemedSelect';
import { CategoryGlyph } from '../components/icons';
import { invalidateFinance } from '../lib/cache';

const SOURCE_OPTIONS = [
  { id:'hdfc',    label:'HDFC Bank',   logo:'bank',    color:'#003087', hint:'NetBanking → Statements → Download CSV / TXT' },
  { id:'paytm',   label:'Paytm',       logo:'paytm',   color:'#00B9F1', hint:'Paytm App → Passbook → Download Statement → Excel (.xlsx) ⭐ Best! or PDF/CSV' },
  { id:'phonepe', label:'PhonePe',     logo:'phonepe', color:'#5f259f', hint:'PhonePe → Profile → Account Statement → Export CSV' },
  { id:'gpay',    label:'GPay',        logo:'gpay',    color:'#4285F4', hint:'Google Takeout → Google Pay → transactions.csv' },
  { id:'auto',    label:'Auto Detect', logo:null,      color:'#1D4ED8', hint:'Let Tracksy figure out the format automatically' },
];

const TYPE_COLOR = { income:'#047857', expense:'#DC2626' };
const TYPE_BG    = { income:'rgba(4,120,87,.12)', expense:'rgba(220,38,38,.1)' };

const WALLET_ICONS   = { visa:'💳', mastercard:'💳', paypal:'🅿️', bank:'🏦', cash:'💵', crypto:'₿', loan:'📋', asset:'📈', lending:'🤝', other:'👛' };
const WALLET_GRADIENTS = [
  '#1D4ED8',
  'linear-gradient(135deg,#047857,#34D399)',
  'linear-gradient(135deg,#D97706,#fd79a8)',
  'linear-gradient(135deg,#0984e3,#60A5FA)',
  'linear-gradient(135deg,#6ab04c,#badc58)',
  'linear-gradient(135deg,#0B1F4B,#3d3473)',
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

  // Password-protected PDF flow
  const [pwNeeded, setPwNeeded] = useState(false);
  const [pwValue,  setPwValue]  = useState('');
  const [pwError,  setPwError]  = useState('');
  const [pwFile,   setPwFile]   = useState(null);
  const [parseErr, setParseErr] = useState(null);

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
      if (data && data.needsPassword) {
        setPwNeeded(true);
        setPwError(data.incorrect ? 'Incorrect password — please try again.' : '');
        return;
      }
      setPwNeeded(false); setPwValue(''); setParseErr(null);
      setPreview(data.data);
      setRows(data.data.transactions.map((t, i) => ({ ...t, _id: i, skip: false, status: 'new' })));
      setStep(2);
    },
    onError: (err) => {
      const d = err?.response?.data;
      setParseErr({ message: d?.message || 'Could not parse the file.', sample: d?.sample || '' });
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
      invalidateFinance(qc);
      invalidateFinance(qc);
      invalidateFinance(qc);
    },
  });

  const handleFile = (file, password) => {
    if (!file) return;
    setPwFile(file);
    // Always send as multipart FormData — works for both PDF and CSV
    const fd = new FormData();
    fd.append('file', file);
    fd.append('filename', file.name);
    fd.append('source', source || 'auto');
    if (password) fd.append('password', password);
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

  const submitPassword = () => {
    if (!pwValue.trim() || !pwFile) return;
    setPwError('');
    handleFile(pwFile, pwValue.trim());
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <Topbar title={t('import_title')} subtitle={t('import_sub')}/>

      {parseErr && (
        <div style={{ margin:'14px 32px 0', background:'rgba(217,119,6,.08)', border:'1.5px solid rgba(217,119,6,.3)', borderRadius:14, padding:'14px 16px' }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:'#D97706', marginBottom:6 }}>⚠️ {parseErr.message}</div>
          {parseErr.sample && (
            <>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:6 }}>Copy this sample and send it in chat so we can add your statement format:</div>
              <textarea readOnly value={parseErr.sample} onFocus={e=>e.target.select()}
                style={{ width:'100%', height:90, fontSize:11, fontFamily:'monospace', padding:'8px 10px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text2)', resize:'vertical', boxSizing:'border-box' }}/>
              <button onClick={()=>{ navigator.clipboard?.writeText(parseErr.sample); }}
                style={{ marginTop:8, fontSize:12.5, fontWeight:700, color:'#1D4ED8', background:'rgba(29,78,216,.1)', border:'none', borderRadius:9, padding:'6px 14px', cursor:'pointer' }}>Copy sample</button>
            </>
          )}
          <button onClick={()=>setParseErr(null)} style={{ marginLeft:8, marginTop:8, fontSize:12.5, color:'var(--text3)', background:'none', border:'none', cursor:'pointer' }}>Dismiss</button>
        </div>
      )}

      {pwNeeded && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && (setPwNeeded(false), setPwValue(''))}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-title">🔒 Password required</div>
            <div style={{ fontSize:13.5, color:'var(--text2)', marginBottom:16, lineHeight:1.5 }}>
              This PDF is password protected. Enter the password to unlock and read the statement. (HDFC statements are usually opened with a password from your welcome kit / customer ID.)
            </div>
            {pwError && <div style={{ background:'rgba(220,38,38,.08)', color:'#DC2626', padding:'9px 13px', borderRadius:10, marginBottom:12, fontSize:13, fontWeight:600 }}>⚠️ {pwError}</div>}
            <input type="password" autoFocus value={pwValue}
              onChange={e => setPwValue(e.target.value)}
              onKeyDown={e => e.key==='Enter' && submitPassword()}
              placeholder="PDF password"
              style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:15, outline:'none', boxSizing:'border-box', marginBottom:16 }}/>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setPwNeeded(false); setPwValue(''); }}>Cancel</button>
              <button className="btn btn-primary" disabled={!pwValue.trim() || previewMut.isPending} onClick={submitPassword}
                style={{ background:'#1D4ED8', border:'none' }}>
                {previewMut.isPending ? 'Unlocking…' : 'Unlock PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
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
                    background: done ? '#047857' : active ? '#1D4ED8' : 'var(--surface3)',
                    color: done||active ? '#fff' : 'var(--text3)',
                    boxShadow: active ? '0 4px 14px rgba(29,78,216,.45)' : 'none',
                  }}>
                    {done ? <Check size={15}/> : s}
                  </div>
                  <span style={{ fontSize:10.5, fontWeight:600, color: active?'var(--accent)':'var(--text3)', whiteSpace:'nowrap' }}>{label}</span>
                </div>
                {i < STEPS.length-1 && (
                  <div style={{ flex:1, height:2, margin:'0 6px 18px', transition:'background .3s',
                    background: done ? '#047857' : 'var(--surface3)' }}/>
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
                <div style={{ width:42, height:42, borderRadius:12, background:'var(--accent-btn)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Camera size={22} color="#fff"/>
                </div>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>Scan a payment screenshot</div>
                  <div style={{ fontSize:12, color:'var(--text3)' }}>Paytm / GPay / PhonePe receipt → auto-filled transaction</div>
                </div>
                <input ref={receiptRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => runScan(e.target.files[0])}/>
                <button onClick={() => receiptRef.current?.click()} disabled={scanning}
                  style={{ padding:'10px 18px', borderRadius:11, border:'none', background:'var(--accent-btn)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                  {scanning ? '⟳ Reading…' : '📷 Upload Screenshot'}
                </button>
              </div>
              {scanErr && <div style={{ marginTop:10, fontSize:12.5, color:'#DC2626' }}>⚠️ {scanErr}</div>}
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
                border:`2px dashed ${dragOver?'#1D4ED8':'var(--border)'}`,
                borderRadius:14, padding:'48px 32px', textAlign:'center', cursor:'pointer',
                background: dragOver?'rgba(29,78,216,.06)':'var(--surface)',
                transition:'all .2s', marginBottom:16,
              }}>
              <input ref={fileRef} type="file" accept=".txt,.csv,.pdf,.xlsx,.xls" style={{display:'none'}}
                onChange={e => handleFile(e.target.files[0])}/>
              <div style={{ width:64, height:64, borderRadius:14, background:'rgba(29,78,216,.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <Upload size={28} color="#1D4ED8"/>
              </div>
              <div style={{ fontSize:17, fontWeight:800, color:'var(--text)', marginBottom:6 }}>
                {dragOver ? 'Drop it here!' : 'Drop your statement here'}
              </div>
              <div style={{ fontSize:12.5, color:'var(--text3)', marginBottom:18 }}>
                Supports <strong>Excel .xlsx</strong> ⭐ · PDF · CSV · TXT
              </div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 22px', borderRadius:14,
                background:'#1D4ED8', color:'#fff', fontWeight:700, fontSize:13,
                boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}>
                <FileText size={15}/> Choose File
              </div>
            </div>

            {previewMut.isPending && (
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'var(--text3)', fontSize:13, padding:'12px 0' }}>
                <div style={{ width:18, height:18, border:'2px solid #1D4ED8', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
                Parsing statement...
              </div>
            )}
            {previewMut.isError && (
              <div style={{ display:'flex', alignItems:'center', gap:8, color:'#DC2626', fontSize:13, padding:'12px 16px', background:'rgba(220,38,38,.08)', borderRadius:12, border:'1px solid rgba(220,38,38,.2)', marginBottom:16 }}>
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
                  <span key={b.l} style={{ padding:'4px 11px', borderRadius:14,
                    background: b.l.startsWith('✅') ? 'rgba(4,120,87,.1)' : 'var(--surface2)',
                    color: b.l.startsWith('✅') ? '#047857' : 'var(--text3)',
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
            <div style={{ background:'rgba(29,78,216,.07)', border:'1px solid rgba(29,78,216,.2)', borderRadius:16, padding:'14px 18px', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'rgba(29,78,216,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <FileText size={18} color="#1D4ED8"/>
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
                  borderRadius:14, padding:'18px 16px', cursor:'pointer', transition:'all .2s',
                  border: walletId===null ? '2px solid #1D4ED8' : '2px solid var(--border)',
                  background: walletId===null ? 'rgba(29,78,216,.08)' : 'var(--surface)',
                  boxShadow: walletId===null ? '0 4px 16px rgba(29,78,216,.2)' : 'none',
                  position:'relative',
                }}>
                {walletId===null && (
                  <div style={{ position:'absolute', top:10, right:10, width:20, height:20, borderRadius:'50%', background:'#1D4ED8', display:'flex', alignItems:'center', justifyContent:'center' }}>
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
                      borderRadius:14, padding:'18px 16px', cursor:'pointer', transition:'all .2s',
                      border: selected ? '2px solid #1D4ED8' : '2px solid transparent',
                      background: selected
                        ? 'rgba(29,78,216,.08)'
                        : WALLET_GRADIENTS[i % WALLET_GRADIENTS.length],
                      boxShadow: selected ? '0 4px 20px rgba(29,78,216,.25)' : '0 4px 16px rgba(0,0,0,.12)',
                      position:'relative', color: selected ? 'var(--text)' : '#fff',
                      transform: selected ? 'translateY(-3px)' : 'none',
                    }}>
                    {selected && (
                      <div style={{ position:'absolute', top:10, right:10, width:22, height:22, borderRadius:'50%', background:'#1D4ED8', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(29,78,216,.5)' }}>
                        <Check size={13} color="#fff"/>
                      </div>
                    )}
                    {/* Decorative circle */}
                    {!selected && <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,.07)' }}/>}

                    <div style={{ fontSize:26, marginBottom:8 }}>{WALLET_ICONS[w.type]||'👛'}</div>
                    <div style={{ fontSize:13, fontWeight:800, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</div>
                    <div style={{ fontSize:11, opacity: selected ? 0.6 : 0.75, textTransform:'capitalize', marginBottom:8 }}>{w.type}</div>
                    <div style={{ fontSize:14, fontWeight:900, fontFamily:'Inter, sans-serif' }}>
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
                style={{ padding:'11px 28px', borderRadius:12, border:'none', background:'#1D4ED8', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:'0 4px 14px rgba(29,78,216,.35)', display:'flex', alignItems:'center', gap:8 }}>
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
            {/* ── Sticky top action bar ── */}
            <div style={{ position:'sticky', top:0, zIndex:10, background:'var(--bg)', borderBottom:'1px solid var(--border-light)', marginBottom:16, padding:'12px 0', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:14, background:'rgba(29,78,216,.1)', border:'1px solid rgba(29,78,216,.25)', cursor:'pointer', flexShrink:0 }}
                onClick={() => setStep(2)}>
                <span style={{ fontSize:16 }}>{selectedWallet ? WALLET_ICONS[selectedWallet.type]||'👛' : '🚫'}</span>
                <span style={{ fontSize:12, fontWeight:700, color:'#1D4ED8' }}>{selectedWallet ? selectedWallet.name : 'No account'}</span>
                <span style={{ fontSize:11, color:'var(--text3)' }}>· change</span>
              </div>
              <div style={{ flex:1 }}/>
              <button onClick={() => { setStep(1); setPreview(null); setRows([]); }}
                style={{ padding:'9px 18px', borderRadius:12, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending || activeCount===0}
                style={{ padding:'9px 22px', borderRadius:12, border:'none', fontWeight:700, fontSize:13, cursor:activeCount===0?'not-allowed':'pointer',
                  background: activeCount===0 ? 'var(--surface3)' : '#1D4ED8',
                  color: activeCount===0 ? 'var(--text3)' : '#fff',
                  boxShadow: activeCount>0 ? '0 4px 14px rgba(29,78,216,.35)' : 'none' }}>
                {confirmMut.isPending ? '⏳ Importing…' : `Import ${activeCount} transactions`}
              </button>
            </div>

            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:18 }}>
              {[
                { label:'Total Found',      value:preview.total,            color:'var(--text)',  mono:false },
                { label:'To Import',        value:activeCount,              color:'#1D4ED8',      mono:false },
                { label:'Credits',          value: fmt(incomeTotal),         color:'#047857',      mono:true  },
                { label:'Debits',           value: fmt(expenseTotal),        color:'#DC2626',      mono:true  },
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
                      color: filter===f ? (f==='income'?'#047857':f==='expense'?'#DC2626':'var(--accent)') : 'var(--text3)',
                      boxShadow: filter===f ? '0 2px 6px rgba(0,0,0,.08)' : 'none' }}>
                    {f[0].toUpperCase()+f.slice(1)}
                  </button>
                ))}
              </div>
              <input placeholder="Search merchant…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ flex:1, minWidth:160, padding:'7px 13px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:13, outline:'none' }}/>
              <button onClick={unskipAll}   style={{ padding:'7px 13px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, fontWeight:600, cursor:'pointer' }}>Select All</button>
              <button onClick={skipVisible} style={{ padding:'7px 13px', borderRadius:10, border:'1px solid rgba(220,38,38,.3)', background:'rgba(220,38,38,.07)', color:'#DC2626', fontSize:12, fontWeight:600, cursor:'pointer' }}>Skip Visible</button>
            </div>

            {/* Reconciliation summary */}
            {reconciled && (
              <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                {[
                  { label:'✅ Already in App', count: rows.filter(r=>r.status==='matched').length,            bg:'rgba(4,120,87,.1)',  color:'#047857' },
                  { label:'🆕 New — needs approval', count: rows.filter(r=>r.status==='new').length,         bg:'rgba(29,78,216,.1)', color:'var(--accent)' },
                  { label:'⚠️ Possible duplicate', count: rows.filter(r=>r.status==='possible_duplicate').length, bg:'rgba(217,119,6,.1)', color:'#D97706' },
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
            <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border-light)', overflow:'hidden', marginBottom:18 }}>
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
                            border: tx.skip?'1.5px solid var(--border)':'1.5px solid #1D4ED8',
                            background: tx.skip?'transparent':'#1D4ED8',
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
                          <div style={{ fontSize:10.5, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:190 }}>{(tx.narration || tx.description || '').substring(0,55)}</div>
                        </td>
                        {/* Amount */}
                        <td style={{ padding:'9px 13px', textAlign:'right', whiteSpace:'nowrap' }}>
                          <span className="mono" style={{ fontSize:13, fontWeight:800, color:TYPE_COLOR[tx.type] }}>
                            {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                          </span>
                        </td>
                        {/* Category */}
                        <td style={{ padding:'7px 13px', minWidth:130 }}>
                          <div style={{ width:150 }}>
                            <ThemedSelect compact value={tx.category_id||''}
                              placeholder={`— ${tx.category_name} —`}
                              onChange={v => {
                                const cat = categories.find(c=>c.id===v);
                                updateCategory(tx._id, v||null, cat?.name||tx.category_name);
                              }}
                              options={[{ value:'', label:`— ${tx.category_name} —` }, ...categories.map(c => ({ value:c.id, label:c.name, emoji:c.emoji }))]}/>
                          </div>
                        </td>
                        {/* Status badge */}
                        <td style={{ padding:'7px 13px', whiteSpace:'nowrap' }}>
                          {tx.status === 'matched' ? (
                            <span style={{ padding:'3px 9px', borderRadius:14, fontSize:10.5, fontWeight:700, background:'rgba(4,120,87,.12)', color:'#047857' }}>✅ Matched</span>
                          ) : tx.status === 'possible_duplicate' ? (
                            <span style={{ padding:'3px 9px', borderRadius:14, fontSize:10.5, fontWeight:700, background:'rgba(217,119,6,.12)', color:'#D97706' }}>⚠️ Duplicate?</span>
                          ) : (
                            <span style={{ padding:'3px 9px', borderRadius:14, fontSize:10.5, fontWeight:700, background:'rgba(29,78,216,.1)', color:'var(--accent)' }}>🆕 New</span>
                          )}
                        </td>
                        {/* Approve toggle */}
                        <td style={{ padding:'7px 10px', width:60, textAlign:'center' }}>
                          {tx.status !== 'matched' && (
                            <button onClick={() => toggleSkip(tx._id)}
                              title={tx.skip ? 'Click to approve' : 'Click to skip'}
                              style={{ padding:'4px 10px', borderRadius:8, border:'1.5px solid', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .15s',
                                borderColor: tx.skip ? 'var(--border)' : '#047857',
                                background: tx.skip ? 'var(--surface2)' : 'rgba(4,120,87,.1)',
                                color: tx.skip ? 'var(--text3)' : '#047857',
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
                  background: activeCount===0 ? 'var(--surface3)' : '#1D4ED8',
                  color: activeCount===0 ? 'var(--text3)' : '#fff',
                  boxShadow: activeCount>0 ? '0 4px 14px rgba(29,78,216,.35)' : 'none' }}>
                {confirmMut.isPending ? `⏳ ${t('common_loading')}` : `${t('import_import_btn')} (${activeCount})`}
              </button>
            </div>
            {confirmMut.isError && (
              <div style={{ marginTop:10, color:'#DC2626', fontSize:13 }}>⚠️ {confirmMut.error?.response?.data?.message||'Import failed. Try again.'}</div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            STEP 4 — Done
        ══════════════════════════════════════════ */}
        {step === 4 && result && (
          <div style={{ maxWidth:460, textAlign:'center', margin:'0 auto', padding:'48px 0' }}>
            <div style={{ width:84, height:84, borderRadius:'50%', background:'rgba(4,120,87,.12)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px', boxShadow:'0 0 0 14px rgba(4,120,87,.06)' }}>
              <CheckCircle size={42} color="#047857"/>
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
                { label:'Imported', value:result.imported, color:'#047857' },
                { label:'Skipped',  value:result.skipped,  color:'#D97706' },
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
              <a href="/transactions" style={{ padding:'11px 24px', borderRadius:12, background:'#1D4ED8', color:'#fff', fontWeight:700, fontSize:13, textDecoration:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}>
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
            invalidateFinance(qc);
            invalidateFinance(qc);
            invalidateFinance(qc);
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
  // Auto-match the scanned category name to one of the user's categories.
  // Exact name first, then first-word match ("Food" → "Food & Dining").
  const matchCat = (name) => {
    if (!name) return '';
    const n = name.trim().toLowerCase();
    const list = categories || [];
    const exact = list.find(c => c.name.toLowerCase() === n);
    if (exact) return exact.id;
    const word = n.split(/[^a-z]+/)[0];
    const partial = list.find(c => c.name.toLowerCase().startsWith(word));
    return partial ? partial.id : '';
  };
  const [catId,    setCatId]    = useState(() => matchCat(data.category));
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

  const typeColor = type === 'income' ? '#047857' : '#DC2626';

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

        {err && <div style={{ background:'var(--red-light)', color:'#DC2626', padding:'9px 13px', borderRadius:10, marginBottom:14, fontSize:13 }}>⚠️ {err}</div>}

        {/* Type toggle */}
        <div style={{ display:'flex', background:'var(--surface2)', borderRadius:12, padding:4, marginBottom:14, gap:4 }}>
          {[['expense','📤 Expense','#DC2626'],['income','📥 Income','#047857']].map(([v,l,c]) => (
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
              <ThemedSelect value={catId} onChange={setCatId} placeholder="No category"
                options={[{ value:'', label:'No category', icon:<Ban size={16} color="#5B6B7F"/> }, ...catOpts.map(c => ({ value:c.id, label:c.name, icon:<CategoryGlyph name={c.name} emoji={c.emoji} icon={c.icon} size={16}/> }))]}/>
            </div>
            <div>
              <label style={labelSt}>Date</label>
              <input style={inputSt} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
          </div>
          <div>
            <label style={labelSt}>Account</label>
            <ThemedSelect value={walletId} onChange={setWalletId} placeholder="No account"
              options={[{ value:'', label:'No account', icon:<Ban size={16} color="#5B6B7F"/> }, ...(wallets||[]).map(w => ({ value:w.id, label:`${w.name}${w.last_four?` *${w.last_four}`:''}`, icon:<Wallet size={16} color="#3B82F6"/> }))]}/>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:18, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ padding:'10px 24px', borderRadius:12, border:'none', fontWeight:700, fontSize:14, cursor:'pointer', color:'#fff',
              background:'#1D4ED8', boxShadow:'0 4px 14px rgba(29,78,216,.3)' }}>
            {saving ? 'Saving…' : '✓ Save Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
}
