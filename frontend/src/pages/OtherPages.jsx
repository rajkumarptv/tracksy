// ─── Wallet / Accounts page ───────────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletsAPI, transactionsAPI } from '../services/api';
import { Topbar, PageLoader, AmountText, StatusChip } from '../components/ui';
import { Plus, CreditCard, Wallet as WalletIcon, Calendar, ChevronDown } from 'lucide-react';
import PaymentLogo from '../components/PaymentLogo';
import { useT as useTWallet, useFmt as useFmtWallet } from '../i18n';
import useCurrencyStoreWallet, { CURRENCIES as WALLET_CURRENCIES } from '../store/currencyStore';

/* ── Date filter helpers ── */
const _now = new Date();
const WALLET_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WALLET_YEARS  = [_now.getFullYear(), _now.getFullYear()-1, _now.getFullYear()-2];

const WALLET_GRADIENTS = [
  '#1D4ED8',
  'linear-gradient(135deg,#0B1F4B 0%,#3d3473 100%)',
  'linear-gradient(135deg,#047857 0%,#34D399 100%)',
  'linear-gradient(135deg,#D97706 0%,#fd79a8 100%)',
  'linear-gradient(135deg,#0984e3 0%,#60A5FA 100%)',
  'linear-gradient(135deg,#6ab04c 0%,#badc58 100%)',
];

// Pick readable ink (dark/light) for a given card background colour
function cardInk(hex) {
  let h = (hex || '#1D4ED8').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0,2),16) || 0, g = parseInt(h.slice(2,4),16) || 0, b = parseInt(h.slice(4,6),16) || 0;
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;   // perceived brightness 0–1
  const dark = lum > 0.62;                            // light bg → dark text
  return dark
    ? { text:'#15151f', muted:'rgba(0,0,0,.6)', faint:'rgba(0,0,0,.45)', bar:'rgba(0,0,0,.15)', barFill:'rgba(0,0,0,.55)' }
    : { text:'#ffffff', muted:'rgba(255,255,255,.78)', faint:'rgba(255,255,255,.6)', bar:'rgba(255,255,255,.25)', barFill:'rgba(255,255,255,.85)' };
}

const WALLET_ICONS = { visa:'💳',mastercard:'💳',paypal:'🅿️',bank:'🏦',cash:'💵',crypto:'₿',loan:'📋',asset:'📈',lending:'🤝',other:'👛',paytm:'🟦',phonepe:'💜',gpay:'🟣',irctc:'🚂',amazon_pay:'🛒',mobikwik:'💙',jio_money:'🔴',airtel_money:'❤️' };
const WALLET_LABELS = { visa:'Visa',mastercard:'Mastercard',paypal:'PayPal',bank:'Bank Account',cash:'Cash',crypto:'Crypto',loan:'Loan',asset:'Asset',lending:'Lending',other:'Other',paytm:'Paytm Wallet',phonepe:'PhonePe',gpay:'Google Pay',irctc:'IRCTC Wallet',amazon_pay:'Amazon Pay',mobikwik:'MobiKwik',jio_money:'Jio Money',airtel_money:'Airtel Money' };


