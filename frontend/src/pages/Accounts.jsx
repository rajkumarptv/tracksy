import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  Search, Plus, Eye, ChevronRight, ChevronDown, ChevronUp,
  Landmark, TrendingUp, TrendingDown, CreditCard, HandCoins, LayoutGrid, X, Trash2,
} from 'lucide-react';
import { walletsAPI } from '../services/api';
import useThemeStore from '../store/themeStore';
import { useFmt } from '../i18n';
import { THEME } from '../theme';
import ThemedSelect from '../components/ThemedSelect';
import styles from './Accounts.module.css';
import { invalidateFinance } from '../lib/cache';
import AmountToggle from '../components/AmountToggle';

/* ── Palette — derived from the shared dashboard theme ─────────────────── */
const DS = {
  light: {
    ...THEME.light,
    card: THEME.light.cardBg,
    shadow: THEME.light.cardShadow,
    overviewBg:'linear-gradient(135deg, #F5F2FF 0%, #EEF4FF 100%)',
    chipBg:'#FFFFFF', chipActiveBg:'#F5F3FF',
  },
  dark: {
    ...THEME.dark,
    card: THEME.dark.cardBg,
    shadow: THEME.dark.cardShadow,
    overviewBg: THEME.dark.flowBg,
    chipBg: THEME.dark.cardBg, chipActiveBg:'rgba(139,92,246,.15)',
  },
  primary:'#22C55E', secondary:'#8B5CF6', blue:'#3B82F6',
  pink:'#EC4899', warning:'#F59E0B', danger:'#EF4444',
};

/* ── Type taxonomy → 4 reference groups ────────────────────────────────── */
const TYPE_META = {
  bank:{e:'🏦',c:'#3B82F6'}, cash:{e:'💵',c:'#22C55E'},
  gpay:{e:'🟣',c:'#4285F4'}, phonepe:{e:'💜',c:'#5f259f'}, paytm:{e:'🟦',c:'#00B9F1'},
  amazon_pay:{e:'🛒',c:'#FF9900'}, mobikwik:{e:'💙',c:'#3b5bdb'}, jio_money:{e:'🔴',c:'#e03131'},
  airtel_money:{e:'❤️',c:'#e03131'}, paypal:{e:'🅿️',c:'#003087'}, irctc:{e:'🚂',c:'#2563eb'},
  fd:{e:'🏛️',c:'#00C896'}, mutual_fund:{e:'📊',c:'#8B5CF6'}, stocks:{e:'📈',c:'#22C55E'},
  gold:{e:'🪙',c:'#F59E0B'}, crypto:{e:'₿',c:'#F7931A'}, epf:{e:'🛡️',c:'#A29BFE'},
  real_estate:{e:'🏠',c:'#FF79A8'}, lending:{e:'🤝',c:'#00CEC9'}, asset:{e:'💼',c:'#636E72'},
  visa:{e:'💳',c:'#EC4899'}, mastercard:{e:'💳',c:'#EB001B'},
  home_loan:{e:'🏠',c:'#EC4899'}, vehicle_loan:{e:'🚗',c:'#F59E0B'}, personal_loan:{e:'💼',c:'#FF79A8'},
  gold_loan:{e:'🪙',c:'#F59E0B'}, education_loan:{e:'🎓',c:'#3B82F6'}, loan:{e:'📋',c:'#A29BFE'},
  bnpl:{e:'🛍️',c:'#FF79A8'}, family_borrow:{e:'👨‍👩‍👧',c:'#F59E0B'}, emi:{e:'📅',c:'#8B5CF6'},
};

const BANK_TYPES   = ['bank','cash','other','gpay','phonepe','paytm','amazon_pay','mobikwik','jio_money','airtel_money','paypal','irctc'];
const INVEST_TYPES = ['fd','mutual_fund','stocks','gold','crypto','epf','real_estate','lending','asset'];
const CARD_TYPES   = ['visa','mastercard'];
const LOAN_TYPES   = ['home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan','bnpl','family_borrow','emi'];

const GROUPS = [
  { key:'bank',   title:'Bank Accounts', icon:Landmark,   color:'#3B82F6', totalLabel:'Total Balance',     types:BANK_TYPES,   liability:false, link:'View all bank accounts', linkColor:'#7C3AED' },
  { key:'invest', title:'Investments',   icon:TrendingUp, color:'#22C55E', totalLabel:'Total Value',       types:INVEST_TYPES, liability:false, link:'View all investments',   linkColor:'#22C55E' },
  { key:'cards',  title:'Credit Cards',  icon:CreditCard, color:'#F59E0B', totalLabel:'Total Outstanding', types:CARD_TYPES,   liability:true,  link:'View all credit cards',  linkColor:'#F59E0B' },
  { key:'loans',  title:'Loans',         icon:HandCoins,  color:'#EC4899', totalLabel:'Total Outstanding', types:LOAN_TYPES,   liability:true,  link:'View all loans',         linkColor:'#EC4899' },
];

/* Donut colors per group (reference legend) */
const GROUP_DONUT = { bank:'#3B82F6', invest:'#22C55E', cards:'#F59E0B', loans:'#8B5CF6' };

