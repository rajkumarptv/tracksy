import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { familyAPI } from '../services/api';
import { Topbar, PageLoader, EmptyState } from '../components/ui';
import { Users, TrendingUp, TrendingDown, Wallet, ChevronRight, X } from 'lucide-react';
import { useFmt, useT } from '../i18n';
import useAuthStore from '../store/authStore';
import usePremiumStore from '../store/premiumStore';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Family() {
  const fmt = useFmt();
  const t = useT();
  const { user } = useAuthStore();
  const { openPremium } = usePremiumStore();
  const [activeMember, setActiveMember] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['family-overview'],
    queryFn: () => familyAPI.overview().then(r => r.data.data),
    retry: false,
  });

  if (isLoading) return <PageLoader />;

  // Premium gate
  if (!user?.is_premium) {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <Topbar title="Family Budget" subtitle="Manage your whole family's finances"/>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
          <div style={{ textAlign:'center', maxWidth:420 }}>
            <div style={{ fontSize:56, marginBottom:16 }}>👨‍👩‍👧</div>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--text)', marginBottom:8 }}>Family Budget is Premium</div>
            <div style={{ fontSize:14, color:'var(--text3)', marginBottom:24, lineHeight:1.6 }}>
              See every family member's income, spending, and balances in one place. Upgrade to unlock.
            </div>
            <button onClick={openPremium}
              style={{ padding:'12px 28px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#FFB84D,#FF79A8)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:'0 4px 16px rgba(255,184,77,.4)' }}>
              ✨ Upgrade to Premium
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not a primary member (or no family assigned)
  if (error || !data) {
    const msg = error?.response?.data?.code === 'NOT_PRIMARY'
      ? "You're part of a family, but only the primary member can view the family overview."
      : "You're not set up in a family yet. Ask the admin to add you to a family.";
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <Topbar title="Family Budget" subtitle="Manage your whole family's finances"/>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
          <EmptyState icon="👨‍👩‍👧" title="No family overview" description={msg}/>
        </div>
      </div>
    );
  }

  const { family, members, combined, period } = data;
  const monthLabel = `${MONTHS[period.month - 1]} ${period.year}`;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Mobile header */}
      <div className="mob-header">
        <div>
          <div className="mob-header-title">{family.name}</div>
          <div className="mob-header-sub">Family Budget · {monthLabel}</div>
        </div>
      </div>
      {/* Desktop topbar */}
      <div className="mob-hide">
        <Topbar title={`👨‍👩‍👧 ${family.name}`} subtitle={`Family Budget overview · ${monthLabel}`}/>
      </div>

      <div className="mob-content" style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>

        {/* Combined totals */}
        <div className="mob-summary-scroll" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
          {[
            { label:'Family Income',  value: fmt(combined.income),  icon:<TrendingUp size={20} color="#37D67A"/>, bg:'rgba(55,214,122,.1)', color:'#37D67A' },
            { label:'Family Expense', value: fmt(combined.expense), icon:<TrendingDown size={20} color="#FF5B5B"/>, bg:'rgba(255,91,91,.1)', color:'#FF5B5B' },
            { label: combined.net >= 0 ? 'Net Saved' : 'Over Budget', value: fmt(Math.abs(combined.net)), icon:<Wallet size={20} color="#6C63FF"/>, bg:'rgba(108,99,255,.1)', color: combined.net >= 0 ? '#37D67A' : '#FF5B5B' },
            { label:'Total Net Worth', value: fmt(combined.net_balance), icon:<Users size={20} color="#5B8CFF"/>, bg:'rgba(91,140,255,.1)', color:'#5B8CFF' },
          ].map(({ label, value, icon, bg, color }) => (
            <div key={label} style={{ background:'var(--surface)', borderRadius:18, padding:'16px 18px', boxShadow:'0 4px 20px rgba(108,99,255,.08)', border:'1px solid var(--border-light)', display:'flex', alignItems:'center', gap:13 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:3 }}>{label}</div>
                <div className="mono" style={{ fontSize:16, fontWeight:800, color }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Member cards */}
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text2)', marginBottom:12 }}>
          Family Members ({members.length})
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
          {members.map(m => (
            <div key={m.id} onClick={() => setActiveMember(m.id)}
              style={{ background:'var(--surface)', borderRadius:18, padding:'18px 20px', border:'1px solid var(--border-light)', boxShadow:'0 4px 20px rgba(108,99,255,.06)', cursor:'pointer', transition:'transform .2s' }}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform=''}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#6C63FF,#a29bfe)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff', flexShrink:0 }}>
                  {m.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {m.name}{m.is_me ? ' (You)' : ''}
                  </div>
                  <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:20, background: m.role==='primary' ? 'rgba(255,184,77,.15)' : 'rgba(108,99,255,.12)', color: m.role==='primary' ? '#FFB84D' : 'var(--accent)' }}>
                    {m.role === 'primary' ? '👑 Primary' : 'Member'}
                  </span>
                </div>
                <ChevronRight size={18} color="var(--text3)"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ background:'var(--surface2)', borderRadius:10, padding:'9px 11px' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Income</div>
                  <div className="mono" style={{ fontSize:13.5, fontWeight:800, color:'#37D67A' }}>{fmt(m.income)}</div>
                </div>
                <div style={{ background:'var(--surface2)', borderRadius:10, padding:'9px 11px' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Expense</div>
                  <div className="mono" style={{ fontSize:13.5, fontWeight:800, color:'#FF5B5B' }}>{fmt(m.expense)}</div>
                </div>
                <div style={{ background:'var(--surface2)', borderRadius:10, padding:'9px 11px' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Net</div>
                  <div className="mono" style={{ fontSize:13.5, fontWeight:800, color: m.net>=0?'#37D67A':'#FF5B5B' }}>{m.net>=0?'+':''}{fmt(m.net)}</div>
                </div>
                <div style={{ background:'var(--surface2)', borderRadius:10, padding:'9px 11px' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>Net Worth</div>
                  <div className="mono" style={{ fontSize:13.5, fontWeight:800, color:'var(--text)' }}>{fmt(m.net_balance)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeMember && (
        <MemberDetailModal memberId={activeMember} onClose={() => setActiveMember(null)} fmt={fmt}/>
      )}
    </div>
  );
}

function MemberDetailModal({ memberId, onClose, fmt }) {
  const { data, isLoading } = useQuery({
    queryKey: ['family-member', memberId],
    queryFn: () => familyAPI.memberDetail(memberId).then(r => r.data.data),
  });

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:540, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div className="modal-title" style={{ margin:0, flex:1 }}>
            {isLoading ? 'Loading…' : data?.member.name}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}><X size={20}/></button>
        </div>

        {isLoading ? <PageLoader /> : (
          <>
            {/* Accounts */}
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Accounts ({data.wallets.length})</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {data.wallets.map(w => (
                <div key={w.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:10, background:'var(--surface2)' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{w.name}{w.last_four?` ••${w.last_four}`:''}</span>
                  <span className="mono" style={{ fontSize:13.5, fontWeight:800, color: parseFloat(w.balance)>=0?'var(--text)':'#FF5B5B' }}>{fmt(w.balance)}</span>
                </div>
              ))}
              {!data.wallets.length && <div style={{ fontSize:13, color:'var(--text3)', padding:'8px 0' }}>No accounts yet.</div>}
            </div>

            {/* Recent transactions */}
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Recent Transactions</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {data.recent_transactions.map(tx => (
                <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, background:'var(--surface2)' }}>
                  <span style={{ fontSize:15 }}>{tx.category_emoji || '💸'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.description || tx.payment_name}</div>
                    <div style={{ fontSize:10.5, color:'var(--text3)' }}>{new Date(tx.transaction_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {tx.category_name || 'Uncategorized'}</div>
                  </div>
                  <span className="mono" style={{ fontSize:13, fontWeight:800, color: tx.type==='income'?'#37D67A':'#FF5B5B' }}>
                    {tx.type==='income'?'+':'−'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
              {!data.recent_transactions.length && <div style={{ fontSize:13, color:'var(--text3)', padding:'8px 0' }}>No transactions yet.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