export function Wallet() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const fmt = useFmtHook();
  const t = useTWallet();
  // useAuthStore2 is imported further down in this module
  // but ES module imports are hoisted, so they're available here at call time
  const { user } = useAuthStore2();
  const { currency: walletCurrency } = useCurrencyStoreWallet();
  const currencySymbol = WALLET_CURRENCIES.find(c => c.code === walletCurrency)?.symbol || walletCurrency?.slice(0,2) || '$';

  /* ── Month / Year filter ── */
  const [selYear,  setSelYear]  = useState(_now.getFullYear());
  const [selMonth, setSelMonth] = useState(_now.getMonth() + 1); // 0 = all months

  const walletDateParams = useMemo(() => {
    if (selMonth > 0) {
      const sd = `${selYear}-${String(selMonth).padStart(2,'0')}-01`;
      const ed = selMonth === 12 ? `${selYear+1}-01-01` : `${selYear}-${String(selMonth+1).padStart(2,'0')}-01`;
      return { start_date: sd, end_date: ed };
    }
    return { start_date: `${selYear}-01-01`, end_date: `${selYear+1}-01-01` };
  }, [selYear, selMonth]);

  const periodLabel = selMonth > 0
    ? `${WALLET_MONTHS[selMonth-1]} ${selYear}`
    : `All of ${selYear}`;

  /* 6-month sparkline data */
  const { data: trendTx } = useQuery({
    queryKey: ['wallet-trend'],
    queryFn: () => transactionsAPI.getAll({ limit: 1000 }).then(r => r.data.data || []),
    staleTime: 5 * 60 * 1000,
  });

  const { netWorthTrend, assetsTrend, debtTrend } = useMemo(() => {
    const nw = [], assets = [], debt = [];
    const now = new Date();
    let runningNet = 0;
    for (let i = 5; i >= 0; i--) {
      const yr = now.getFullYear(), mo = now.getMonth() - i;
      const start = new Date(yr, mo, 1);
      const end   = new Date(yr, mo + 1, 0, 23, 59, 59);
      const slice = (trendTx || []).filter(tx => {
        const d = new Date(tx.transaction_date); return d >= start && d <= end;
      });
      const inc = slice.filter(tx => tx.type === 'income').reduce((s, tx)  => s + parseFloat(tx.amount||0), 0);
      const exp = slice.filter(tx => tx.type === 'expense').reduce((s, tx) => s + parseFloat(tx.amount||0), 0);
      runningNet += (inc - exp);
      assets.push(inc);
      debt.push(exp);
      nw.push(Math.max(0, runningNet));
    }
    return { netWorthTrend: nw, assetsTrend: assets, debtTrend: debt };
  }, [trendTx]);

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsAPI.getAll().then(r => r.data.data),
  });
  const { data: recentTx } = useQuery({
    queryKey: ['recent-transactions-wallet', walletDateParams],
    queryFn: () => transactionsAPI.getAll({ limit:20, ...walletDateParams }).then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => walletsAPI.delete(id),
    onSuccess: () => invalidateFinance(qc),
  });

  if (isLoading) return <PageLoader />;

  const renderWalletCard = (w, i) => {
    const isLiab = isLiabilityType(w.type);
    const bal    = parseFloat(w.balance || 0);
    const utilPct = w.credit_limit ? Math.min(100, Math.round((Math.abs(bal) / parseFloat(w.credit_limit)) * 100)) : 0;
    return (
      <div key={w.id} style={{
        background: WALLET_GRADIENTS[i % WALLET_GRADIENTS.length],
        borderRadius:14, padding:'24px 26px', color:'#fff',
        boxShadow:'0 8px 32px rgba(0,0,0,.15)',
        position:'relative', overflow:'hidden', transition:'all .22s ease',
      }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-4px)'}
      onMouseLeave={e=>e.currentTarget.style.transform=''}>
        <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, background:'rgba(255,255,255,.07)', borderRadius:'50%' }}/>
        <div style={{ position:'absolute', bottom:-20, left:'60%', width:70, height:70, background:'rgba(255,255,255,.05)', borderRadius:'50%' }}/>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <PaymentLogo method={w.type} size={32} style={{ borderRadius:8 }}/>
            <div>
              <div style={{ fontSize:13, fontWeight:700, opacity:.9 }}>{w.name}</div>
              <div style={{ fontSize:11, opacity:.65, textTransform:'capitalize' }}>
                {WALLET_LABELS[w.type] || w.type} {isLiab ? '· Liability' : '· Asset'}
              </div>
            </div>
          </div>
          <button onClick={() => { if(confirm(t('wallet_remove_confirm'))) deleteMutation.mutate(w.id); }}
            style={{ background:'rgba(255,255,255,.15)', border:'none', color:'#fff', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:12, fontWeight:600, backdropFilter:'blur(4px)' }}>
            {t('wallet_remove')}
          </button>
        </div>

        {w.last_four && (
          <div style={{ fontSize:14, letterSpacing:4, opacity:.7, marginBottom:16, fontFamily:'Inter, sans-serif', position:'relative', zIndex:1 }}>
            •••• •••• •••• {w.last_four}
          </div>
        )}

        <div style={{ position:'relative', zIndex:1 }}>
          {isLiab ? (
            <>
              <div style={{ fontSize:10, opacity:.65, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{t('wallet_outstanding')}</div>
              <div style={{ fontSize:24, fontWeight:900, fontFamily:'Inter, sans-serif', letterSpacing:-0.5 }}>
                {fmt(Math.abs(bal))}
              </div>
              {w.credit_limit && (
                <div style={{ marginTop:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, opacity:.75, marginBottom:4 }}>
                    <span>Limit: {fmt(parseFloat(w.credit_limit))}</span>
                    <span>{utilPct}% {t('wallet_used')}</span>
                  </div>
                  <div style={{ height:4, background:'rgba(255,255,255,.25)', borderRadius:14, overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:14, background:'rgba(255,255,255,.85)', transition:'width .4s', width:`${utilPct}%` }}/>
                  </div>
                </div>
              )}
              {w.emi_amount && (
                <div style={{ fontSize:11, opacity:.7, marginTop:8 }}>EMI: {fmt(parseFloat(w.emi_amount))}/mo</div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize:10, opacity:.65, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{t('wallet_balance')}</div>
              <div style={{ fontSize:24, fontWeight:900, fontFamily:'Inter, sans-serif', letterSpacing:-0.5 }}>
                {fmt(bal)}
              </div>
              {w.invested_amount && (
                <div style={{ fontSize:11, opacity:.7, marginTop:6 }}>
                  Invested: {fmt(parseFloat(w.invested_amount))} · {bal >= parseFloat(w.invested_amount) ? '📈' : '📉'} {((bal - parseFloat(w.invested_amount)) / parseFloat(w.invested_amount) * 100).toFixed(1)}%
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const openAddWallet = () => setShowModal(true);
  const assetWallets     = (wallets||[]).filter(w => !isLiabilityType(w.type));
  const liabilityWallets = (wallets||[]).filter(w => isLiabilityType(w.type));
  const totalAssets  = assetWallets.reduce((s,w) => s + parseFloat(w.balance||0), 0);
  const totalDebt    = liabilityWallets.reduce((s,w) => s + Math.abs(parseFloat(w.balance||0)), 0);
  const netWorth     = totalAssets - totalDebt;
  const totalCards   = (wallets||[]).filter(w => ['visa','mastercard'].includes(w.type)).length;
  const totalLoans   = (wallets||[]).filter(w => ['home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','emi'].includes(w.type)).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Mobile header */}
      <div className="mob-header">
        <div>
          <div className="mob-header-title">{t('wallet_title')}</div>
          <div className="mob-header-sub">{t('wallet_sub')}</div>
        </div>
      </div>

      {/* Desktop topbar */}
      <div className="mob-hide">
        <Topbar title={t('wallet_title')} subtitle={t('wallet_sub')}>
          <button className="btn btn-primary btn-sm"
            style={{ display:'flex', alignItems:'center', gap:6, background: atWalletLimit ? '#D97706' : '#1D4ED8', border:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}
            onClick={openAddWallet}>
            {atWalletLimit ? t('wallet_upgrade_add') : <><Plus size={13}/> {t('wallet_add')}</>}
          </button>
        </Topbar>
      </div>

      {/* ── Date Filter Bar ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'9px 28px',
        background:'var(--surface)', borderBottom:'1px solid var(--border-light)',
        flexWrap:'wrap',
      }}>
        <Calendar size={14} color="var(--text3)" style={{ flexShrink:0 }}/>

        {/* Year */}
        <div style={{ width:96 }}>
          <ThemedSelect compact value={selYear} onChange={v => setSelYear(Number(v))}
            options={WALLET_YEARS.map(y => ({ value:y, label:String(y) }))}/>
        </div>

        {/* Month */}
        <div style={{ width:140 }}>
          <ThemedSelect compact value={selMonth} onChange={v => setSelMonth(Number(v))}
            options={[{ value:0, label:t('tx_all_months') }, ...WALLET_MONTHS.map((m, i) => ({ value:i+1, label:m }))]}/>
        </div>

        {/* Period label */}
        <span style={{ marginLeft:'auto', fontSize:11.5, color:'var(--accent)', fontWeight:700,
          background:'var(--accent-light)', borderRadius:8, padding:'3px 10px',
          display:'flex', alignItems:'center', gap:4 }}>
          <Calendar size={10}/> {periodLabel}
        </span>
      </div>

      <div className="mob-content" style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>

        {/* Summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14, marginBottom:24 }}>
          {[
            { label:t('dash_net_worth'),      value: fmt(netWorth),    icon:<span style={{fontSize:22,fontWeight:800,color:'#1D4ED8',lineHeight:1,fontFamily:'Inter,sans-serif'}}>{currencySymbol}</span>, bg:'rgba(29,78,216,.15)', color: netWorth >= 0 ? '#1D4ED8' : '#DC2626', sub: netWorth >= 0 ? t('wallet_positive') : t('wallet_negative'), border:'rgba(29,78,216,.2)' },
            { label:t('wallet_total_assets'), value: fmt(totalAssets), icon:<WalletIcon size={22} color="#0D9488"/>,  bg:'rgba(0,200,150,.15)', color:'#0D9488', sub:t('wallet_all_accounts'), border:'rgba(0,200,150,.2)' },
            { label:t('wallet_total_debt'),   value: fmt(totalDebt),   icon:<CreditCard size={22} color="#DC2626"/>,  bg:'rgba(220,38,38,.15)',  color:'#DC2626', sub:t('wallet_cards_loans'), border:'rgba(220,38,38,.2)' },
          ].map(({ label, value, icon, bg, color, sub, border }) => (
            <div key={label} style={{
              background:'var(--surface)', borderRadius:14, padding:'18px 20px',
              boxShadow:'0 2px 16px rgba(29,78,216,.07)', border:`1px solid ${border}`,
              display:'flex', flexDirection:'row', alignItems:'center', gap:16,
            }}>
              <div style={{ width:52, height:52, borderRadius:14, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {icon}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0, flex:1 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>{label}</div>
                <div className="mono" style={{ fontSize:18, fontWeight:900, color, letterSpacing:-0.5, lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
                <div style={{ fontSize:11.5, color:'var(--text3)', fontWeight:500 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Net Worth hero banner */}
        <div style={{ background:'#1D4ED8', borderRadius:14, padding:'20px 24px', marginBottom:20, color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, opacity:.7, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Net Worth</div>
            <div style={{ fontSize:28, fontWeight:900, fontFamily:'Inter,sans-serif', letterSpacing:-1 }}>
              {netWorth < 0 ? '-' : ''}{fmt(Math.abs(netWorth))}
            </div>
            <div style={{ fontSize:11, opacity:.65, marginTop:2 }}>Total Assets − Total Liabilities</div>
          </div>
          <div style={{ display:'flex', gap:24 }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, fontWeight:700, opacity:.7, textTransform:'uppercase', letterSpacing:'.07em' }}>Assets</div>
              <div style={{ fontSize:18, fontWeight:800, color:'#047857' }}>{fmt(totalAssets)}</div>
              <div style={{ fontSize:11, opacity:.55 }}>{assetWallets.length} accounts</div>
            </div>
            <div style={{ width:1, background:'rgba(255,255,255,.2)' }}/>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, fontWeight:700, opacity:.7, textTransform:'uppercase', letterSpacing:'.07em' }}>Liabilities</div>
              <div style={{ fontSize:18, fontWeight:800, color:'#FF7B7B' }}>{fmt(totalDebt)}</div>
              <div style={{ fontSize:11, opacity:.55 }}>{liabilityWallets.length} accounts</div>
            </div>
          </div>
        </div>

        {/* Wallet cards */}
        <div style={{ marginBottom:24 }}>
          {/* Assets section */}
          {assetWallets.length > 0 && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#047857' }}/>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em' }}>
                  Assets — {fmt(totalAssets)}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(280px,100%),1fr))', gap:16, marginBottom:24 }}>
                {assetWallets.map((w,i) => renderWalletCard(w, i))}
              </div>
            </>
          )}
          {/* Liabilities section */}
          {liabilityWallets.length > 0 && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#DC2626' }}/>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em' }}>
                  Liabilities — {fmt(totalDebt)}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(280px,100%),1fr))', gap:16, marginBottom:24 }}>
                {liabilityWallets.map((w,i) => renderWalletCard(w, i + assetWallets.length))}
              </div>
            </>
          )}

          {!(wallets||[]).length && (
            <div style={{ background:'var(--surface)', borderRadius:14, boxShadow:'0 4px 24px rgba(29,78,216,.08)', border:'1px solid var(--border-light)', padding:'48px', textAlign:'center', color:'var(--text3)', fontSize:14 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>💳</div>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:6 }}>{t('wallet_empty')}</div>
              <div style={{ marginBottom:20 }}>{t('wallet_empty_desc')}</div>
              <button className="btn btn-primary" onClick={openAddWallet}
                style={{ background: atWalletLimit ? '#D97706' : '#1D4ED8', border:'none' }}>
                {atWalletLimit ? '👑 Upgrade to Add More' : t('wallet_add')}
              </button>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div style={{ background:'var(--surface)', borderRadius:14, boxShadow:'0 4px 24px rgba(29,78,216,.08)', border:'1px solid var(--border-light)', overflow:'hidden' }}>
          <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border-light)', fontWeight:700, fontSize:15, color:'var(--text)' }}>
            {t('wallet_recent')}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', minWidth:480, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--surface2)' }}>
                  {[t('tx_col_date'),t('tx_col_amount'),t('tx_col_name'),t('nav_accounts'),t('tx_col_status')].map(h => (
                    <th key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'left', padding:'12px 14px', borderBottom:'1px solid var(--border-light)', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(recentTx||[]).map(tx => (
                  <tr key={tx.id}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}
                    style={{ transition:'background .1s' }}>
                    <td style={{ padding:'11px 14px', borderBottom:'1px solid var(--border-light)', fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>
                      {new Date(tx.transaction_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </td>
                    <td style={{ padding:'11px 14px', borderBottom:'1px solid var(--border-light)', whiteSpace:'nowrap' }}>
                      <AmountText amount={tx.amount} type={tx.type}/>
                    </td>
                    <td style={{ padding:'11px 14px', borderBottom:'1px solid var(--border-light)', fontSize:13, fontWeight:600, color:'var(--text)', maxWidth:180, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {tx.payment_name || tx.description}
                    </td>
                    <td style={{ padding:'11px 14px', borderBottom:'1px solid var(--border-light)', fontSize:12, color:'var(--text3)', whiteSpace:'nowrap', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis' }}>
                      {tx.wallet_name}
                    </td>
                    <td style={{ padding:'11px 14px', borderBottom:'1px solid var(--border-light)' }}>
                      <StatusChip status={tx.status}/>
                    </td>
                  </tr>
                ))}
                {!(recentTx||[]).length && (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:'36px', color:'var(--text3)', fontSize:13 }}>{t('wallet_no_tx')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <AddWalletModal
          onClose={() => setShowModal(false)}
          onSaved={() => { invalidateFinance(qc); setShowModal(false); }}
        />
      )}

      {/* Mobile FAB */}
      <button className="mob-fab" onClick={openAddWallet}>
        <Plus size={26} color="#fff"/>
      </button>
    </div>
  );
}

/* ── Assets & Liabilities type system ── */
const ASSET_TYPES = [
  { group:'Bank & Cash', items:[
    { value:'bank',         icon:'🏦', label:'Bank Account',        color:'#3B82F6', bg:'rgba(59,130,246,.14)'  },
    { value:'cash',         icon:'💵', label:'Cash',                color:'#047857', bg:'rgba(4,120,87,.14)'  },
  ]},
  { group:'Digital Wallets & UPI', items:[
    { value:'gpay',         icon:'🟣', label:'Google Pay',          color:'#4285F4', bg:'rgba(66,133,244,.14)'  },
    { value:'phonepe',      icon:'💜', label:'PhonePe',             color:'#5f259f', bg:'rgba(95,37,159,.14)'   },
    { value:'paytm',        icon:'🟦', label:'Paytm',               color:'#00B9F1', bg:'rgba(0,185,241,.14)'   },
    { value:'amazon_pay',   icon:'🛒', label:'Amazon Pay',          color:'#FF9900', bg:'rgba(255,153,0,.14)'   },
    { value:'mobikwik',     icon:'💙', label:'MobiKwik',            color:'#3b5bdb', bg:'rgba(59,91,219,.14)'   },
    { value:'jio_money',    icon:'🔴', label:'Jio Money',           color:'#e03131', bg:'rgba(224,49,49,.14)'   },
    { value:'airtel_money', icon:'❤️', label:'Airtel Money',        color:'#e03131', bg:'rgba(224,49,49,.14)'   },
    { value:'paypal',       icon:'🅿️', label:'PayPal',              color:'#003087', bg:'rgba(0,48,135,.14)'   },
    { value:'irctc',        icon:'🚂', label:'IRCTC Wallet',        color:'#2563eb', bg:'rgba(37,99,235,.14)'   },
  ]},
  { group:'Investments', items:[
    { value:'fd',           icon:'🏛️', label:'Fixed Deposit',       color:'#0D9488', bg:'rgba(0,200,150,.14)'  },
    { value:'mutual_fund',  icon:'📊', label:'Mutual Funds',        color:'#1D4ED8', bg:'rgba(29,78,216,.14)' },
    { value:'stocks',       icon:'📈', label:'Stocks',              color:'#047857', bg:'rgba(4,120,87,.14)'  },
    { value:'gold',         icon:'🪙', label:'Gold',                color:'#D97706', bg:'rgba(217,119,6,.14)'  },
    { value:'crypto',       icon:'₿',  label:'Crypto',              color:'#F7931A', bg:'rgba(247,147,26,.14)'  },
    { value:'epf',          icon:'🛡️', label:'EPF / PPF',           color:'#60A5FA', bg:'rgba(162,155,254,.14)' },
  ]},
  { group:'Other Assets', items:[
    { value:'real_estate',  icon:'🏠', label:'Real Estate',         color:'#F87171', bg:'rgba(255,121,168,.14)' },
    { value:'lending',      icon:'🤝', label:'Money Lent',          color:'#0D9488', bg:'rgba(0,206,201,.14)'  },
    { value:'asset',        icon:'💼', label:'Other Asset',         color:'#636E72', bg:'rgba(99,110,114,.14)'  },
  ]},
];

const LIABILITY_TYPES = [
  { group:'Credit Cards', items:[
    { value:'visa',         icon:'💳', label:'Visa Card',           color:'#DC2626', bg:'rgba(220,38,38,.14)'   },
    { value:'mastercard',   icon:'💳', label:'Mastercard',          color:'#EB001B', bg:'rgba(235,0,27,.14)'    },
  ]},
  { group:'Loans', items:[
    { value:'home_loan',    icon:'🏠', label:'Home Loan',           color:'#DC2626', bg:'rgba(220,38,38,.14)'   },
    { value:'vehicle_loan', icon:'🚗', label:'Vehicle Loan',        color:'#D97706', bg:'rgba(217,119,6,.14)'  },
    { value:'personal_loan',icon:'💼', label:'Personal Loan',       color:'#F87171', bg:'rgba(255,121,168,.14)' },
    { value:'gold_loan',    icon:'🪙', label:'Gold Loan',           color:'#D97706', bg:'rgba(217,119,6,.14)'  },
    { value:'education_loan',icon:'🎓',label:'Education Loan',      color:'#3B82F6', bg:'rgba(59,130,246,.14)'  },
    { value:'loan',         icon:'📋', label:'Other Loan',          color:'#60A5FA', bg:'rgba(162,155,254,.14)' },
  ]},
  { group:'Buy Now Pay Later & Borrowings', items:[
    { value:'bnpl',         icon:'🛍️', label:'BNPL',                color:'#F87171', bg:'rgba(255,121,168,.14)' },
    { value:'family_borrow',icon:'👨‍👩‍👧', label:'Family Borrowing',   color:'#D97706', bg:'rgba(217,119,6,.14)'  },
    { value:'emi',          icon:'📅', label:'EMI',                 color:'#1D4ED8', bg:'rgba(29,78,216,.14)'  },
  ]},
];

const ALL_TYPES = [
  ...ASSET_TYPES.flatMap(g => g.items),
  ...LIABILITY_TYPES.flatMap(g => g.items),
];

const LIABILITY_VALS = new Set(['visa','mastercard','home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','bnpl','family_borrow','emi']);
const isLiabilityType = t => LIABILITY_VALS.has(t);

function AccountTypePicker({ value, onChange }) {
  const [tab, setTab] = useState(isLiabilityType(value) ? 'liability' : 'asset');
  const groups = tab === 'asset' ? ASSET_TYPES : LIABILITY_TYPES;

  return (
    <div>
      <style>{`
        @keyframes typeCardIn {
          from { opacity:0; transform:translateY(6px) scale(.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .type-card {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          position:relative;
          gap:5px; padding:11px 6px; border-radius:14px; cursor:pointer;
          border:1.5px solid var(--border); background:var(--surface);
          transition:all .18s cubic-bezier(.34,1.56,.64,1);
          animation:typeCardIn .18s ease both;
          user-select:none; text-align:center;
        }
        .type-card:hover { transform:translateY(-2px) scale(1.04); box-shadow:0 6px 20px rgba(29,78,216,.15); }
      `}</style>

      {/* Asset / Liability toggle */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
        <button onClick={() => { setTab('asset'); onChange('bank'); }}
          style={{ padding:'12px 0', borderRadius:14, border: tab==='asset' ? '2px solid #047857' : '1.5px solid var(--border)',
            background: tab==='asset' ? 'rgba(4,120,87,.12)' : 'var(--surface)', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:4, transition:'all .2s' }}>
          <span style={{ fontSize:22 }}>💰</span>
          <span style={{ fontSize:13, fontWeight:700, color: tab==='asset' ? '#047857' : 'var(--text)' }}>Assets</span>
          <span style={{ fontSize:10.5, color:'var(--text3)' }}>Bank, FD, Gold, Stocks…</span>
        </button>
        <button onClick={() => { setTab('liability'); onChange('visa'); }}
          style={{ padding:'12px 0', borderRadius:14, border: tab==='liability' ? '2px solid #DC2626' : '1.5px solid var(--border)',
            background: tab==='liability' ? 'rgba(220,38,38,.10)' : 'var(--surface)', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:4, transition:'all .2s' }}>
          <span style={{ fontSize:22 }}>💸</span>
          <span style={{ fontSize:13, fontWeight:700, color: tab==='liability' ? '#DC2626' : 'var(--text)' }}>Liabilities</span>
          <span style={{ fontSize:10.5, color:'var(--text3)' }}>Loans, Cards, BNPL…</span>
        </button>
      </div>

      {/* Formula hint */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:14,
        padding:'8px 14px', background:'var(--surface2)', borderRadius:10, border:'1px solid var(--border-light)' }}>
        <span style={{ fontSize:12, color:'var(--text3)', fontWeight:500 }}>Net Worth</span>
        <span style={{ fontSize:12, color:'var(--text3)' }}>=</span>
        <span style={{ fontSize:12, fontWeight:700, color:'#047857' }}>Total Assets</span>
        <span style={{ fontSize:12, color:'var(--text3)' }}>−</span>
        <span style={{ fontSize:12, fontWeight:700, color:'#DC2626' }}>Total Liabilities</span>
      </div>

      {/* Type grid */}
      {groups.map((group, gi) => (
        <div key={group.group} style={{ marginBottom:14 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>
            {group.group}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {group.items.map((item, ti) => {
              const sel = value === item.value;
              return (
                <div key={item.value}
                  className="type-card"
                  style={{
                    animationDelay: `${(gi * 4 + ti) * 25}ms`,
                    border: sel ? `2px solid ${item.color}` : '1.5px solid var(--border)',
                    background: sel ? item.bg : 'var(--surface)',
                    boxShadow: sel ? `0 4px 16px ${item.color}33` : 'none',
                  }}
                  onClick={() => onChange(item.value)}>
                  <span style={{ fontSize:24, lineHeight:1 }}>{item.icon}</span>
                  <div style={{ fontSize:10, fontWeight:700, color: sel ? item.color : 'var(--text3)', lineHeight:1.2 }}>{item.label}</div>
                  {sel && (
                    <div style={{ position:'absolute', top:5, right:5, width:13, height:13, borderRadius:'50%', background:item.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="7" height="7" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const PRESET_CARD_COLORS = [
  '#1D4ED8','#3B82F6','#DC2626','#047857','#D97706',
  '#F87171','#0D9488','#60A5FA','#636E72','#2D3436',
];

function calcPaymentDue(billDay) {
  if (!billDay || isNaN(parseInt(billDay))) return null;
  const day = parseInt(billDay);
  const today = new Date();
  let bill = new Date(today.getFullYear(), today.getMonth(), day);
  if (bill <= today) bill.setMonth(bill.getMonth() + 1);
  const due = new Date(bill);
  due.setDate(due.getDate() + 20);
  return due;
}

function AddWalletModal({ onClose, onSaved }) {
  const fmt = useFmtWallet();
  const [form, setForm] = useState({
    name:'', type:'bank', last_four:'', balance:'', color:'#3B82F6',
    credit_limit:'', bill_date:'', emi_amount:'', interest_rate:'', person_name:'',
    maturity_date:'', invested_amount:'',
  });
  const [step, setStep] = useState(1);
  const mutation = useMutation({
    mutationFn: (data) => walletsAPI.create(data),
    onSuccess: onSaved,
  });

  const isCard     = ['visa','mastercard'].includes(form.type);
  const isLoan     = ['home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','emi'].includes(form.type);
  const isBNPL     = form.type === 'bnpl';
  const isFamilyBorrow = form.type === 'family_borrow';
  const isLiability = isLiabilityType(form.type);
  const isInvestment = ['fd','mutual_fund','stocks','gold','crypto','epf','real_estate'].includes(form.type);
  const isLending  = form.type === 'lending';
  const selectedType = ALL_TYPES.find(t => t.value === form.type) || ALL_TYPES[0];

  const paymentDue  = isCard ? calcPaymentDue(form.bill_date) : null;
  const utilPct     = isCard && form.credit_limit && form.balance
    ? Math.min(100, Math.round((parseFloat(form.balance) / parseFloat(form.credit_limit)) * 100))
    : 0;

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:480 }}>

        {/* Header with live preview chip */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ flex:1 }}>
            <div className="modal-title" style={{ marginBottom:0 }}>Add Account</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>
              {step === 1 ? 'Choose your account type' : 'Enter the account details'}
            </div>
          </div>
          {/* Live type chip */}
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', borderRadius:14, background:selectedType.bg, border:`1px solid ${selectedType.color}44`, transition:'all .2s' }}>
            <span style={{ fontSize:16 }}>{selectedType.icon}</span>
            <span style={{ fontSize:12, fontWeight:700, color:selectedType.color }}>{selectedType.label}</span>
          </div>
        </div>

        {/* Step dots */}
        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {[1,2].map(s => (
            <div key={s} style={{ height:4, flex:1, borderRadius:4, transition:'background .3s', background: s<=step ? 'var(--accent)' : 'var(--surface3)' }}/>
          ))}
        </div>

        {step === 1 ? (
          <>
            {/* Type picker grid */}
            <div style={{ position:'relative' }}>
              <AccountTypePicker value={form.type} onChange={v => setForm(f=>({...f,type:v}))}/>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setStep(2)}
                style={{ background:'#1D4ED8', border:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}>
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ animation:'typeCardIn .22s ease' }}>

              {/* Account name — always shown */}
              <div className="form-group">
                <label className="form-label">Account Name</label>
                <input className="form-input" value={form.name} autoFocus
                  onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  placeholder={
                    form.type==='bank'   ? 'e.g. HDFC Savings, Chase Checking…' :
                    form.type==='cash'   ? 'e.g. Wallet, Petty Cash…' :
                    form.type==='loan'   ? 'e.g. Home Loan, Car Loan…' :
                    form.type==='crypto' ? 'e.g. Bitcoin Wallet, Coinbase…' :
                    isCard               ? 'e.g. ICICI Coral, HDFC Regalia…' :
                    'e.g. My Account…'
                  }/>
              </div>

              {/* ── Category badge ── */}
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:14, marginBottom:14,
                background: isLiability ? 'rgba(220,38,38,.10)' : 'rgba(4,120,87,.10)',
                border: `1px solid ${isLiability ? 'rgba(220,38,38,.3)' : 'rgba(4,120,87,.3)'}` }}>
                <span style={{ fontSize:13 }}>{isLiability ? '💸' : '💰'}</span>
                <span style={{ fontSize:11.5, fontWeight:700, color: isLiability ? '#DC2626' : '#047857' }}>
                  {isLiability ? 'Liability — reduces Net Worth' : 'Asset — increases Net Worth'}
                </span>
              </div>

              {/* ── CREDIT CARD fields ── */}
              {isCard && (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div className="form-group">
                      <label className="form-label">Outstanding Balance ₹</label>
                      <input className="form-input" type="number" min="0" step="0.01"
                        value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))}
                        placeholder="Amount currently owed"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Credit Limit ₹</label>
                      <input className="form-input" type="number" min="0" step="0.01"
                        value={form.credit_limit} onChange={e=>setForm(f=>({...f,credit_limit:e.target.value}))}
                        placeholder="e.g. 1,00,000"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last 4 Digits</label>
                      <input className="form-input" maxLength={4} value={form.last_four}
                        onChange={e=>setForm(f=>({...f,last_four:e.target.value.replace(/\D/g,'')}))}
                        placeholder="4321"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bill Date <span style={{color:'var(--text3)',fontWeight:400}}>(day of month)</span></label>
                      <input className="form-input" type="number" min="1" max="31"
                        value={form.bill_date} onChange={e=>setForm(f=>({...f,bill_date:e.target.value}))}
                        placeholder="e.g. 15"/>
                    </div>
                  </div>
                  {paymentDue && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4 }}>
                      <div style={{ background:'rgba(4,120,87,.08)', border:'1px solid rgba(4,120,87,.25)', borderRadius:12, padding:'12px 14px' }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'#047857', marginBottom:3 }}>📅 Payment Due</div>
                        <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>
                          {paymentDue.toLocaleDateString('en-IN',{day:'numeric',month:'long'})}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Bill date + 20 days</div>
                      </div>
                      {form.credit_limit && form.balance && (
                        <div style={{ background: utilPct>80?'rgba(220,38,38,.08)':'rgba(4,120,87,.08)', border:`1px solid ${utilPct>80?'rgba(220,38,38,.25)':'rgba(4,120,87,.25)'}`, borderRadius:12, padding:'12px 14px' }}>
                          <div style={{ fontSize:11, fontWeight:600, color: utilPct>80?'#DC2626':'#047857', marginBottom:6 }}>💳 Utilization {utilPct}%</div>
                          <div style={{ height:6, background:'var(--surface3)', borderRadius:14, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${utilPct}%`, borderRadius:14, background: utilPct>80?'#DC2626':'#047857' }}/>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── LOAN fields ── */}
              {isLoan && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">Outstanding Balance ₹</label>
                    <input className="form-input" type="number" min="0" step="0.01"
                      value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))}
                      placeholder="Remaining principal"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly EMI ₹</label>
                    <input className="form-input" type="number" min="0"
                      value={form.emi_amount} onChange={e=>setForm(f=>({...f,emi_amount:e.target.value}))}
                      placeholder="e.g. 15,000"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Interest Rate % p.a.</label>
                    <input className="form-input" type="number" min="0" max="50" step="0.1"
                      value={form.interest_rate} onChange={e=>setForm(f=>({...f,interest_rate:e.target.value}))}
                      placeholder="e.g. 8.5"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bill Date <span style={{color:'var(--text3)',fontWeight:400}}>(day)</span></label>
                    <input className="form-input" type="number" min="1" max="31"
                      value={form.bill_date} onChange={e=>setForm(f=>({...f,bill_date:e.target.value}))}
                      placeholder="e.g. 5"/>
                  </div>
                </div>
              )}

              {/* ── BNPL fields ── */}
              {isBNPL && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">Outstanding ₹</label>
                    <input className="form-input" type="number" min="0"
                      value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))}
                      placeholder="Amount owed"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Payment Date</label>
                    <input className="form-input" type="date"
                      value={form.bill_date} onChange={e=>setForm(f=>({...f,bill_date:e.target.value}))}/>
                  </div>
                </div>
              )}

              {/* ── FAMILY BORROW fields ── */}
              {isFamilyBorrow && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">Amount Borrowed ₹</label>
                    <input className="form-input" type="number" min="0"
                      value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))}
                      placeholder="0.00"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Borrowed From</label>
                    <input className="form-input"
                      value={form.person_name} onChange={e=>setForm(f=>({...f,person_name:e.target.value}))}
                      placeholder="Name of person"/>
                  </div>
                </div>
              )}

              {/* ── INVESTMENT fields (FD, MF, Stocks, Gold, Crypto, EPF) ── */}
              {isInvestment && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">
                      {form.type==='fd' ? 'Principal Amount ₹' : form.type==='real_estate' ? 'Current Market Value ₹' : 'Current Value ₹'}
                    </label>
                    <input className="form-input" type="number" min="0"
                      value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))}
                      placeholder="0.00"/>
                  </div>
                  {['mutual_fund','stocks','gold','crypto'].includes(form.type) && (
                    <div className="form-group">
                      <label className="form-label">Amount Invested ₹</label>
                      <input className="form-input" type="number" min="0"
                        value={form.invested_amount} onChange={e=>setForm(f=>({...f,invested_amount:e.target.value}))}
                        placeholder="Cost basis"/>
                    </div>
                  )}
                  {form.type === 'fd' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Interest Rate % p.a.</label>
                        <input className="form-input" type="number" min="0" step="0.1"
                          value={form.interest_rate} onChange={e=>setForm(f=>({...f,interest_rate:e.target.value}))}
                          placeholder="e.g. 7.1"/>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Maturity Date</label>
                        <input className="form-input" type="date"
                          value={form.maturity_date} onChange={e=>setForm(f=>({...f,maturity_date:e.target.value}))}/>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── LENDING / Money lent ── */}
              {isLending && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">Amount Lent ₹</label>
                    <input className="form-input" type="number" min="0"
                      value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))}
                      placeholder="0.00"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lent To</label>
                    <input className="form-input"
                      value={form.person_name} onChange={e=>setForm(f=>({...f,person_name:e.target.value}))}
                      placeholder="Name of person"/>
                  </div>
                </div>
              )}

              {/* ── BANK / CASH / WALLET fields ── */}
              {!isCard && !isLoan && !isBNPL && !isFamilyBorrow && !isInvestment && !isLending && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">Current Balance ₹</label>
                    <input className="form-input" type="number" value={form.balance}
                      onChange={e=>setForm(f=>({...f,balance:e.target.value}))} placeholder="0.00"/>
                  </div>
                  {['bank','paypal'].includes(form.type) && (
                    <div className="form-group">
                      <label className="form-label">Last 4 Digits</label>
                      <input className="form-input" maxLength={4} value={form.last_four}
                        onChange={e=>setForm(f=>({...f,last_four:e.target.value.replace(/\D/g,'')}))} placeholder="1234"/>
                    </div>
                  )}
                </div>
              )}

              {/* Returns preview for investments */}
              {isInvestment && form.balance && form.invested_amount && parseFloat(form.invested_amount) > 0 && (() => {
                const gain = parseFloat(form.balance) - parseFloat(form.invested_amount);
                const pct  = (gain / parseFloat(form.invested_amount) * 100).toFixed(1);
                const pos  = gain >= 0;
                return (
                  <div style={{ padding:'10px 14px', borderRadius:12, marginBottom:4,
                    background: pos ? 'rgba(4,120,87,.08)' : 'rgba(220,38,38,.08)',
                    border: `1px solid ${pos ? 'rgba(4,120,87,.25)' : 'rgba(220,38,38,.25)'}` }}>
                    <div style={{ fontSize:11, fontWeight:600, color: pos?'#047857':'#DC2626', marginBottom:2 }}>
                      {pos ? '📈 Unrealised Gain' : '📉 Unrealised Loss'}
                    </div>
                    <div style={{ fontSize:16, fontWeight:800, color: pos?'#047857':'#DC2626' }}>
                      {pos?'+':''}{fmt(gain,{noDecimals:true})} ({pct}%)
                    </div>
                  </div>
                );
              })()}

              {/* Color picker — always shown */}
              <div className="form-group">
                <label className="form-label">Card Color</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  {PRESET_CARD_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                      style={{ width:28, height:28, borderRadius:8, background:c, border: form.color===c?'3px solid var(--text)':'2px solid transparent', cursor:'pointer', outline:'none', transition:'transform .15s, border .15s', transform: form.color===c?'scale(1.2)':'scale(1)' }}/>
                  ))}
                  <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                    style={{ width:28, height:28, borderRadius:8, cursor:'pointer', border:'1px solid var(--border)', padding:1 }}/>
                </div>
              </div>

              {/* Live preview card */}
              {(() => { const ink = cardInk(form.color); return (
              <div style={{ borderRadius:16, padding:'16px 20px', marginBottom:4, background:`linear-gradient(135deg,${form.color},${form.color}bb)`, boxShadow:`0 6px 20px ${form.color}44` }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: isCard && form.credit_limit ? 10 : 0 }}>
                  <span style={{ fontSize:26 }}>{selectedType.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:ink.text, letterSpacing:.2 }}>{form.name || 'Account Preview'}</div>
                    <div style={{ fontSize:11.5, color:ink.muted, marginTop:2 }}>
                      {selectedType.label}{form.last_four ? ` *${form.last_four}` : ''}
                      {isCard
                        ? ` · ${fmt(parseFloat(form.balance||0))} owed`
                        : ` · ${fmt(parseFloat(form.balance||0))}`}
                    </div>
                  </div>
                  {isCard && form.credit_limit && (
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:ink.faint }}>Limit</div>
                      <div style={{ fontSize:13, fontWeight:800, color:ink.text }}>{fmt(parseFloat(form.credit_limit||0))}</div>
                    </div>
                  )}
                </div>
                {/* Utilization bar on preview card */}
                {isCard && form.credit_limit && (
                  <div>
                    <div style={{ height:4, background:ink.bar, borderRadius:14, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${utilPct}%`, background:ink.barFill, borderRadius:14, transition:'width .4s ease' }}/>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, fontSize:10.5, color:ink.faint }}>
                      <span>{utilPct}% used</span>
                      <span>Available: {fmt(Math.max(0,parseFloat(form.credit_limit)-parseFloat(form.balance||0)))}</span>
                    </div>
                  </div>
                )}
              </div>
              ); })()}
            </div>

            {mutation.isError && (
              <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10, background:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.3)', color:'#DC2626', fontSize:12, fontWeight:500 }}>
                ⚠️ {mutation.error?.response?.data?.message || mutation.error?.message || 'Failed to add account. Please try again.'}
              </div>
            )}
            <div style={{ display:'flex', gap:10, marginTop:12, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" disabled={mutation.isPending || !form.name.trim()}
                onClick={() => {
                  const bal = parseFloat(form.balance || 0);
                  mutation.mutate({
                    ...form,
                    balance: isLiabilityType(form.type) ? -Math.abs(bal) : Math.abs(bal),
                    due_date: paymentDue ? paymentDue.toISOString().split('T')[0] : undefined,
                    emi_day:  form.bill_date ? parseInt(form.bill_date) : undefined,
                  });
                }}
                style={{ background:'#1D4ED8', border:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}>
                {mutation.isPending ? '⏳ Adding…' : 'Add Account'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Analytics page ────────────────────────────────────────────────────────────
import { useQuery as useQ2 } from '@tanstack/react-query';
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


// ─── Settings page ─────────────────────────────────────────────────────────────
import { useState as useState2 } from 'react';
import { useMutation as useMutation2, useQuery as useQuery2 } from '@tanstack/react-query';
import { useNavigate as useNavigate3 } from 'react-router-dom';
import { authAPI, dataAPI } from '../services/api';
import { Topbar as Topbar3 } from '../components/ui';
import useAuthStore2 from '../store/authStore';
import useCurrencyStore2, { CURRENCIES as ALL_CURRENCIES } from '../store/currencyStore';
import useLangStore2 from '../store/langStore';
import { useFmt as useFmtHook } from '../i18n';
import { useT as useT2 } from '../i18n';
import { User, Globe, Bell, Shield, ChevronRight as Chevron, Download, Trash2, Check, AlertTriangle, Eye, EyeOff, Key, Tag, Sparkles } from 'lucide-react';
import usePrivacyStore from '../store/privacyStore';
import ThemedSelect from '../components/ThemedSelect';

function PrivacySection() {
  const { hidden, passwordHash, setHidden, setPassword, verify } = usePrivacyStore();
  const [pw, setPw]   = useState2('');
  const [pw2, setPw2] = useState2('');
  const [cur, setCur] = useState2('');
  const [msg, setMsg] = useState2('');
  const hasPw = !!passwordHash;
  const ok = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const save = () => {
    if (hasPw && !verify(cur)) return setMsg('Current password is incorrect');
    if (!pw) return setMsg('Enter a new password');
    if (pw !== pw2) return setMsg('Passwords do not match');
    setPassword(pw); setPw(''); setPw2(''); setCur(''); ok('Password saved ✓');
  };
  const remove = () => {
    if (hasPw && !verify(cur)) return setMsg('Current password is incorrect');
    setPassword(null); setHidden(false); setCur(''); ok('Password removed ✓');
  };
  const toggle = () => {
    if (hidden && passwordHash) {
      const p = window.prompt('Enter password to reveal amounts');
      if (p == null) return;
      if (!verify(p)) return window.alert('Incorrect password');
    }
    setHidden(!hidden);
  };

  return (
    <SectionCard icon={<Shield size={18} color="#047857"/>} title="Privacy — Hide Amounts">
      <div style={{ fontSize:13, color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
        Hide every amount in the app behind <b>••••</b>. Tap the eye icon on the balance card any time — set a password below so only you can reveal them again.
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:12, background:'var(--surface2)', marginBottom:14 }}>
        <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>
          {hidden ? '🙈 Amounts are hidden' : '👁️ Amounts are visible'}
        </span>
        <button className="btn btn-ghost" onClick={toggle} style={{ padding:'7px 16px' }}>
          {hidden ? 'Show' : 'Hide'}
        </button>
      </div>

      {msg && (
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color: msg.includes('✓') ? '#047857' : '#DC2626' }}>{msg}</div>
      )}

      <div style={{ display:'grid', gap:12 }}>
        {hasPw && (
          <div className="form-group">
            <label className="form-label">Current password</label>
            <input type="password" className="form-input" value={cur} onChange={e=>setCur(e.target.value)} placeholder="••••••"/>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group">
            <label className="form-label">{hasPw ? 'New password' : 'Password'}</label>
            <input type="password" className="form-input" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••"/>
          </div>
          <div className="form-group">
            <label className="form-label">Confirm</label>
            <input type="password" className="form-input" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="••••••"/>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginTop:4 }}>
        <button className="btn btn-primary" onClick={save} style={{ background:'#1D4ED8', border:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}>
          {hasPw ? 'Update password' : 'Set password'}
        </button>
        {hasPw && <button className="btn btn-ghost" onClick={remove}>Remove password</button>}
      </div>
    </SectionCard>
  );
}
import { invalidateFinance } from '../lib/cache';

export function Settings() {
  const { user, updateUser } = useAuthStore2();
  const { currency, setCurrency } = useCurrencyStore2();
  const { lang, setLang } = useLangStore2();
  const t = useT2();
  const navigate3 = useNavigate3();
  const [form, setForm2] = useState2({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    currency:   user?.currency   || 'USD',
    language:   user?.language   || 'en',
  });
  const [saved, setSaved]           = useState2(false);
  const [resetModal, setResetModal] = useState2(false);
  const [exporting, setExporting]   = useState2(false);
  const [exportDone, setExportDone] = useState2(false);
  const [sampleLoaded, setSampleLoaded] = useState2(false);
  const [sampleBusy, setSampleBusy]     = useState2('');

  useEffect(() => { dataAPI.sampleStatus().then(r => setSampleLoaded(!!r.data.loaded)).catch(()=>{}); }, []);

  const loadSample = async () => {
    setSampleBusy('load');
    try {
      await dataAPI.sampleLoad();
      window.location.href = '/dashboard';
    } catch (e) { setSampleBusy(''); alert(e.response?.data?.message || 'Failed to load sample data'); }
  };
  const removeSample = async () => {
    setSampleBusy('remove');
    try {
      await dataAPI.sampleRemove();
      window.location.href = '/dashboard';
    } catch (e) { setSampleBusy(''); alert(e.response?.data?.message || 'Failed to remove sample data'); }
  };

  const mutation = useMutation2({
    mutationFn: (data) => authAPI.updateProfile(data),
    onSuccess: (res) => { updateUser(res.data.user); setSaved(true); setTimeout(()=>setSaved(false),2500); },
  });

  const initials = `${user?.first_name?.[0]||''}${user?.last_name?.[0]||''}`.toUpperCase();

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await dataAPI.export();
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type:'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `tracksy-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click(); URL.revokeObjectURL(url);
      setExportDone(true); setTimeout(()=>setExportDone(false), 3000);
    } catch { }
    setExporting(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <Topbar3 title={t('settings_title')} subtitle={t('settings_subtitle')}/>
      <div style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>
        <div style={{ maxWidth:680 }}>

          {saved && (
            <div style={{ background:'rgba(4,120,87,.12)', color:'#047857', padding:'12px 16px', borderRadius:14, marginBottom:20, fontSize:13.5, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
              {t('settings_saved')}
            </div>
          )}

          {/* Profile hero */}
          <div style={{ background:'#1D4ED8', borderRadius:14, padding:'28px 32px', marginBottom:20, color:'#fff', display:'flex', alignItems:'center', gap:20, boxShadow:'0 8px 32px rgba(29,78,216,.3)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, background:'rgba(255,255,255,.08)', borderRadius:'50%' }}/>
            <div style={{ position:'absolute', bottom:-20, right:80, width:60, height:60, background:'rgba(255,255,255,.05)', borderRadius:'50%' }}/>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:22, fontWeight:700, flexShrink:0, backdropFilter:'blur(10px)', border:'2px solid rgba(255,255,255,.3)' }}>
              {initials}
            </div>
            <div style={{ position:'relative', zIndex:1, flex:1 }}>
              <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3 }}>{user?.first_name} {user?.last_name}</div>
              <div style={{ fontSize:13, opacity:.8, marginTop:2 }}>{user?.email}</div>
            </div>
          </div>

          {/* Profile form */}
          <SectionCard icon={<User size={18} color="#1D4ED8"/>} title={t('settings_profile')}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">{t('settings_first_name')}</label>
                <input className="form-input" value={form.first_name} onChange={e=>setForm2(f=>({...f,first_name:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings_last_name')}</label>
                <input className="form-input" value={form.last_name} onChange={e=>setForm2(f=>({...f,last_name:e.target.value}))}/>
              </div>
            </div>
            <button className="btn btn-primary" disabled={mutation.isPending} onClick={()=>mutation.mutate(form)}
              style={{ background:'#1D4ED8', border:'none', boxShadow:'0 4px 14px rgba(29,78,216,.35)' }}>
              {mutation.isPending ? t('modal_saving') : t('settings_save')}
            </button>
          </SectionCard>

          {/* Currency & Region */}
          <SectionCard icon={<Globe size={18} color="#3B82F6"/>} title={t('settings_currency_region')}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">{t('settings_currency')}</label>
                <ThemedSelect value={currency} onChange={setCurrency}
                  options={ALL_CURRENCIES.map(c => ({ value:c.code, label:`${c.code} — ${c.name}`, emoji:c.flag }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings_language')}</label>
                <ThemedSelect value={lang} onChange={setLang}
                  options={[
                    { value:'en', label:'English', emoji:'🇬🇧' },
                    { value:'ta', label:'தமிழ் (Tamil)', emoji:'🇮🇳' },
                  ]}/>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => { setSaved(true); setTimeout(()=>setSaved(false),2500); }}>{t('settings_save_prefs')}</button>
          </SectionCard>

          {/* Privacy — hide amounts behind a password */}
          <PrivacySection />

          {/* Categories — moved out of main menu */}
          <SectionCard icon={<Tag size={18} color="#60A5FA"/>} title="Categories">
            <div
              onClick={() => navigate3('/categories')}
              style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:14, border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', transition:'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor='#60A5FA'}
              onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(96,165,250,.14)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Tag size={18} color="#60A5FA"/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)' }}>Manage Categories</div>
                <div style={{ fontSize:12.5, color:'var(--text3)', marginTop:2 }}>Add, edit or organise your income &amp; expense categories</div>
              </div>
              <Chevron size={18} color="var(--text3)" style={{ flexShrink:0 }}/>
            </div>
          </SectionCard>

          {/* Notifications */}
          <NotificationPrefsSection />

          {/* Security / Change Password */}
          <ChangePasswordSection user={user} />

          {/* Data Backup */}
          <SectionCard icon={<Download size={18} color="#3B82F6"/>} title="Data Backup & Export">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, color:'var(--text)', lineHeight:1.6, marginBottom:10 }}>
                  Download all your financial data — transactions, wallets, budgets, goals and categories — as a JSON file you can store safely or import elsewhere.
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['Transactions','Wallets','Budgets','Goals','Categories'].map(t => (
                    <span key={t} style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:14, background:'var(--accent-light)', color:'var(--accent)' }}>{t}</span>
                  ))}
                </div>
              </div>
              <button onClick={handleExport} disabled={exporting}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:12, fontWeight:700, fontSize:13.5, cursor:'pointer', flexShrink:0, background: exportDone?'rgba(4,120,87,.15)':'var(--accent-light)', border: exportDone?'1.5px solid #047857':'1.5px solid var(--accent)', color: exportDone?'#047857':'var(--accent)', transition:'all .2s' }}>
                <Download size={15}/> {exporting ? 'Exporting…' : exportDone ? '✓ Downloaded!' : 'Export JSON'}
              </button>
            </div>
          </SectionCard>

          {/* Sample / Demo Data */}
          <SectionCard icon={<Sparkles size={18} color="#1D4ED8"/>} title="Sample Data">
            <div style={{ fontSize:13.5, color:'var(--text3)', marginBottom:16, lineHeight:1.6 }}>
              Load a full year of demo data — accounts, credit card, loan, assets, transactions, budgets & goals — to explore every feature. Your real data is never touched; remove the demo anytime to return to normal.
            </div>
            {sampleLoaded ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:14, background:'rgba(4,120,87,.1)', border:'1px solid #04785722', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>✓ Demo data is active</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Remove it to return to your normal data</div>
                </div>
                <button onClick={removeSample} disabled={!!sampleBusy}
                  style={{ padding:'8px 18px', borderRadius:10, border:'1.5px solid #DC2626', background:'transparent', color:'#DC2626', fontSize:12.5, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                  {sampleBusy==='remove' ? 'Removing…' : 'Return to Normal'}
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:14, background:'rgba(29,78,216,.1)', border:'1px solid #1d4ed822', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>Load 1 year of demo data</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>See how Tracksy looks fully populated</div>
                </div>
                <button onClick={loadSample} disabled={!!sampleBusy}
                  style={{ padding:'8px 18px', borderRadius:10, border:'none', background:'#1D4ED8', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                  {sampleBusy==='load' ? 'Loading…' : 'Load Sample Data'}
                </button>
              </div>
            )}
          </SectionCard>

          {/* Reset Data */}
          <SectionCard icon={<Trash2 size={18} color="#DC2626"/>} title="Reset Data">
            <div style={{ fontSize:13.5, color:'var(--text3)', marginBottom:16, lineHeight:1.6 }}>
              Permanently delete selected data. <strong style={{color:'var(--red)'}}>This cannot be undone.</strong> Export a backup first.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { scope:'transactions', label:'Clear All Transactions',      desc:'Remove every income & expense record',       color:'#D97706', bg:'rgba(217,119,6,.1)' },
                { scope:'budgets',      label:'Delete All Budgets',           desc:'Remove all monthly budget configurations',   color:'#3B82F6', bg:'rgba(59,130,246,.1)'  },
                { scope:'goals',        label:'Delete All Goals',             desc:'Remove all saving goals and progress',       color:'#047857', bg:'rgba(4,120,87,.1)'  },
                { scope:'all',          label:'⚠️ Reset Everything',           desc:'Wipe all data — wallets, transactions, budgets, goals & categories', color:'#DC2626', bg:'rgba(220,38,38,.1)'   },
              ].map(({ scope, label, desc, color, bg }) => (
                <div key={scope} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:14, background:bg, border:`1px solid ${color}22`, gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text)' }}>{label}</div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{desc}</div>
                  </div>
                  <button onClick={() => setResetModal(scope)}
                    style={{ padding:'7px 16px', borderRadius:10, border:`1.5px solid ${color}`, background:'transparent', color:color, fontSize:12.5, fontWeight:700, cursor:'pointer', flexShrink:0, transition:'all .15s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=bg; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Admin panel button — only for admins */}
          {user?.is_admin && (
            <div onClick={() => navigate3('/admin')} style={{ cursor:'pointer', background:'linear-gradient(135deg,#0B1F4B 0%,#12306B 100%)', borderRadius:14, padding:'18px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16, boxShadow:'0 4px 24px rgba(29,78,216,.15)', border:'1px solid rgba(29,78,216,.4)', transition:'transform .2s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>
              <div style={{ width:46, height:46, borderRadius:14, background:'#1D4ED8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:3 }}>Admin Dashboard</div>
                <div style={{ fontSize:12.5, color:'rgba(255,255,255,.5)' }}>Users, stats, premium management & more</div>
              </div>
              <div style={{ background:'rgba(29,78,216,.25)', border:'1px solid rgba(29,78,216,.5)', borderRadius:12, padding:'8px 16px', color:'#60A5FA', fontSize:13, fontWeight:700, flexShrink:0 }}>
                Open →
              </div>
            </div>
          )}

        </div>
      </div>

      {resetModal && <ResetModal scope={resetModal} onClose={() => setResetModal(false)}/>}
    </div>
  );
}

/* ── Notification Preferences section ─────────────────────────── */
function NotificationPrefsSection() {
  const { data: prefs, isLoading } = useQuery2({
    queryKey: ['notification-prefs'],
    queryFn: () => authAPI.getNotificationPrefs().then(r => r.data.data),
  });
  const qcNotif = useQueryClient();
  const [local, setLocal] = useState2(null);
  const [saving, setSaving] = useState2(false);
  const [savedNotif, setSavedNotif] = useState2(false);

  // Sync local state when prefs load
  if (prefs && !local) setLocal({ ...prefs });

  const toggle = (key) => setLocal(p => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    try {
      await authAPI.updateNotificationPrefs({
        transaction_alerts: local.transaction_alerts,
        budget_warnings:    local.budget_warnings,
        weekly_summary:     local.weekly_summary,
        goal_milestones:    local.goal_milestones,
      });
      qcNotif.invalidateQueries({ queryKey: ['notification-prefs'] });
      setSavedNotif(true); setTimeout(() => setSavedNotif(false), 2500);
    } catch(e) {}
    setSaving(false);
  };

  const NOTIF_ITEMS = [
    { key:'transaction_alerts', label:'Transaction alerts',  desc:'Get notified for every transaction' },
    { key:'budget_warnings',    label:'Budget warnings',     desc:'Alert when you are near the limit' },
    { key:'weekly_summary',     label:'Weekly summary',      desc:'Weekly email digest of your activity' },
    { key:'goal_milestones',    label:'Goal milestones',     desc:'Celebrate when you hit savings goals' },
  ];

  const display = local || {};

  return (
    <SectionCard icon={<Bell size={18} color="#D97706"/>} title="Notifications">
      {isLoading ? (
        <div style={{ fontSize:13, color:'var(--text3)', padding:'12px 0' }}>Loading preferences…</div>
      ) : (
        <>
          {NOTIF_ITEMS.map(({ key, label, desc }) => (
            <label key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--border-light)', cursor:'pointer' }}>
              <div>
                <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>{label}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{desc}</div>
              </div>
              <input type="checkbox" checked={!!display[key]} onChange={() => toggle(key)}
                style={{ accentColor:'var(--accent)', width:18, height:18, cursor:'pointer', flexShrink:0 }}/>
            </label>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:14 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding:'9px 20px', borderRadius:11, background:'#1D4ED8', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? .7 : 1 }}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
            {savedNotif && <span style={{ fontSize:12.5, color:'#047857', fontWeight:600 }}>✅ Saved!</span>}
          </div>
        </>
      )}
    </SectionCard>
  );
}

/* ── Change Password section ───────────────────────────── */
function ChangePasswordSection({ user }) {
  const [open, setOpen] = useState2(false);
  const [showCurrent, setShowCurrent] = useState2(false);
  const [showNew, setShowNew] = useState2(false);
  const [showConfirm, setShowConfirm] = useState2(false);
  const [form, setFormPwd] = useState2({ current_password: '', new_password: '', confirm_password: '' });
  const [error, setError2] = useState2('');
  const [success, setSuccess2] = useState2('');
  const [saving, setSavingPwd] = useState2(false);

  const setF = (k, v) => setFormPwd(f => ({ ...f, [k]: v }));

  const handleChangePwd = async () => {
    setError2(''); setSuccess2('');
    if (!form.current_password || !form.new_password)
      return setError2('Please fill in all fields');
    if (form.new_password.length < 8)
      return setError2('New password must be at least 8 characters');
    if (form.new_password !== form.confirm_password)
      return setError2('New passwords do not match');
    setSavingPwd(true);
    try {
      await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      setSuccess2('Password changed successfully!');
      setFormPwd({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => { setOpen(false); setSuccess2(''); }, 2500);
    } catch(e) {
      setError2(e.response?.data?.message || 'Failed to change password');
    }
    setSavingPwd(false);
  };

  const inputWrap = { position: 'relative', display: 'flex', alignItems: 'center' };
  const eyeBtn = { position:'absolute', right:10, background:'none', border:'none', cursor:'pointer', color:'var(--text3)', display:'flex', padding:4 };

  return (
    <SectionCard icon={<Shield size={18} color="#047857"/>} title="Security">
      {/* Change Password */}
      <div style={{ borderBottom:'1px solid var(--border-light)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', cursor:'pointer' }}
          onClick={() => setOpen(o => !o)}>
          <div>
            <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>Change Password</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
              {user?.oauth_provider ? 'Not available for social login accounts' : 'Update your account password'}
            </div>
          </div>
          {!user?.oauth_provider && <Chevron size={16} color="var(--text3)" style={{ transition:'transform .2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}/>}
        </div>

        {open && !user?.oauth_provider && (
          <div style={{ paddingBottom:16 }}>
            {error && <div style={{ background:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.3)', borderRadius:10, padding:'9px 13px', marginBottom:12, color:'#DC2626', fontSize:13 }}>{error}</div>}
            {success && <div style={{ background:'rgba(4,120,87,.1)', border:'1px solid rgba(4,120,87,.3)', borderRadius:10, padding:'9px 13px', marginBottom:12, color:'#047857', fontSize:13 }}>{success}</div>}

            {[
              { key:'current_password', label:'Current Password', show:showCurrent, toggle:()=>setShowCurrent(s=>!s) },
              { key:'new_password',     label:'New Password',     show:showNew,     toggle:()=>setShowNew(s=>!s) },
              { key:'confirm_password', label:'Confirm New Password', show:showConfirm, toggle:()=>setShowConfirm(s=>!s) },
            ].map(({ key, label, show, toggle }) => (
              <div key={key} className="form-group" style={{ marginBottom:10 }}>
                <label className="form-label">{label}</label>
                <div style={inputWrap}>
                  <input className="form-input" type={show ? 'text' : 'password'}
                    value={form[key]} onChange={e => setF(key, e.target.value)}
                    style={{ paddingRight:38 }} placeholder="••••••••"/>
                  <button style={eyeBtn} onClick={toggle} type="button" tabIndex={-1}>
                    {show ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
            ))}

            <button onClick={handleChangePwd} disabled={saving}
              style={{ marginTop:4, padding:'9px 20px', borderRadius:11, background:'#047857', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? .7 : 1, display:'flex', alignItems:'center', gap:8 }}>
              <Key size={14}/> {saving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        )}
      </div>

      {/* Login history note */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0' }}>
        <div>
          <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>Login History</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Review recent account activity</div>
        </div>
        <Chevron size={16} color="var(--text3)"/>
      </div>
    </SectionCard>
  );
}

/* ── Reset confirmation modal ──────────────────────────── */
function ResetModal({ scope, onClose }) {
  const [confirm, setConfirm] = useState2('');
  const [done, setDone]       = useState2(false);
  const labels = { transactions:'All Transactions', budgets:'All Budgets', goals:'All Goals', all:'ALL DATA' };

  const mutation = useMutation2({
    mutationFn: () => dataAPI.reset(scope),
    onSuccess: () => {
      setDone(true);
      // Drop the persisted query cache too — otherwise the reload below restores
      // the deleted data straight back out of localStorage.
      try { window.localStorage.removeItem('tracksy-cache'); } catch {}
      setTimeout(() => { onClose(); window.location.reload(); }, 1800);
    },
  });

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, marginBottom:20, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'rgba(220,38,38,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <AlertTriangle size={28} color="#DC2626"/>
          </div>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>Delete {labels[scope]}?</div>
          <div style={{ fontSize:13.5, color:'var(--text3)', lineHeight:1.6 }}>
            This will permanently remove {scope === 'all' ? 'all your data including wallets, transactions, budgets, goals and categories' : `all your ${labels[scope].toLowerCase()}`}. This action <strong>cannot be undone</strong>.
          </div>
        </div>

        {!done ? (
          <>
            <div className="form-group">
              <label className="form-label">Type <b>DELETE</b> to confirm</label>
              <input className="form-input" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="DELETE" autoFocus/>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={confirm !== 'DELETE' || mutation.isPending} onClick={() => mutation.mutate()}
                style={{ background:'#DC2626', border:'none', boxShadow:'0 4px 14px rgba(220,38,38,.35)', color:'#fff', padding:'8px 20px', borderRadius:10, fontWeight:700, cursor: confirm==='DELETE'?'pointer':'not-allowed', opacity: confirm==='DELETE'?1:.5 }}>
                {mutation.isPending ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'12px 0', fontSize:15, fontWeight:700, color:'#047857' }}>
            ✅ Data deleted. Refreshing…
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:14, padding:'22px 24px', boxShadow:'0 4px 24px rgba(29,78,216,.08)', border:'1px solid var(--border-light)', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'var(--accent-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {icon}
        </div>
        <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