const spring = { type:'spring', stiffness:280, damping:28 };
const containerVar = { hidden:{}, show:{ transition:{ staggerChildren:.07 } } };
const cardVar = { hidden:{ opacity:0, y:22 }, show:{ opacity:1, y:0, transition:spring } };

/* ═══════════════════════════════════════════════════════════════════════ */
export default function Accounts() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const t = isDark ? DS.dark : DS.light;
  const fmt = useFmt();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [filter, setFilter] = useState('all');
  const [collapsed, setCollapsed] = useState({});
  const [expanded, setExpanded]   = useState({}); // "view all" per group
  const [modal, setModal] = useState(null);       // null | {mode:'add'} | {mode:'edit', wallet}
  const [payWallet, setPayWallet] = useState(null); // liability payment modal

  const { data: apiWallets, isLoading } = useQuery({
    queryKey:['wallets'],
    queryFn:()=>walletsAPI.getAll().then(r=>r.data.data),
  });

  const wallets = apiWallets || [];

  /* ── Group the wallets ── */
  const grouped = useMemo(() => GROUPS.map(g => {
    const items = wallets.filter(w => g.types.includes(w.type));
    const total = items.reduce((s,w)=>s+parseFloat(w.balance||0),0);
    return { ...g, items, total };
  }).filter(g => g.items.length > 0), [wallets]);

  const totalBalance = wallets.reduce((s,w)=>s+parseFloat(w.balance||0),0);
  const totNeg = totalBalance < 0;
  const count = wallets.length;

  const donutData = grouped.map(g => ({
    name:g.title, value:Math.abs(g.total), color:GROUP_DONUT[g.key],
    signed:g.total, pct:0,
  }));
  const donutTotal = donutData.reduce((s,d)=>s+d.value,0);
  donutData.forEach(d => d.pct = donutTotal>0 ? Math.round((d.value/donutTotal)*100) : 0);

  const chips = [
    { key:'all', label:`All Accounts (${count})`, Icon:LayoutGrid },
    ...grouped.map(g => ({ key:g.key, label:`${g.title.replace(' Accounts','')} (${g.items.length})`, Icon:g.icon })),
  ];
  const visibleGroups = filter==='all' ? grouped : grouped.filter(g=>g.key===filter);

  return (
    <div className={styles.page} style={{ background:t.bg }}>
      <motion.div className={styles.inner} variants={containerVar} initial="hidden" animate="show">

        {/* ── Header ── */}
        <motion.div className={styles.header} variants={cardVar}>
          <div>
            <h1 className={styles.h1} style={{ color:t.text }}>Accounts</h1>
            <div className={styles.sub} style={{ color:t.text2 }}>Manage all your accounts in one place</div>
          </div>
          <div className={styles.headerBtns}>
            <button className={styles.circleBtn}
              style={{ background:t.card, border:`1px solid ${t.border}` }}
              onClick={()=>navigate('/transactions')}>
              <Search size={20} color={t.text2}/>
            </button>
            <motion.button className={styles.circleBtn} whileTap={{ scale:.9 }}
              style={{ background:'linear-gradient(180deg,#8B5CF6,#6D28D9)', border:'none', boxShadow:'0 8px 24px rgba(124,58,237,.35)' }}
              onClick={()=>setModal({ mode:'add' })}>
              <Plus size={22} color="#fff"/>
            </motion.button>
          </div>
        </motion.div>

        {/* ── Overview card ── */}
        <motion.div className={styles.overview} variants={cardVar}
          style={{ background: totNeg ? 'linear-gradient(135deg, rgba(239,68,68,.16), rgba(239,68,68,.06))' : t.overviewBg,
            border: totNeg ? '1px solid rgba(239,68,68,.35)' : (t.flowBorder || `1px solid ${t.border}`),
            boxShadow: totNeg ? '0 8px 30px rgba(239,68,68,.18)' : (t.glowShadow || t.shadow) }}>
          <div className={styles.overviewLeft}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:14, color:t.text2, fontWeight:500 }}>Total Balance</span>
              <AmountToggle size={16} color={t.text3}/>
            </div>
            <div className={styles.bigAmount} style={{ color: totNeg ? DS.danger : t.text }}>
              {totNeg && '−'}{fmt(Math.abs(totalBalance),{noDecimals:true})}
            </div>
            <div style={{ fontSize:14, color:t.text2 }}>Across {count} account{count!==1?'s':''}</div>
            {totNeg && (
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
                <TrendingDown size={14} color={DS.danger}/>
                <span style={{ fontSize:13, color:DS.danger, fontWeight:600 }}>Liabilities exceed assets</span>
              </div>
            )}
          </div>

          <div className={styles.overviewDivider} style={{ background:t.divider }}/>

          <div className={styles.overviewRight}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:14, fontWeight:600, color:t.text2 }}>Account Overview</span>
              <ChevronRight size={16} color={t.text3}/>
            </div>
            <div className={styles.donutRow}>
              <div className={styles.donutBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius="68%" outerRadius="96%"
                      paddingAngle={2} strokeWidth={0} animationDuration={900}>
                      {donutData.map((d,i)=><Cell key={i} fill={totNeg ? ['#EF4444','#F87171','#FCA5A5','#DC2626','#B91C1C'][i%5] : d.color}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.legend}>
                {donutData.map((d,i)=>(
                  <motion.div key={i} className={styles.legendRow}
                    initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} transition={{ delay:.3+i*.08 }}>
                    <span className={styles.legendDot} style={{ background:d.color }}/>
                    <span className={styles.legendName} style={{ color:t.text }}>{d.name}</span>
                    <span className={styles.legendVal} style={{ color:t.text }}>
                      {d.signed<0?'−':''}{fmt(Math.abs(d.signed),{noDecimals:true})}
                    </span>
                    <span className={styles.legendPct} style={{ color:t.text3 }}>{d.pct}%</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Filter chips ── */}
        <motion.div className={styles.chips} variants={cardVar}>
          {chips.map(({ key, label, Icon }) => {
            const active = filter === key;
            return (
              <motion.button key={key} whileTap={{ scale:.94 }}
                className={styles.chip}
                style={{
                  background: active ? t.chipActiveBg : t.chipBg,
                  border: `1.5px solid ${active ? DS.secondary : t.border}`,
                  color: active ? DS.secondary : t.text2,
                }}
                onClick={()=>setFilter(key)}>
                <Icon size={15}/> {label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Group cards ── */}
        {visibleGroups.map(g => {
          const isCollapsed = collapsed[g.key];
          const showAll = expanded[g.key];
          const rows = showAll ? g.items : g.items.slice(0,3);
          const GIcon = g.icon;
          const gNeg = g.total < 0;
          const totColor = gNeg ? DS.danger : (g.liability ? (g.key==='cards'?DS.warning:DS.pink) : DS.primary);
          return (
            <motion.div key={g.key} className={styles.groupCard} variants={cardVar}
              style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>

              {/* group head */}
              <div className={styles.groupHead} onClick={()=>setCollapsed(p=>({ ...p, [g.key]:!p[g.key] }))}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                  <div className={styles.groupIcon} style={{ background:`${g.color}1f` }}>
                    <GIcon size={19} color={g.color}/>
                  </div>
                  <span className={styles.groupTitle} style={{ color:t.text }}>{g.title}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, justifyContent:'flex-end' }}>
                  <span className={styles.groupTotalLabel} style={{ color:t.text2 }}>{g.totalLabel}</span>
                  <span className={styles.groupTotalAmt} style={{ color:totColor }}>
                    {(g.liability || gNeg)?'−':''}{fmt(Math.abs(g.total),{noDecimals:true})}
                  </span>
                  <div className={styles.collapseBtn} style={{ background:t.surface }}>
                    {isCollapsed ? <ChevronDown size={15} color={t.text2}/> : <ChevronUp size={15} color={t.text2}/>}
                  </div>
                </div>
              </div>

              {/* rows */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div key="body"
                    initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                    transition={{ duration:.25, ease:[.2,.8,.2,1] }}
                    style={{ overflow:'hidden' }}>
                    {rows.map((w,i) => {
                      const meta = TYPE_META[w.type] || { e:'👛', c:'#8B5CF6' };
                      const bal = parseFloat(w.balance||0);
                      const neg = bal < 0;
                      const isPrimary = g.key==='bank' && i===0 && !showAll;
                      return (
                        <motion.div key={w.id} className={styles.row}
                          style={{ borderTop:`1px solid ${t.divider}` }}
                          whileHover={{ backgroundColor: t.hover }}
                          onClick={()=>!w.demo && setModal({ mode:'edit', wallet:w })}>
                          <div className={styles.rowIcon} style={{ background:meta.c }}>
                            <span style={{ fontSize:18 }}>{meta.e}</span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                              <span className={styles.rowName} style={{ color:t.text }}>{w.name}</span>
                              {isPrimary && (
                                <span className={styles.primaryBadge}>Primary</span>
                              )}
                            </div>
                            <div style={{ fontSize:12.5, color:t.text2, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {w.last_four ? `•••• ${w.last_four}` : (TYPE_META[w.type] ? w.type.replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase()) : 'Account')}
                            </div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:15, fontWeight:800, color: neg ? DS.danger : t.text, fontFamily:'Space Grotesk, Inter, sans-serif' }}>
                              {neg?'−':''}{fmt(Math.abs(bal),{noDecimals:true})}
                            </div>
                            <div style={{ fontSize:12, marginTop:2, color: neg ? DS.danger : DS.primary, fontWeight: neg?600:700 }}>
                              {neg
                                ? (g.key==='cards' ? 'Outstanding' : 'Outstanding balance')
                                : <><TrendingUp size={11} style={{ verticalAlign:'-1px' }}/> {(Math.abs(bal)%13+3).toFixed(1)}%</>}
                            </div>
                          </div>
                          <ChevronRight size={17} color={t.text3} style={{ flexShrink:0 }}/>
                        </motion.div>
                      );
                    })}

                    {g.items.length > 3 && (
                      <div className={styles.groupFoot} style={{ borderTop:`1px solid ${t.divider}` }}
                        onClick={()=>setExpanded(p=>({ ...p, [g.key]:!p[g.key] }))}>
                        <span style={{ fontSize:13.5, fontWeight:700, color:g.linkColor }}>
                          {showAll ? `Show less` : g.link}
                        </span>
                        <ChevronRight size={16} color={t.text3}/>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {!isLoading && wallets.length === 0 && (
          <motion.div variants={cardVar}
            style={{ textAlign:'center', padding:'40px 20px', background:t.card, border:`1px solid ${t.border}`, borderRadius:20, boxShadow:t.shadow }}>
            <div style={{ fontSize:38, marginBottom:12 }}>🏦</div>
            <div style={{ fontSize:16, fontWeight:700, color:t.text }}>No accounts yet</div>
            <div style={{ fontSize:13, color:t.text2, marginTop:4, marginBottom:16 }}>Add your bank accounts, cards and loans to get started</div>
            <button onClick={()=>setModal({ mode:'add' })}
              style={{ padding:'12px 22px', borderRadius:14, border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
                background:'linear-gradient(180deg,#8B5CF6,#6D28D9)', color:'#fff', boxShadow:'0 8px 24px rgba(124,58,237,.35)' }}>
              + Add Account
            </button>
          </motion.div>
        )}
      </motion.div>

      {modal && (
        <AccountModal
          mode={modal.mode} wallet={modal.wallet} t={t} isDark={isDark}
          onClose={()=>setModal(null)}
          onSaved={()=>{ invalidateFinance(qc); setModal(null); }}
          onPay={(w)=>{ setModal(null); setPayWallet(w); }}
        />
      )}
      {payWallet && (
        <PaymentModal wallet={payWallet} t={t} isDark={isDark} accounts={wallets.filter(w=>!GROUPS[2].types.concat(GROUPS[3].types).includes(w.type))}
          onClose={()=>setPayWallet(null)}
          onSaved={()=>{ invalidateFinance(qc); invalidateFinance(qc); setPayWallet(null); }}
        />
      )}
    </div>
  );
}

/* ═══ Add / Edit modal ═══════════════════════════════════════════════════ */
const TYPE_GROUPS = [
  { group:'Bank Account', items:[
    { value:'bank', emoji:'🏦', label:'Bank Account' }, { value:'cash', emoji:'💵', label:'Cash' },
  ]},
  { group:'Cards', items:[
    { value:'visa', emoji:'💳', label:'Visa Card' }, { value:'mastercard', emoji:'💳', label:'Mastercard' },
  ]},
  { group:'Loans', items:[
    { value:'home_loan', emoji:'🏠', label:'Home Loan' }, { value:'vehicle_loan', emoji:'🚗', label:'Vehicle Loan' },
    { value:'personal_loan', emoji:'💼', label:'Personal Loan' }, { value:'gold_loan', emoji:'🪙', label:'Gold Loan' },
    { value:'education_loan', emoji:'🎓', label:'Education Loan' }, { value:'loan', emoji:'📋', label:'Other Loan' },
  ]},
  { group:'Others', items:[
    { value:'other', emoji:'👛', label:'Other Account' },
  ]},
];

const M_CARD_TYPES = ['visa','mastercard'];
const M_LOAN_TYPES = ['home_loan','vehicle_loan','personal_loan','gold_loan','education_loan','loan'];
const M_EMI_TYPES  = ['emi','bnpl','family_borrow'];
const isCardType = (ty) => M_CARD_TYPES.includes(ty);
const isLoanType = (ty) => M_LOAN_TYPES.includes(ty);
const isEmiType  = (ty) => M_EMI_TYPES.includes(ty);

/* Field wrapper — module-scoped so inputs don't remount on every keystroke */
const ModalField = ({ label, lblSt, children }) => (
  <div><label style={lblSt}>{label}</label>{children}</div>
);

/* Standard EMI formula: P·r·(1+r)^n / ((1+r)^n − 1) */
function calcEMI(principal, annualRate, months) {
  const P = parseFloat(principal||0), n = parseInt(months||0);
  const r = parseFloat(annualRate||0) / 12 / 100;
  if (!P || !n) return 0;
  if (r === 0) return Math.round(P / n);
  const f = Math.pow(1 + r, n);
  return Math.round((P * r * f) / (f - 1));
}

function AccountModal({ mode, wallet, t, isDark, onClose, onSaved, onPay }) {
  const fmt = useFmt();
  const [name, setName]         = useState(wallet?.name || '');
  const [type, setType]         = useState(wallet?.type || 'bank');
  const [lastFour, setLastFour] = useState(wallet?.last_four || '');
  const [balance, setBalance]   = useState(wallet ? Math.abs(parseFloat(wallet.balance??0)) || '' : '');
  // liability-specific
  const [creditLimit, setCreditLimit] = useState(wallet?.credit_limit || '');
  const [statementDay, setStatementDay] = useState(wallet?.statement_day || '');
  const [paymentDay, setPaymentDay]     = useState(wallet?.payment_day || '');
  const [loanAmount, setLoanAmount]   = useState(wallet?.total_loan_amount || '');
  const [rate, setRate]               = useState(wallet?.interest_rate || '');
  const [tenure, setTenure]           = useState(wallet?.tenure_months || '');
  const [emiDay, setEmiDay]           = useState(wallet?.emi_day || '');
  const [emiManual, setEmiManual]     = useState(wallet?.emi_amount || '');
  const [startDate, setStartDate]     = useState(wallet?.start_date ? String(wallet.start_date).split('T')[0] : '');
  const [err, setErr]           = useState('');
  const [busy, setBusy]         = useState(false);
  const isEdit = mode === 'edit';

  const goldLoan = type === 'gold_loan';                 // interest-accrual, no EMI
  const card = isCardType(type);
  const emiLoan = isLoanType(type) && !goldLoan;         // regular EMI loans
  const emi = isEmiType(type);
  const liability = card || emiLoan || goldLoan || emi;

  const computedEMI = emiLoan ? calcEMI(loanAmount, rate, tenure) : parseFloat(emiManual||0);
  const availableLimit = card ? Math.max(0, parseFloat(creditLimit||0) - parseFloat(balance||0)) : 0;
  const totalPayable = emiLoan && computedEMI && tenure ? computedEMI * parseInt(tenure) : 0;
  const totalInterest = totalPayable ? totalPayable - parseFloat(loanAmount||0) : 0;

  /* ── Gold loan: interest accrues monthly on principal, no EMI ── */
  const monthsElapsed = startDate
    ? Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000*60*60*24*30.4375)))
    : 0;
  const monthlyInterest = goldLoan ? Math.round(parseFloat(loanAmount||0) * (parseFloat(rate||0)/100/12)) : 0;
  const accruedInterest = goldLoan ? monthlyInterest * monthsElapsed : 0;
  const projectedOutstanding = goldLoan ? parseFloat(loanAmount||0) + accruedInterest : 0;

  const save = async () => {
    if (!name.trim()) { setErr('Enter an account name'); return; }
    setBusy(true);
    try {
      // liabilities store balance as NEGATIVE (outstanding owed)
      const rawBal = parseFloat(balance||0);
      const payload = {
        name: name.trim(), type, last_four: lastFour||null,
        balance: liability ? -Math.abs(rawBal) : rawBal,
      };
      if (startDate) payload.start_date = startDate;
      if (card) {
        payload.credit_limit = parseFloat(creditLimit||0) || null;
        payload.interest_rate = parseFloat(rate||0) || null;
        payload.statement_day = parseInt(statementDay||0) || null;
        payload.payment_day = parseInt(paymentDay||0) || null;
      }
      if (emiLoan) {
        payload.total_loan_amount = parseFloat(loanAmount||0) || null;
        payload.interest_rate = parseFloat(rate||0) || null;
        payload.emi_amount = computedEMI || null;
        payload.emi_day = parseInt(emiDay||0) || null;
      }
      if (goldLoan) {
        // no EMI; principal + rate + start date drive accrual. outstanding defaults to projected.
        payload.total_loan_amount = parseFloat(loanAmount||0) || null;
        payload.interest_rate = parseFloat(rate||0) || null;
        payload.emi_amount = null;
        if (!parseFloat(balance||0) && projectedOutstanding) payload.balance = -Math.abs(projectedOutstanding);
      }
      if (emi) {
        payload.emi_amount = parseFloat(emiManual||0) || null;
        payload.emi_day = parseInt(emiDay||0) || null;
      }
      if (isEdit) await walletsAPI.update(wallet.id, payload);
      else        await walletsAPI.create(payload);
      onSaved();
    } catch(e) { setErr(e.response?.data?.message || 'Failed to save'); setBusy(false); }
  };

  const del = async () => {
    if (!window.confirm('Delete this account?')) return;
    setBusy(true);
    try { await walletsAPI.delete(wallet.id); onSaved(); }
    catch(e) { setErr('Failed to delete'); setBusy(false); }
  };

  const inputSt = {
    width:'100%', height:52, borderRadius:14, padding:'0 16px', boxSizing:'border-box',
    border:`1.5px solid ${t.border}`, background:t.surface, color:t.text,
    fontSize:15, outline:'none', fontFamily:'inherit',
  };
  const lblSt = { fontSize:12, fontWeight:700, color:t.text3, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6, display:'block' };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:300, backdropFilter:'blur(4px)' }}/>
      {/* Flex wrapper centres the modal — framer-motion animates transform, so we
          must NOT rely on translate(-50%,-50%) for centring (it gets overwritten). */}
      <div style={{ position:'fixed', inset:0, zIndex:301, display:'flex', alignItems:'center',
        justifyContent:'center', padding:16, pointerEvents:'none' }}>
      <motion.div initial={{ opacity:0, y:40, scale:.97 }} animate={{ opacity:1, y:0, scale:1 }} transition={spring}
        style={{ width:'min(460px, 100%)', background:t.card, borderRadius:24, pointerEvents:'auto',
          border:`1px solid ${t.border}`, boxShadow:'0 30px 80px rgba(0,0,0,.25)', padding:20,
          display:'flex', flexDirection:'column', gap:14, maxHeight:'88vh', overflowY:'auto' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:18, fontWeight:800, color:t.text }}>{isEdit ? 'Edit Account' : 'Add Account'}</span>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:12, background:t.surface, border:`1px solid ${t.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <X size={16} color={t.text2}/>
          </button>
        </div>

        <ModalField lblSt={lblSt} label="Account Name">
          <input style={inputSt} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. HDFC Salary Account"/>
        </ModalField>

        <ModalField lblSt={lblSt} label="Type">
          <ThemedSelect value={type} onChange={setType} groups={TYPE_GROUPS} placeholder="Choose account type"/>
        </ModalField>

        {/* liability note */}
        {liability && (
          <div style={{ fontSize:12, color:DS.warning, fontWeight:600, display:'flex', alignItems:'center', gap:6, background:'rgba(245,158,11,.1)', padding:'8px 12px', borderRadius:10 }}>
            ⚠️ This is a liability — it will also appear in your <b>Debts</b> tab.
          </div>
        )}

        {/* ── ASSET fields ── */}
        {!liability && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <ModalField lblSt={lblSt} label="Last 4 Digits">
              <input style={inputSt} value={lastFour} maxLength={4} onChange={e=>setLastFour(e.target.value.replace(/\D/g,''))} placeholder="4567"/>
            </ModalField>
            <ModalField lblSt={lblSt} label="Balance (₹)">
              <input style={inputSt} type="number" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="0"/>
            </ModalField>
          </div>
        )}

        {/* ── CREDIT CARD fields ── */}
        {card && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <ModalField lblSt={lblSt} label="Last 4 Digits">
                <input style={inputSt} value={lastFour} maxLength={4} onChange={e=>setLastFour(e.target.value.replace(/\D/g,''))} placeholder="5678"/>
              </ModalField>
              <ModalField lblSt={lblSt} label="Interest Rate (% p.a.)">
                <input style={inputSt} type="number" value={rate} onChange={e=>setRate(e.target.value)} placeholder="42"/>
              </ModalField>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <ModalField lblSt={lblSt} label="Total Limit (₹)">
                <input style={inputSt} type="number" value={creditLimit} onChange={e=>setCreditLimit(e.target.value)} placeholder="200000"/>
              </ModalField>
              <ModalField lblSt={lblSt} label="Outstanding (₹)">
                <input style={inputSt} type="number" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="85000"/>
              </ModalField>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <ModalField lblSt={lblSt} label="Bill Generation Day">
                <input style={inputSt} type="number" min="1" max="31" value={statementDay} onChange={e=>setStatementDay(e.target.value)} placeholder="e.g. 5"/>
              </ModalField>
              <ModalField lblSt={lblSt} label="Payment Due Day">
                <input style={inputSt} type="number" min="1" max="31" value={paymentDay} onChange={e=>setPaymentDay(e.target.value)} placeholder="e.g. 25"/>
              </ModalField>
            </div>
            <div style={{ fontSize:11.5, color:t.text3, marginTop:-4 }}>
              Day of the month the statement is generated and when payment is due — used for upcoming-payment reminders.
            </div>
            {parseFloat(creditLimit||0) > 0 && (
              <div style={{ background:t.surface, borderRadius:12, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, color:t.text2 }}>Available Limit</span>
                <span style={{ fontSize:16, fontWeight:800, color:DS.primary, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(availableLimit,{noDecimals:true})}</span>
              </div>
            )}
          </>
        )}

        {/* ── EMI LOAN fields ── */}
        {emiLoan && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <ModalField lblSt={lblSt} label="Loan Amount (₹)">
                <input style={inputSt} type="number" value={loanAmount} onChange={e=>setLoanAmount(e.target.value)} placeholder="2500000"/>
              </ModalField>
              <ModalField lblSt={lblSt} label="Outstanding (₹)">
                <input style={inputSt} type="number" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="2200000"/>
              </ModalField>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              <ModalField lblSt={lblSt} label="Rate (% p.a.)">
                <input style={inputSt} type="number" value={rate} onChange={e=>setRate(e.target.value)} placeholder="8.5"/>
              </ModalField>
              <ModalField lblSt={lblSt} label="Tenure (mo)">
                <input style={inputSt} type="number" value={tenure} onChange={e=>setTenure(e.target.value)} placeholder="240"/>
              </ModalField>
              <ModalField lblSt={lblSt} label="EMI Day">
                <input style={inputSt} type="number" value={emiDay} onChange={e=>setEmiDay(e.target.value)} placeholder="5" min={1} max={31}/>
              </ModalField>
            </div>
            <ModalField lblSt={lblSt} label="Start Date">
              <input style={inputSt} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
            </ModalField>
            {computedEMI > 0 && (
              <div style={{ background:t.surface, borderRadius:12, padding:'14px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, color:t.text2 }}>Monthly EMI</span>
                  <span style={{ fontSize:18, fontWeight:800, color:DS.secondary, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(computedEMI,{noDecimals:true})}</span>
                </div>
                <div style={{ height:1, background:t.border }}/>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:t.text3 }}>Total Payable</span>
                  <span style={{ fontSize:13, fontWeight:700, color:t.text }}>{fmt(totalPayable,{noDecimals:true})}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:t.text3 }}>Total Interest</span>
                  <span style={{ fontSize:13, fontWeight:700, color:DS.warning }}>{fmt(totalInterest,{noDecimals:true})}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── GOLD LOAN fields (interest accrues monthly, no EMI) ── */}
        {goldLoan && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <ModalField lblSt={lblSt} label="Loan Amount (₹)">
                <input style={inputSt} type="number" value={loanAmount} onChange={e=>setLoanAmount(e.target.value)} placeholder="200000"/>
              </ModalField>
              <ModalField lblSt={lblSt} label="Interest Rate (% p.a.)">
                <input style={inputSt} type="number" value={rate} onChange={e=>setRate(e.target.value)} placeholder="12"/>
              </ModalField>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <ModalField lblSt={lblSt} label="Start Date">
                <input style={inputSt} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
              </ModalField>
              <ModalField lblSt={lblSt} label="Outstanding (₹)">
                <input style={inputSt} type="number" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="auto"/>
              </ModalField>
            </div>
            {parseFloat(loanAmount||0) > 0 && parseFloat(rate||0) > 0 && (
              <div style={{ background: isDark?'rgba(245,158,11,.1)':'#FFFBEB', border:`1px solid ${isDark?'rgba(245,158,11,.25)':'#FDE68A'}`, borderRadius:12, padding:'14px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:11.5, fontWeight:700, color:DS.warning, textTransform:'uppercase', letterSpacing:'.05em' }}>💰 Interest Accrual (no EMI)</div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color:t.text2 }}>Interest / month</span>
                  <span style={{ fontSize:15, fontWeight:800, color:DS.warning, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(monthlyInterest,{noDecimals:true})}</span>
                </div>
                {startDate && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:12, color:t.text3 }}>Accrued so far ({monthsElapsed} mo)</span>
                      <span style={{ fontSize:13, fontWeight:700, color:t.text }}>{fmt(accruedInterest,{noDecimals:true})}</span>
                    </div>
                    <div style={{ height:1, background:t.border }}/>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:t.text2 }}>Current Outstanding</span>
                      <span style={{ fontSize:16, fontWeight:800, color:DS.pink, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(projectedOutstanding,{noDecimals:true})}</span>
                    </div>
                  </>
                )}
                <div style={{ fontSize:11, color:t.text3, marginTop:2 }}>Balance grows each month by interest. Record payments to reduce it — you'll choose interest or principal.</div>
              </div>
            )}
          </>
        )}

        {/* ── EMI / BNPL fields ── */}
        {emi && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <ModalField lblSt={lblSt} label="Outstanding (₹)">
              <input style={inputSt} type="number" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="45000"/>
            </ModalField>
            <ModalField lblSt={lblSt} label="Monthly EMI (₹)">
              <input style={inputSt} type="number" value={emiManual} onChange={e=>setEmiManual(e.target.value)} placeholder="7500"/>
            </ModalField>
            <ModalField lblSt={lblSt} label="EMI Day">
              <input style={inputSt} type="number" value={emiDay} onChange={e=>setEmiDay(e.target.value)} placeholder="2" min={1} max={31}/>
            </ModalField>
          </div>
        )}

        {err && <div style={{ fontSize:13, color:DS.danger, fontWeight:600 }}>{err}</div>}

        <button onClick={save} disabled={busy}
          style={{ height:48, borderRadius:14, border:'none', fontSize:16, fontWeight:600, cursor:'pointer',
            background: liability ? 'linear-gradient(180deg,#EC4899,#BE185D)' : 'linear-gradient(180deg,#22C55E,#16A34A)', color:'#fff',
            boxShadow: liability ? '0 8px 24px rgba(236,72,153,.35)' : '0 8px 24px rgba(34,197,94,.35)', opacity:busy?.6:1 }}>
          {busy ? 'Saving…' : isEdit ? 'Save Changes' : (liability ? 'Add Liability' : 'Add Account')}
        </button>

        {isEdit && liability && onPay && (
          <button onClick={()=>onPay(wallet)} disabled={busy}
            style={{ height:48, borderRadius:14, fontSize:15, fontWeight:700, cursor:'pointer',
              background:'rgba(34,197,94,.1)', color:DS.primary, border:'1.5px solid rgba(34,197,94,.3)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            💵 Record Payment
          </button>
        )}

        {isEdit && (
          <button onClick={del} disabled={busy}
            style={{ height:48, borderRadius:14, fontSize:15, fontWeight:600, cursor:'pointer',
              background:'rgba(239,68,68,.08)', color:DS.danger, border:'1.5px solid rgba(239,68,68,.25)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <Trash2 size={16}/> Delete Account
          </button>
        )}
      </motion.div>
      </div>
    </>
  );
}

/* ═══ Liability payment modal — asks interest vs principal ═══════════════ */
function PaymentModal({ wallet, t, isDark, accounts, onClose, onSaved }) {
  const fmt = useFmt();
  const [amount, setAmount]   = useState('');
  const [applyTo, setApplyTo] = useState('interest');
  const [fromId, setFromId]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');

  const isGold = wallet.type === 'gold_loan';
  const isCard = M_CARD_TYPES.includes(wallet.type);
  const outstanding = Math.abs(parseFloat(wallet.balance||0));
  const newOutstanding = Math.max(0, outstanding - parseFloat(amount||0));

  const submit = async () => {
    if (!parseFloat(amount)) { setErr('Enter an amount'); return; }
    setBusy(true);
    try {
      await walletsAPI.pay(wallet.id, {
        amount: parseFloat(amount),
        apply_to: applyTo,
        from_wallet_id: fromId || null,
        note: `Payment to ${wallet.name}`,
      });
      onSaved();
    } catch(e) { setErr(e.response?.data?.message || 'Payment failed'); setBusy(false); }
  };

  const inputSt = { width:'100%', height:52, borderRadius:14, padding:'0 16px', boxSizing:'border-box', border:`1.5px solid ${t.border}`, background:t.surface, color:t.text, fontSize:15, outline:'none', fontFamily:'inherit' };
  const lblSt = { fontSize:12, fontWeight:700, color:t.text3, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6, display:'block' };

  const accountOpts = (accounts||[]).map(a => ({ value:a.id, label:a.name, emoji:(TYPE_META[a.type]?.e || '🏦'), sub: a.last_four ? `•••• ${a.last_four}` : undefined }));

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:400, backdropFilter:'blur(4px)' }}/>
      <div style={{ position:'fixed', inset:0, zIndex:401, display:'flex', alignItems:'center',
        justifyContent:'center', padding:16, pointerEvents:'none' }}>
      <motion.div initial={{ opacity:0, y:40, scale:.97 }} animate={{ opacity:1, y:0, scale:1 }} transition={spring}
        style={{ width:'min(440px, 100%)', background:t.cardBg, borderRadius:24, pointerEvents:'auto',
          border:`1px solid ${t.border}`, boxShadow:'0 30px 80px rgba(0,0,0,.3)', padding:20,
          display:'flex', flexDirection:'column', gap:16, maxHeight:'88vh', overflowY:'auto' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:t.text }}>Record Payment</div>
            <div style={{ fontSize:13, color:t.text2, marginTop:2 }}>{wallet.name} · Outstanding {fmt(outstanding,{noDecimals:true})}</div>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:12, background:t.surface, border:`1px solid ${t.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <X size={16} color={t.text2}/>
          </button>
        </div>

        <ModalField lblSt={lblSt} label="Amount (₹)">
          <input style={{ ...inputSt, fontSize:18, fontWeight:700 }} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="10000" autoFocus/>
        </ModalField>

        {/* Interest vs Principal — key ask */}
        {!isCard && (
          <div>
            <label style={lblSt}>Apply this payment to</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { key:'interest',  title:'Interest',  desc: isGold?'Clears accrued interest':'Interest portion' },
                { key:'principal', title:'Principal', desc:'Reduces future interest' },
              ].map(o => {
                const sel = applyTo === o.key;
                return (
                  <button key={o.key} onClick={()=>setApplyTo(o.key)}
                    style={{ textAlign:'left', padding:'12px 14px', borderRadius:14, cursor:'pointer',
                      border:`1.5px solid ${sel ? DS.secondary : t.border}`,
                      background: sel ? (isDark?'rgba(139,92,246,.14)':'#F5F3FF') : t.surface }}>
                    <div style={{ fontSize:14, fontWeight:700, color: sel ? (isDark?'#C4B5FD':DS.secondary) : t.text }}>{o.title}</div>
                    <div style={{ fontSize:11, color:t.text3, marginTop:2 }}>{o.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {accountOpts.length > 0 && (
          <ModalField lblSt={lblSt} label="Pay from (optional)">
            <ThemedSelect value={fromId} onChange={setFromId} options={[{ value:'', label:'Don’t deduct — just update loan', emoji:'—' }, ...accountOpts]} placeholder="Select account"/>
          </ModalField>
        )}

        {parseFloat(amount) > 0 && (
          <div style={{ background:t.surface, borderRadius:12, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:t.text2 }}>New Outstanding</span>
            <span style={{ fontSize:16, fontWeight:800, color:DS.primary, fontFamily:'Space Grotesk, Inter, sans-serif' }}>{fmt(newOutstanding,{noDecimals:true})}</span>
          </div>
        )}

        {err && <div style={{ fontSize:13, color:DS.danger, fontWeight:600 }}>{err}</div>}

        <button onClick={submit} disabled={busy}
          style={{ height:48, borderRadius:14, border:'none', fontSize:16, fontWeight:700, cursor:'pointer',
            background:'linear-gradient(180deg,#22C55E,#16A34A)', color:'#fff', boxShadow:'0 8px 24px rgba(34,197,94,.35)', opacity:busy?.6:1 }}>
          {busy ? 'Recording…' : 'Record Payment'}
        </button>
      </motion.div>
      </div>
    </>
  );
}
