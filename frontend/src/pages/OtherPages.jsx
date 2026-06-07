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
  'linear-gradient(135deg,#6C63FF 0%,#5B8CFF 100%)',
  'linear-gradient(135deg,#1A1033 0%,#3d3473 100%)',
  'linear-gradient(135deg,#00b894 0%,#55efc4 100%)',
  'linear-gradient(135deg,#e17055 0%,#fd79a8 100%)',
  'linear-gradient(135deg,#0984e3 0%,#74b9ff 100%)',
  'linear-gradient(135deg,#6ab04c 0%,#badc58 100%)',
];

// Pick readable ink (dark/light) for a given card background colour
function cardInk(hex) {
  let h = (hex || '#6C63FF').replace('#', '');
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

const FREE_WALLET_LIMIT = 3;

export function Wallet() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const fmt = useFmtHook();
  const t = useTWallet();
  // useAuthStore2 and usePremiumStore are imported further down in this module
  // but ES module imports are hoisted, so they're available here at call time
  const { user } = useAuthStore2();
  const { openPremium: openWalletPremium } = usePremiumStore();
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  });

  if (isLoading) return <PageLoader />;

  const DEBT_WALLET_TYPES = ['visa','mastercard','loan'];
  const atWalletLimit = !user?.is_premium && (wallets||[]).length >= FREE_WALLET_LIMIT;
  const openAddWallet = () => atWalletLimit ? openWalletPremium() : setShowModal(true);
  const totalAssets  = (wallets||[]).filter(w => !DEBT_WALLET_TYPES.includes(w.type)).reduce((s,w) => s + parseFloat(w.balance||0), 0);
  const totalDebt    = (wallets||[]).filter(w => DEBT_WALLET_TYPES.includes(w.type)).reduce((s,w) => s + Math.abs(parseFloat(w.balance||0)), 0);
  const netWorth     = totalAssets - totalDebt;
  const totalCards   = (wallets||[]).filter(w => ['visa','mastercard'].includes(w.type)).length;
  const totalLoans   = (wallets||[]).filter(w => w.type === 'loan').length;

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
            style={{ display:'flex', alignItems:'center', gap:6, background: atWalletLimit ? 'linear-gradient(135deg,#FFB84D,#FF79A8)' : 'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}
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
        <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            style={{ appearance:'none', padding:'5px 28px 5px 10px', borderRadius:10, border:'1.5px solid var(--border)',
              background:'var(--surface)', color:'var(--text)', fontSize:12.5, fontWeight:600, cursor:'pointer', outline:'none' }}>
            {WALLET_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={12} color="var(--text3)" style={{ position:'absolute', right:8, pointerEvents:'none' }}/>
        </div>

        {/* Month */}
        <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
            style={{ appearance:'none', padding:'5px 28px 5px 10px', borderRadius:10, border:'1.5px solid var(--border)',
              background:'var(--surface)', color:'var(--text)', fontSize:12.5, fontWeight:600, cursor:'pointer', outline:'none' }}>
            <option value={0}>{t('tx_all_months')}</option>
            {WALLET_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <ChevronDown size={12} color="var(--text3)" style={{ position:'absolute', right:8, pointerEvents:'none' }}/>
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
        <div className="mob-summary-scroll" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
          {[
            { label:t('dash_net_worth'),      value: fmt(netWorth),    icon:<span style={{fontSize:18,fontWeight:800,color:'#6C63FF',lineHeight:1}}>{currencySymbol}</span>, bg:'rgba(108,99,255,.1)', color: netWorth >= 0 ? '#6C63FF' : '#FF5B5B', sub: netWorth >= 0 ? t('wallet_positive') : t('wallet_negative') },
            { label:t('wallet_total_assets'), value: fmt(totalAssets), icon:<WalletIcon size={20} color="#37D67A"/>,  bg:'rgba(55,214,122,.1)', color:'#37D67A', sub:t('wallet_all_accounts') },
            { label:t('wallet_total_debt'),   value: fmt(totalDebt),   icon:<CreditCard size={20} color="#FF5B5B"/>,  bg:'rgba(255,91,91,.1)',  color:'#FF5B5B', sub:t('wallet_cards_loans') },
          ].map(({ label, value, icon, bg, color, sub }) => (
            <div key={label} style={{
              background:'var(--surface)', borderRadius:20, padding:'16px 18px',
              boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)',
              display:'flex', alignItems:'center', gap:14,
            }}>
              <div style={{ width:42, height:42, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>{label}</div>
                <div className="mono" style={{ fontSize:16, fontWeight:800, color, letterSpacing:-0.3, lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:3 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Free tier limit banner */}
        {!user?.is_premium && (
          <div style={{
            display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderRadius:14, marginBottom:16,
            background: atWalletLimit ? 'rgba(255,184,77,.1)' : 'rgba(108,99,255,.06)',
            border: atWalletLimit ? '1px solid rgba(255,184,77,.35)' : '1px solid rgba(108,99,255,.15)',
          }}>
            <span style={{ fontSize:18 }}>{atWalletLimit ? '🔒' : '📊'}</span>
            <span style={{ fontSize:13, color:'var(--text2)', flex:1 }}>
              {atWalletLimit
                ? <><strong style={{color:'#FFB84D'}}>{t('wallet_limit_banner')}</strong> — {t('wallet_free_limit')} {FREE_WALLET_LIMIT} accounts.</>
                : <>{(wallets||[]).length} / {FREE_WALLET_LIMIT} {t('wallet_free_used')}.</>}
            </span>
            {atWalletLimit && (
              <button onClick={openWalletPremium}
                style={{ fontSize:12, fontWeight:700, padding:'5px 14px', borderRadius:20, background:'linear-gradient(135deg,#FFB84D,#FF79A8)', border:'none', color:'#fff', cursor:'pointer', whiteSpace:'nowrap' }}>
                {t('wallet_upgrade_btn')}
              </button>
            )}
          </div>
        )}

        {/* Wallet cards */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>
            {t('wallet_your_accounts')} ({(wallets||[]).length})
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(280px,100%),1fr))', gap:16 }}>
            {(wallets||[]).map((w,i) => (
              <div key={w.id} style={{
                background: WALLET_GRADIENTS[i % WALLET_GRADIENTS.length],
                borderRadius:22, padding:'24px 26px', color:'#fff',
                boxShadow:'0 8px 32px rgba(0,0,0,.15)',
                position:'relative', overflow:'hidden',
                transition:'all .22s ease',
              }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-4px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>

                {/* Decorative circles */}
                <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, background:'rgba(255,255,255,.07)', borderRadius:'50%' }}/>
                <div style={{ position:'absolute', bottom:-20, left:'60%', width:70, height:70, background:'rgba(255,255,255,.05)', borderRadius:'50%' }}/>

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, position:'relative', zIndex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <PaymentLogo method={w.type} size={32} style={{ borderRadius:8 }}/>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, opacity:.9 }}>{w.name}</div>
                      <div style={{ fontSize:11, opacity:.65, textTransform:'capitalize' }}>{WALLET_LABELS[w.type]||w.type}</div>
                    </div>
                  </div>
                  <button onClick={() => { if(confirm(t('wallet_remove_confirm'))) deleteMutation.mutate(w.id); }}
                    style={{ background:'rgba(255,255,255,.15)', border:'none', color:'#fff', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:12, fontWeight:600, backdropFilter:'blur(4px)' }}>
                    {t('wallet_remove')}
                  </button>
                </div>

                {w.last_four && (
                  <div style={{ fontSize:14, letterSpacing:4, opacity:.7, marginBottom:16, fontFamily:'Space Grotesk, Inter, sans-serif', position:'relative', zIndex:1 }}>
                    •••• •••• •••• {w.last_four}
                  </div>
                )}

                <div style={{ position:'relative', zIndex:1 }}>
                  {/* Debt: show outstanding + limit bar */}
                  {['visa','mastercard','loan'].includes(w.type) ? (
                    <>
                      <div style={{ fontSize:10, opacity:.65, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{t('wallet_outstanding')}</div>
                      <div style={{ fontSize:24, fontWeight:900, fontFamily:'Space Grotesk, Inter, sans-serif', letterSpacing:-0.5 }}>
                        {fmt(Math.abs(parseFloat(w.balance||0)))}
                      </div>
                      {w.credit_limit && (
                        <div style={{ marginTop:10 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, opacity:.75, marginBottom:4 }}>
                            <span>Limit: {fmt(parseFloat(w.credit_limit))}</span>
                            <span>{Math.min(100,Math.round((Math.abs(parseFloat(w.balance||0))/parseFloat(w.credit_limit))*100))}% {t('wallet_used')}</span>
                          </div>
                          <div style={{ height:4, background:'rgba(255,255,255,.25)', borderRadius:20, overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:20, background:'rgba(255,255,255,.85)', transition:'width .4s', width:`${Math.min(100,Math.round((Math.abs(parseFloat(w.balance||0))/parseFloat(w.credit_limit))*100))}%` }}/>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:10, opacity:.65, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{t('wallet_balance')}</div>
                      <div style={{ fontSize:24, fontWeight:900, fontFamily:'Space Grotesk, Inter, sans-serif', letterSpacing:-0.5 }}>
                        {fmt(parseFloat(w.balance||0))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!(wallets||[]).length && (
            <div style={{ background:'var(--surface)', borderRadius:20, boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)', padding:'48px', textAlign:'center', color:'var(--text3)', fontSize:14 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>💳</div>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:6 }}>{t('wallet_empty')}</div>
              <div style={{ marginBottom:20 }}>{t('wallet_empty_desc')}</div>
              <button className="btn btn-primary" onClick={openAddWallet}
                style={{ background: atWalletLimit ? 'linear-gradient(135deg,#FFB84D,#FF79A8)' : 'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none' }}>
                {atWalletLimit ? '👑 Upgrade to Add More' : t('wallet_add')}
              </button>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div style={{ background:'var(--surface)', borderRadius:22, boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)', overflow:'hidden' }}>
          <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--border-light)', fontWeight:700, fontSize:15, color:'var(--text)' }}>
            {t('wallet_recent')}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--surface2)' }}>
                  {[t('tx_col_date'),t('tx_col_amount'),t('tx_col_name'),t('nav_accounts'),t('tx_col_status')].map(h => (
                    <th key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textAlign:'left', padding:'12px 18px', borderBottom:'1px solid var(--border-light)', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(recentTx||[]).map(tx => (
                  <tr key={tx.id}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}
                    style={{ transition:'background .1s' }}>
                    <td style={{ padding:'12px 18px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text3)' }}>
                      {new Date(tx.transaction_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </td>
                    <td style={{ padding:'12px 18px', borderBottom:'1px solid var(--border-light)' }}>
                      <AmountText amount={tx.amount} type={tx.type}/>
                    </td>
                    <td style={{ padding:'12px 18px', borderBottom:'1px solid var(--border-light)', fontSize:13, fontWeight:600, color:'var(--text)' }}>
                      {tx.payment_name || tx.description}
                    </td>
                    <td style={{ padding:'12px 18px', borderBottom:'1px solid var(--border-light)', fontSize:12.5, color:'var(--text3)' }}>
                      {tx.wallet_name}
                    </td>
                    <td style={{ padding:'12px 18px', borderBottom:'1px solid var(--border-light)' }}>
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
          onSaved={() => { qc.invalidateQueries({ queryKey:['wallets'] }); setShowModal(false); }}
        />
      )}

      {/* Mobile FAB */}
      <button className="mob-fab" onClick={openAddWallet}>
        <Plus size={26} color="#fff"/>
      </button>
    </div>
  );
}

const ACCOUNT_TYPES = [
  { group:'Credit Cards', items:[
    { value:'visa',        icon:'💳', label:'Visa',            color:'#FF5B5B', bg:'rgba(255,91,91,.12)'   },
    { value:'mastercard',  icon:'💳', label:'Mastercard',      color:'#FF5B5B', bg:'rgba(255,91,91,.12)'   },
  ]},
  { group:'Bank & Cash', items:[
    { value:'bank',        icon:'🏦', label:'Bank Account',    color:'#5B8CFF', bg:'rgba(91,140,255,.12)'  },
    { value:'cash',        icon:'💵', label:'Cash',            color:'#37D67A', bg:'rgba(55,214,122,.12)'  },
  ]},
  { group:'UPI & Digital Wallets', items:[
    { value:'gpay',        icon:'🟣', label:'Google Pay',      color:'#4285F4', bg:'rgba(66,133,244,.12)'  },
    { value:'phonepe',     icon:'💜', label:'PhonePe',         color:'#5f259f', bg:'rgba(95,37,159,.12)'   },
    { value:'paytm',       icon:'🟦', label:'Paytm Wallet',    color:'#00B9F1', bg:'rgba(0,185,241,.12)'   },
    { value:'amazon_pay',  icon:'🛒', label:'Amazon Pay',      color:'#FF9900', bg:'rgba(255,153,0,.12)'   },
    { value:'mobikwik',    icon:'💙', label:'MobiKwik',        color:'#3b5bdb', bg:'rgba(59,91,219,.12)'   },
    { value:'jio_money',   icon:'🔴', label:'Jio Money',       color:'#e03131', bg:'rgba(224,49,49,.12)'   },
    { value:'airtel_money',icon:'❤️', label:'Airtel Money',    color:'#e03131', bg:'rgba(224,49,49,.12)'   },
    { value:'paypal',      icon:'🅿️', label:'PayPal',          color:'#6C63FF', bg:'rgba(108,99,255,.12)'  },
  ]},
  { group:'Travel Wallets', items:[
    { value:'irctc',       icon:'🚂', label:'IRCTC Wallet',    color:'#2563eb', bg:'rgba(37,99,235,.12)'   },
  ]},
  { group:'Investments & Other', items:[
    { value:'crypto',      icon:'₿',  label:'Crypto',          color:'#FFB84D', bg:'rgba(255,184,77,.12)'  },
    { value:'asset',       icon:'📈', label:'Asset',           color:'#00CEC9', bg:'rgba(0,206,201,.12)'   },
    { value:'loan',        icon:'📋', label:'Loan',            color:'#FFB84D', bg:'rgba(255,184,77,.12)'  },
    { value:'lending',     icon:'🤝', label:'Lending',         color:'#A29BFE', bg:'rgba(162,155,254,.12)' },
    { value:'other',       icon:'👛', label:'Other',           color:'#636E72', bg:'rgba(99,110,114,.12)'  },
  ]},
];

const ALL_TYPES = ACCOUNT_TYPES.flatMap(g => g.items);

function AccountTypePicker({ value, onChange }) {
  return (
    <div>
      <style>{`
        @keyframes typeCardIn {
          from { opacity:0; transform:translateY(6px) scale(.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .type-card {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:6px; padding:12px 6px; border-radius:14px; cursor:pointer;
          border:1.5px solid var(--border); background:var(--surface);
          transition:all .18s cubic-bezier(.34,1.56,.64,1);
          animation:typeCardIn .22s ease both;
          user-select:none;
        }
        .type-card:hover { transform:translateY(-3px) scale(1.04); box-shadow:0 6px 20px rgba(108,99,255,.15); }
        .type-card.selected { transform:translateY(-2px) scale(1.03); }
      `}</style>
      {ACCOUNT_TYPES.map((group, gi) => (
        <div key={group.group} style={{ marginBottom:14 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>
            {group.group}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {group.items.map((t, ti) => {
              const sel = value === t.value;
              return (
                <div key={t.value}
                  className={`type-card${sel ? ' selected' : ''}`}
                  style={{
                    animationDelay: `${(gi * 4 + ti) * 30}ms`,
                    border: sel ? `1.5px solid ${t.color}` : '1.5px solid var(--border)',
                    background: sel ? t.bg : 'var(--surface)',
                    boxShadow: sel ? `0 4px 16px ${t.color}33` : 'none',
                  }}
                  onClick={() => onChange(t.value)}>
                  <PaymentLogo method={t.value} size={36}
                    style={{ boxShadow: sel ? `0 4px 14px ${t.color}55` : 'none', transition:'box-shadow .18s', opacity: sel ? 1 : 0.82 }}/>
                  <div style={{ fontSize:11, fontWeight:700, color: sel ? t.color : 'var(--text3)', textAlign:'center', lineHeight:1.2 }}>{t.label}</div>
                  {sel && (
                    <div style={{ position:'absolute', top:6, right:6, width:14, height:14, borderRadius:'50%', background:t.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
  '#6C63FF','#5B8CFF','#FF5B5B','#37D67A','#FFB84D',
  '#FF79A8','#00CEC9','#A29BFE','#636E72','#2D3436',
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
    name:'', type:'visa', last_four:'', balance:'', color:'#6C63FF',
    credit_limit:'', bill_date:'',
  });
  const [step, setStep] = useState(1);
  const { openPremium: openModalPremium } = usePremiumStore();
  const mutation = useMutation({
    mutationFn: (data) => walletsAPI.create(data),
    onSuccess: onSaved,
    onError: (e) => { if (e.response?.status === 403) { onClose(); openModalPremium(); } },
  });

  const isCard     = ['visa','mastercard'].includes(form.type);
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
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', borderRadius:20, background:selectedType.bg, border:`1px solid ${selectedType.color}44`, transition:'all .2s' }}>
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
                style={{ background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
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

              {/* ── CREDIT CARD specific fields ── */}
              {isCard ? (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div className="form-group">
                      <label className="form-label">Outstanding Balance ($)</label>
                      <input className="form-input" type="number" min="0" step="0.01"
                        value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))}
                        placeholder="Amount currently owed"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Total Credit Limit ($)</label>
                      <input className="form-input" type="number" min="0" step="0.01"
                        value={form.credit_limit} onChange={e=>setForm(f=>({...f,credit_limit:e.target.value}))}
                        placeholder="e.g. 100000"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last 4 Digits</label>
                      <input className="form-input" maxLength={4} value={form.last_four}
                        onChange={e=>setForm(f=>({...f,last_four:e.target.value.replace(/\D/g,'')}))}
                        placeholder="4321"/>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bill Generation Date <span style={{color:'var(--text3)',fontWeight:400}}>(day of month)</span></label>
                      <input className="form-input" type="number" min="1" max="31"
                        value={form.bill_date} onChange={e=>setForm(f=>({...f,bill_date:e.target.value}))}
                        placeholder="e.g. 15"/>
                    </div>
                  </div>

                  {/* Auto-calculated payment due */}
                  {paymentDue && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:4 }}>
                      <div style={{ background:'rgba(55,214,122,.08)', border:'1px solid rgba(55,214,122,.25)', borderRadius:12, padding:'12px 14px' }}>
                        <div style={{ fontSize:11, fontWeight:600, color:'#37D67A', marginBottom:3 }}>📅 Payment Due Date</div>
                        <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>
                          {paymentDue.toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Bill date + 20 days</div>
                      </div>
                      {form.credit_limit && form.balance && (
                        <div style={{ background: utilPct>80?'rgba(255,91,91,.08)':utilPct>50?'rgba(255,184,77,.08)':'rgba(55,214,122,.08)', border:`1px solid ${utilPct>80?'rgba(255,91,91,.25)':utilPct>50?'rgba(255,184,77,.25)':'rgba(55,214,122,.25)'}`, borderRadius:12, padding:'12px 14px' }}>
                          <div style={{ fontSize:11, fontWeight:600, color: utilPct>80?'#FF5B5B':utilPct>50?'#FFB84D':'#37D67A', marginBottom:6 }}>
                            💳 Utilization — {utilPct}%
                          </div>
                          <div style={{ height:6, background:'var(--surface3)', borderRadius:20, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${utilPct}%`, borderRadius:20, transition:'width .4s', background: utilPct>80?'#FF5B5B':utilPct>50?'#FFB84D':'#37D67A' }}/>
                          </div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                            {fmt(parseFloat(form.balance||0))} of {fmt(parseFloat(form.credit_limit||0))} used
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* ── Non-card fields ── */
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">Initial Balance ($)</label>
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
                    <div style={{ height:4, background:ink.bar, borderRadius:20, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${utilPct}%`, background:ink.barFill, borderRadius:20, transition:'width .4s ease' }}/>
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
              <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10, background:'rgba(255,91,91,.1)', border:'1px solid rgba(255,91,91,.3)', color:'#FF5B5B', fontSize:12, fontWeight:500 }}>
                ⚠️ {mutation.error?.response?.data?.message || mutation.error?.message || 'Failed to add account. Please try again.'}
              </div>
            )}
            <div style={{ display:'flex', gap:10, marginTop:12, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" disabled={mutation.isPending || !form.name.trim()}
                onClick={() => {
                  const DEBT_TYPES = ['visa','mastercard','loan'];
                  const bal = parseFloat(form.balance || 0);
                  mutation.mutate({
                    ...form,
                    balance:  DEBT_TYPES.includes(form.type) ? -Math.abs(bal) : Math.abs(bal),
                    due_date: paymentDue ? paymentDue.toISOString().split('T')[0] : undefined,
                    emi_day:  form.bill_date ? parseInt(form.bill_date) : undefined,
                  });
                }}
                style={{ background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
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
import { dashboardAPI } from '../services/api';
import { Topbar as Topbar2, StatCard, PageLoader as PL2 } from '../components/ui';
import { useT as useTAnalytics } from '../i18n';

export function Analytics() {
  const t = useTAnalytics();
  const fmt = useFmtWallet();
  const year = new Date().getFullYear();
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const PIE_COLORS = ['#6C63FF','#5B8CFF','#37D67A','#FFB84D','#FF5B5B','#A29BFE','#00CEC9','#636E72'];

  const mf   = useQ2({ queryKey:['money-flow', year],          queryFn:() => dashboardAPI.moneyFlow({ year }).then(r=>r.data.data) });
  const cats = useQ2({ queryKey:['category-breakdown', year],  queryFn:() => dashboardAPI.categoryBreakdown({ year }).then(r=>r.data.data) });
  const stats= useQ2({ queryKey:['analytics-stats', year],     queryFn:() => dashboardAPI.analyticsStats({ year }).then(r=>r.data.data) });

  const flowData = (mf.data||[]).map((m,i) => ({ name:MONTHS[i], income:m.income, expense:m.expense }));
  const pieData  = (cats.data||[]).filter(c => c.value > 0);
  const st       = stats.data || {};
  const totalExp = pieData.reduce((s,p) => s+p.value, 0);

  const tooltipStyle = { borderRadius:12, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12 };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <Topbar2 title={t('analytics_title')} subtitle={`${t('analytics_sub')} — ${year}`}/>
      <div style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
          <StatCard label={t('analytics_avg_spend')} value={st.avg_daily||0}        icon="📊"/>
          <StatCard label={t('analytics_largest')}   value={st.largest_expense||0}  icon="💸"/>
          <StatCard label={t('analytics_savings')}   value={st.savings_rate||0}     prefix="" suffix="%" icon="💰"/>
          <StatCard label={t('dash_total_income')}   value={st.income||0}           icon="📈"/>
        </div>

        {/* Charts row */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16 }}>

          {/* Income vs Expense bar chart */}
          <div style={{ background:'var(--surface)', borderRadius:22, padding:'22px 24px', boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:6 }}>{t('analytics_income_vs')} — {year}</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>{t('analytics_monthly_comp')}</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={flowData} barGap={4} barCategoryGap="25%">
                <defs>
                  <linearGradient id="incBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6C63FF" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#5B8CFF" stopOpacity={.8}/>
                  </linearGradient>
                  <linearGradient id="expBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5B5B" stopOpacity={.7}/>
                    <stop offset="100%" stopColor="#FF5B5B" stopOpacity={.3}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v=>fmt(v/1000,{noDecimals:true})+'k'}/>
                <RTooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={tooltipStyle}/>
                <Bar dataKey="income"  fill="url(#incBar)" radius={[6,6,0,0]} name="Income"/>
                <Bar dataKey="expense" fill="url(#expBar)" radius={[6,6,0,0]} name="Expense"/>
                <Legend wrapperStyle={{ fontSize:12, marginTop:8 }}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category donut */}
          <div style={{ background:'var(--surface)', borderRadius:22, padding:'22px 24px', boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>{t('analytics_cat_exp')}</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>{year} · {t('analytics_all_months')}</div>
            {pieData.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)', fontSize:13 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📊</div>
                {t('analytics_no_data')}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ position:'relative' }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                        {pieData.map((item,i) => <Cell key={i} fill={item.color || PIE_COLORS[i % PIE_COLORS.length]}/>)}
                      </Pie>
                      <RTooltip formatter={(v,_,p)=>[`${parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2})}`, p.payload.name]} contentStyle={tooltipStyle}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                    <div className="mono" style={{ fontSize:13, fontWeight:900, color:'var(--text)' }}>
                      ${totalExp.toLocaleString('en-US',{minimumFractionDigits:0})}
                    </div>
                    <div style={{ fontSize:9, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', marginTop:2 }}>Total</div>
                  </div>
                </div>
                <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:7, marginTop:12 }}>
                  {pieData.map((item,i) => {
                    const pct = totalExp > 0 ? Math.round((item.value/totalExp)*100) : 0;
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:14 }}>{item.emoji}</span>
                        <span style={{ flex:1, fontSize:12, color:'var(--text2)' }}>{item.name}</span>
                        <span style={{ fontSize:11, color:'var(--text3)', marginRight:6 }}>{pct}%</span>
                        <span className="mono" style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>${item.value.toLocaleString('en-US',{minimumFractionDigits:0})}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Area chart */}
        <div style={{ background:'var(--surface)', borderRadius:22, padding:'22px 24px', boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>{t('analytics_cash_flow')}</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:18 }}>{t('analytics_cash_flow_sub')}</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={flowData} margin={{ top:5, right:4, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="areaInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6C63FF" stopOpacity={.18}/>
                  <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="areaExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF5B5B" stopOpacity={.15}/>
                  <stop offset="95%" stopColor="#FF5B5B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
              <RTooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={tooltipStyle}/>
              <Area type="monotone" dataKey="income"  stroke="#6C63FF" strokeWidth={2.5} fill="url(#areaInc)" name="Income"  dot={false}/>
              <Area type="monotone" dataKey="expense" stroke="#FF5B5B" strokeWidth={2}   fill="url(#areaExp)" name="Expense" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Settings page ─────────────────────────────────────────────────────────────
import { useState as useState2 } from 'react';
import { useMutation as useMutation2, useQuery as useQuery2 } from '@tanstack/react-query';
import { useNavigate as useNavigate3 } from 'react-router-dom';
import { authAPI, dataAPI, gmailAPI } from '../services/api';
import { Topbar as Topbar3 } from '../components/ui';
import useAuthStore2 from '../store/authStore';
import useCurrencyStore2, { CURRENCIES as ALL_CURRENCIES } from '../store/currencyStore';
import useLangStore2 from '../store/langStore';
import { useFmt as useFmtHook } from '../i18n';
import { useT as useT2 } from '../i18n';
import { User, Globe, Bell, Shield, ChevronRight as Chevron, Download, Trash2, Crown, Check, AlertTriangle, Eye, EyeOff, Key } from 'lucide-react';
import usePremiumStore from '../store/premiumStore';

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
  const { open: showPremium, openPremium, closePremium } = usePremiumStore();
  const [exportDone, setExportDone] = useState2(false);

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
            <div style={{ background:'rgba(55,214,122,.12)', color:'#00a86b', padding:'12px 16px', borderRadius:14, marginBottom:20, fontSize:13.5, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
              {t('settings_saved')}
            </div>
          )}

          {/* Profile hero */}
          <div style={{ background:'linear-gradient(135deg,#6C63FF 0%,#5B8CFF 100%)', borderRadius:22, padding:'28px 32px', marginBottom:20, color:'#fff', display:'flex', alignItems:'center', gap:20, boxShadow:'0 8px 32px rgba(108,99,255,.3)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, background:'rgba(255,255,255,.08)', borderRadius:'50%' }}/>
            <div style={{ position:'absolute', bottom:-20, right:80, width:60, height:60, background:'rgba(255,255,255,.05)', borderRadius:'50%' }}/>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:22, fontWeight:700, flexShrink:0, backdropFilter:'blur(10px)', border:'2px solid rgba(255,255,255,.3)' }}>
              {initials}
            </div>
            <div style={{ position:'relative', zIndex:1, flex:1 }}>
              <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3 }}>{user?.first_name} {user?.last_name}</div>
              <div style={{ fontSize:13, opacity:.8, marginTop:2 }}>{user?.email}</div>
              <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center' }}>
                {user?.is_premium ? (
                  <span style={{ fontSize:11, background:'rgba(255,184,77,.25)', border:'1px solid rgba(255,184,77,.4)', borderRadius:20, padding:'3px 12px', fontWeight:700, color:'#FFB84D' }}>✨ Premium</span>
                ) : (
                  <>
                    <span style={{ fontSize:11, background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 10px', fontWeight:600 }}>{t('settings_free_plan')}</span>
                    <button onClick={() => openPremium()}
                      style={{ fontSize:11, background:'rgba(255,184,77,.25)', border:'1px solid rgba(255,184,77,.5)', borderRadius:20, padding:'3px 10px', fontWeight:700, color:'#FFE4A0', cursor:'pointer' }}>
                      {t('settings_upgrade_btn')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Profile form */}
          <SectionCard icon={<User size={18} color="#6C63FF"/>} title={t('settings_profile')}>
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
              style={{ background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
              {mutation.isPending ? t('modal_saving') : t('settings_save')}
            </button>
          </SectionCard>

          {/* Currency & Region */}
          <SectionCard icon={<Globe size={18} color="#5B8CFF"/>} title={t('settings_currency_region')}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">{t('settings_currency')}</label>
                <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {ALL_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings_language')}</label>
                <select className="form-input" value={lang} onChange={e => setLang(e.target.value)}>
                  <option value="en">🇬🇧 English</option>
                  <option value="ta">🇮🇳 தமிழ் (Tamil)</option>
                </select>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => { setSaved(true); setTimeout(()=>setSaved(false),2500); }}>{t('settings_save_prefs')}</button>
          </SectionCard>

          {/* Notifications */}
          <NotificationPrefsSection />

          {/* Security / Change Password */}
          <ChangePasswordSection user={user} />

          {/* Gmail Auto-Import */}
          <GmailSection user={user} openPremium={openPremium} />

          {/* Data Backup */}
          <SectionCard icon={<Download size={18} color="#5B8CFF"/>} title="Data Backup & Export">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13.5, color:'var(--text)', lineHeight:1.6, marginBottom:10 }}>
                  Download all your financial data — transactions, wallets, budgets, goals and categories — as a JSON file you can store safely or import elsewhere.
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['Transactions','Wallets','Budgets','Goals','Categories'].map(t => (
                    <span key={t} style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'var(--accent-light)', color:'var(--accent)' }}>{t}</span>
                  ))}
                </div>
              </div>
              <button onClick={handleExport} disabled={exporting}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:12, fontWeight:700, fontSize:13.5, cursor:'pointer', flexShrink:0, background: exportDone?'rgba(55,214,122,.15)':'var(--accent-light)', border: exportDone?'1.5px solid #37D67A':'1.5px solid var(--accent)', color: exportDone?'#37D67A':'var(--accent)', transition:'all .2s' }}>
                <Download size={15}/> {exporting ? 'Exporting…' : exportDone ? '✓ Downloaded!' : 'Export JSON'}
              </button>
            </div>
          </SectionCard>

          {/* Reset Data */}
          <SectionCard icon={<Trash2 size={18} color="#FF5B5B"/>} title="Reset Data">
            <div style={{ fontSize:13.5, color:'var(--text3)', marginBottom:16, lineHeight:1.6 }}>
              Permanently delete selected data. <strong style={{color:'var(--red)'}}>This cannot be undone.</strong> Export a backup first.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { scope:'transactions', label:'Clear All Transactions',      desc:'Remove every income & expense record',       color:'#FFB84D', bg:'rgba(255,184,77,.1)' },
                { scope:'budgets',      label:'Delete All Budgets',           desc:'Remove all monthly budget configurations',   color:'#5B8CFF', bg:'rgba(91,140,255,.1)'  },
                { scope:'goals',        label:'Delete All Goals',             desc:'Remove all saving goals and progress',       color:'#37D67A', bg:'rgba(55,214,122,.1)'  },
                { scope:'all',          label:'⚠️ Reset Everything',           desc:'Wipe all data — wallets, transactions, budgets, goals & categories', color:'#FF5B5B', bg:'rgba(255,91,91,.1)'   },
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
            <div onClick={() => navigate3('/admin')} style={{ cursor:'pointer', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)', borderRadius:20, padding:'18px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16, boxShadow:'0 4px 24px rgba(108,99,255,.15)', border:'1px solid rgba(108,99,255,.4)', transition:'transform .2s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>
              <div style={{ width:46, height:46, borderRadius:14, background:'linear-gradient(135deg,#6C63FF,#a29bfe)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:3 }}>Admin Dashboard</div>
                <div style={{ fontSize:12.5, color:'rgba(255,255,255,.5)' }}>Users, stats, premium management & more</div>
              </div>
              <div style={{ background:'rgba(108,99,255,.25)', border:'1px solid rgba(108,99,255,.5)', borderRadius:12, padding:'8px 16px', color:'#a29bfe', fontSize:13, fontWeight:700, flexShrink:0 }}>
                Open →
              </div>
            </div>
          )}

          {/* Plan info teaser — only for free users */}
          {!user?.is_premium && <div onClick={() => openPremium()} style={{ cursor:'pointer', background:'linear-gradient(135deg,#1a1033 0%,#2d2055 100%)', borderRadius:20, padding:'22px 24px', marginBottom:16, display:'flex', alignItems:'center', gap:16, boxShadow:'0 4px 24px rgba(108,99,255,.2)', border:'1px solid rgba(108,99,255,.3)', transition:'transform .2s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e=>e.currentTarget.style.transform=''}>
            <div style={{ width:46, height:46, borderRadius:14, background:'rgba(255,184,77,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Crown size={22} color="#FFB84D"/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:3 }}>Unlock Premium Features</div>
              <div style={{ fontSize:12.5, color:'rgba(255,255,255,.6)' }}>AI insights, unlimited accounts, priority support & more.</div>
            </div>
            <div style={{ background:'linear-gradient(135deg,#FFB84D,#FF79A8)', borderRadius:12, padding:'8px 18px', color:'#fff', fontSize:13, fontWeight:700, flexShrink:0 }}>
              ₹100/mo →
            </div>
          </div>}

        </div>
      </div>

      {resetModal && <ResetModal scope={resetModal} onClose={() => setResetModal(false)}/>}
      {showPremium && <PremiumModal onClose={closePremium}/>}
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
    <SectionCard icon={<Bell size={18} color="#FFB84D"/>} title="Notifications">
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
              style={{ padding:'9px 20px', borderRadius:11, background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? .7 : 1 }}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
            {savedNotif && <span style={{ fontSize:12.5, color:'#37D67A', fontWeight:600 }}>✅ Saved!</span>}
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
    <SectionCard icon={<Shield size={18} color="#37D67A"/>} title="Security">
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
            {error && <div style={{ background:'rgba(255,91,91,.1)', border:'1px solid rgba(255,91,91,.3)', borderRadius:10, padding:'9px 13px', marginBottom:12, color:'#FF5B5B', fontSize:13 }}>{error}</div>}
            {success && <div style={{ background:'rgba(55,214,122,.1)', border:'1px solid rgba(55,214,122,.3)', borderRadius:10, padding:'9px 13px', marginBottom:12, color:'#37D67A', fontSize:13 }}>{success}</div>}

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
              style={{ marginTop:4, padding:'9px 20px', borderRadius:11, background:'linear-gradient(135deg,#37D67A,#00b894)', color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? .7 : 1, display:'flex', alignItems:'center', gap:8 }}>
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
    onSuccess: () => { setDone(true); setTimeout(() => { onClose(); window.location.reload(); }, 1800); },
  });

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:420 }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, marginBottom:20, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:18, background:'rgba(255,91,91,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <AlertTriangle size={28} color="#FF5B5B"/>
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
                style={{ background:'linear-gradient(135deg,#FF5B5B,#FF79A8)', border:'none', boxShadow:'0 4px 14px rgba(255,91,91,.35)', color:'#fff', padding:'8px 20px', borderRadius:10, fontWeight:700, cursor: confirm==='DELETE'?'pointer':'not-allowed', opacity: confirm==='DELETE'?1:.5 }}>
                {mutation.isPending ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'12px 0', fontSize:15, fontWeight:700, color:'#37D67A' }}>
            ✅ Data deleted. Refreshing…
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Premium modal ─────────────────────────────────────── */
const FREE_FEATURES = [
  '✅ Up to 3 accounts/wallets',
  '✅ Transaction tracking',
  '✅ 3 budget categories',
  '✅ 2 saving goals',
  '✅ Basic analytics (30 days)',
  '✅ Debt tracking',
  '❌ AI spending insights',
  '❌ Unlimited accounts',
  '❌ Unlimited budgets & goals',
  '❌ Full analytics history',
  '❌ Data export (CSV)',
  '❌ Priority support',
  '❌ Custom categories (unlimited)',
  '❌ Multi-currency support',
];

const PREMIUM_FEATURES = [
  '✅ Unlimited accounts/wallets',
  '✅ Unlimited transactions',
  '✅ Unlimited budget categories',
  '✅ Unlimited saving goals',
  '✅ Full analytics history',
  '✅ Debt tracking + EMI schedule',
  '✅ AI spending insights',
  '✅ Data export (JSON + CSV)',
  '✅ Priority email support',
  '✅ Custom categories (unlimited)',
  '✅ Multi-currency support',
  '✅ Recurring transactions',
  '✅ Bill reminders',
  '✅ Family sharing (up to 5)',
];

export function PremiumModal({ onClose }) {
  const [upgrading, setUpgrading] = useState2(false);

  const handleUpgrade = () => {
    setUpgrading(true);
    window.open('https://wa.me/918782424920?text=Hi!%20I%20want%20to%20upgrade%20to%20Tracksy%20Premium%20(%E2%82%B9100%2Fmonth)', '_blank');
    setTimeout(() => setUpgrading(false), 2000);
  };

  const freeFeatures    = ['Up to 3 accounts/wallets','Transaction tracking','3 budget categories','2 saving goals','Basic analytics (30 days)','Debt tracking'];
  const lockedFeatures  = ['WhatsApp transaction logging','Unlimited accounts','Unlimited budgets & goals','Full analytics history','Data export (CSV + JSON)','Priority support','Custom categories','Multi-currency'];
  const premiumFeatures = [...freeFeatures, 'WhatsApp transaction logging','Unlimited accounts/wallets','Unlimited budgets & goals','Full analytics history','Data export (JSON + CSV)','Priority email support','Custom categories (unlimited)','Multi-currency support','Recurring transactions','Bill reminders','AI spending insights'];

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:680, padding:0, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1a1033 0%,#2d2055 100%)', padding:'28px 32px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, background:'rgba(255,184,77,.1)', borderRadius:'50%' }}/>
          <div style={{ position:'absolute', bottom:-30, left:40, width:60, height:60, background:'rgba(108,99,255,.15)', borderRadius:'50%' }}/>
          <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,.1)', border:'none', borderRadius:8, cursor:'pointer', padding:'4px 8px', color:'rgba(255,255,255,.7)', fontSize:16 }}>✕</button>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <Crown size={28} color="#FFB84D"/>
            <div style={{ fontSize:22, fontWeight:900, color:'#fff', letterSpacing:-0.5 }}>Tracksy Premium</div>
          </div>
          <div style={{ fontSize:14, color:'rgba(255,255,255,.7)' }}>Unlock the full power of your personal finance</div>
          <div style={{ display:'inline-flex', alignItems:'baseline', gap:4, marginTop:18, background:'rgba(255,184,77,.2)', borderRadius:12, padding:'8px 18px', border:'1px solid rgba(255,184,77,.3)' }}>
            <span style={{ fontSize:13, color:'#FFB84D', fontWeight:700 }}>₹</span>
            <span style={{ fontSize:36, fontWeight:900, color:'#FFB84D', letterSpacing:-1 }}>100</span>
            <span style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>/month</span>
          </div>
        </div>

        {/* Feature comparison */}
        <div style={{ padding:'24px 32px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
            {/* Free */}
            <div style={{ borderRadius:16, overflow:'hidden', border:'1px solid var(--border)' }}>
              <div style={{ background:'var(--surface2)', padding:'12px 16px', fontWeight:800, fontSize:14, color:'var(--text3)', borderBottom:'1px solid var(--border-light)' }}>Free Plan</div>
              <div style={{ padding:'12px 16px', maxHeight:280, overflowY:'auto' }}>
                {freeFeatures.map(f => <div key={f} style={{ fontSize:12.5, color:'var(--text)', padding:'4px 0', display:'flex', gap:7 }}>✅ {f}</div>)}
                {lockedFeatures.map(f => <div key={f} style={{ fontSize:12.5, color:'var(--text3)', padding:'4px 0', display:'flex', gap:7 }}>❌ {f}</div>)}
              </div>
            </div>
            {/* Premium */}
            <div style={{ borderRadius:16, overflow:'hidden', border:'1.5px solid rgba(255,184,77,.35)' }}>
              <div style={{ background:'rgba(255,184,77,.08)', padding:'12px 16px', fontWeight:800, fontSize:14, color:'#FFB84D', borderBottom:'1px solid var(--border-light)' }}>Premium ✨</div>
              <div style={{ padding:'12px 16px', maxHeight:280, overflowY:'auto' }}>
                {premiumFeatures.map(f => <div key={f} style={{ fontSize:12.5, color:'var(--text)', padding:'4px 0', display:'flex', gap:7 }}>✅ {f}</div>)}
              </div>
            </div>
          </div>

          <button onClick={handleUpgrade} disabled={upgrading}
            style={{ width:'100%', padding:'14px', borderRadius:14, background:'linear-gradient(135deg,#FFB84D,#FF79A8)', border:'none', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(255,184,77,.4)', letterSpacing:-0.2, transition:'opacity .15s', opacity:upgrading?.8:1 }}
            onMouseEnter={e=>e.currentTarget.style.opacity='.9'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            {upgrading ? 'Opening…' : '✨ Upgrade to Premium — ₹100/month'}
          </button>
          <div style={{ textAlign:'center', fontSize:12, color:'var(--text3)', marginTop:10 }}>
            7-day free trial · Cancel anytime · UPI / Card / Net banking
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:20, padding:'22px 24px', boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)', marginBottom:16 }}>
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

/* ── Gmail Auto-Import section ───────────────────────────── */
function GmailSection({ user, openPremium }) {
  const qc = useQueryClient();
  const [syncResult, setSyncResult] = useState2(null);
  const [params] = [new URLSearchParams(window.location.search)];

  const { data: status } = useQuery2({
    queryKey: ['gmail-status'],
    queryFn: () => gmailAPI.status().then(r => r.data.data),
  });

  const syncMut = useMutation2({
    mutationFn: () => gmailAPI.sync(),
    onSuccess: (r) => {
      setSyncResult(r.data.data);
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
  const disconnectMut = useMutation2({
    mutationFn: () => gmailAPI.disconnect(),
    onSuccess: () => { setSyncResult(null); qc.invalidateQueries({ queryKey: ['gmail-status'] }); },
  });
  const toggleMut = useMutation2({
    mutationFn: (en) => gmailAPI.toggle(en),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmail-status'] }),
  });

  const connected = status?.connected;
  const justConnected = params.get('gmail') === 'connected';

  const SvgGmail = (
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M5 5h14a2 2 0 0 1 2 2v.4L12 13 3 7.4V7a2 2 0 0 1 2-2z"/><path fill="#34A853" d="M3 9.2V17a2 2 0 0 0 2 2h2V11l-4-1.8z"/><path fill="#FBBC04" d="M17 19h2a2 2 0 0 0 2-2V9.2L17 11v8z"/><path fill="#4285F4" d="M7 19h10v-8l-5 3-5-3v8z"/></svg>
  );

  return (
    <SectionCard icon={SvgGmail} title="Gmail Auto-Import">
      {/* Premium gate */}
      {!user?.is_premium ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div style={{ fontSize:13.5, color:'var(--text2)', lineHeight:1.6, flex:1 }}>
            Connect Gmail and Tracksy will automatically read your bank & UPI transaction
            emails every night and add them for you — no manual entry.
            <div style={{ marginTop:6, fontSize:12, color:'var(--text3)' }}>🔒 Read-only access. We only scan transaction alerts.</div>
          </div>
          <button onClick={openPremium}
            style={{ padding:'10px 20px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#FFB84D,#FF79A8)', color:'#fff', fontWeight:700, fontSize:13.5, cursor:'pointer', flexShrink:0 }}>
            ✨ Upgrade
          </button>
        </div>
      ) : !connected ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div style={{ fontSize:13.5, color:'var(--text2)', lineHeight:1.6, flex:1 }}>
            Auto-add transactions from your bank & UPI email alerts. Runs nightly; you can also sync on demand.
            <div style={{ marginTop:6, fontSize:12, color:'var(--text3)' }}>🔒 Read-only — Tracksy only scans transaction alerts, never sends email.</div>
          </div>
          <a href={gmailAPI.connectUrl()}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:12, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontWeight:700, fontSize:13.5, cursor:'pointer', flexShrink:0, textDecoration:'none' }}>
            {SvgGmail} Connect Gmail
          </a>
        </div>
      ) : (
        <div>
          {justConnected && (
            <div style={{ background:'rgba(55,214,122,.12)', color:'#00a86b', padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:600 }}>
              ✓ Gmail connected! Run your first sync below.
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ width:9, height:9, borderRadius:'50%', background:'#37D67A', flexShrink:0 }}/>
            <span style={{ fontSize:13.5, fontWeight:600, color:'var(--text)' }}>Connected</span>
            <span style={{ fontSize:12, color:'var(--text3)' }}>
              · Last sync: {status?.last_sync ? new Date(status.last_sync).toLocaleString('en-IN',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : 'never'}
            </span>
          </div>

          {/* Nightly toggle */}
          <label style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, cursor:'pointer' }}>
            <div onClick={() => toggleMut.mutate(!status.sync_enabled)} style={{
              width:40, height:22, borderRadius:11, flexShrink:0, position:'relative', transition:'background .2s',
              background: status?.sync_enabled ? '#37D67A' : 'var(--surface3)',
            }}>
              <div style={{ position:'absolute', top:3, left: status?.sync_enabled ? 21 : 3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}/>
            </div>
            <span style={{ fontSize:13, color:'var(--text2)' }}>Automatic nightly sync (2:00 AM)</span>
          </label>

          {syncResult && (
            <div style={{ background:'var(--accent-light)', color:'var(--accent)', padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:600 }}>
              ✓ Imported {syncResult.imported} new transaction{syncResult.imported!==1?'s':''} (scanned {syncResult.scanned} emails)
            </div>
          )}

          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', color:'#fff', fontWeight:700, fontSize:13.5, cursor:'pointer' }}>
              {syncMut.isPending ? '⟳ Syncing…' : '↻ Sync Now'}
            </button>
            <button onClick={() => { if(confirm('Disconnect Gmail? Nightly auto-import will stop.')) disconnectMut.mutate(); }}
              style={{ padding:'10px 18px', borderRadius:12, border:'1.5px solid rgba(255,91,91,.3)', background:'var(--red-light)', color:'#FF5B5B', fontWeight:700, fontSize:13.5, cursor:'pointer' }}>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
