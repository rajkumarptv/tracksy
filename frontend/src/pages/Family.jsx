import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { familyAPI } from '../services/api';
import { Topbar, PageLoader, EmptyState } from '../components/ui';
import { Users, TrendingUp, TrendingDown, Wallet, ChevronRight, X, Copy, Check, LogOut, UserPlus, Plus } from 'lucide-react';
import { useFmt, useT } from '../i18n';
import useAuthStore from '../store/authStore';
import usePremiumStore from '../store/premiumStore';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Family() {
  const fmt = useFmt();
  const { user } = useAuthStore();
  const { openPremium } = usePremiumStore();
  const qc = useQueryClient();
  const [activeMember, setActiveMember] = useState(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['family-status'],
    queryFn: () => familyAPI.status().then(r => r.data.data),
    retry: false,
  });

  const isPremium  = user?.is_premium || status?.is_premium;
  const inFamily   = status?.in_family;
  const isPrimary  = status?.role === 'primary';
  const sharedMode = status?.share_mode === 'shared';
  const canSeeOverview = inFamily && (isPrimary || sharedMode);

  // Overview fetched for primary, or any member in 'shared' mode
  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['family-overview'],
    queryFn: () => familyAPI.overview().then(r => r.data.data),
    enabled: !!isPremium && canSeeOverview,
    retry: false,
  });

  if (statusLoading) return <PageLoader />;

  /* ── 1. NOT PREMIUM → upgrade prompt ── */
  if (!isPremium) {
    return (
      <Shell>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
          <div style={{ textAlign:'center', maxWidth:440 }}>
            <div style={{ fontSize:56, marginBottom:16 }}>👨‍👩‍👧</div>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--text)', marginBottom:10 }}>Family Budget</div>
            <div style={{ fontSize:14, color:'var(--text3)', marginBottom:8, lineHeight:1.6 }}>
              Create a private family space and invite members with a code. See everyone's
              income, spending and balances in one combined view.
            </div>
            <div style={{ fontSize:12.5, color:'var(--text3)', marginBottom:24, background:'var(--surface2)', borderRadius:10, padding:'10px 14px' }}>
              🔒 Members join only with your code — nobody's data is shared without consent.
            </div>
            <button onClick={openPremium}
              style={{ padding:'12px 28px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#F59E0B,#FF79A8)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', boxShadow:'0 4px 16px rgba(245,158,11,.4)' }}>
              ✨ Upgrade to Premium
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ── 2. PREMIUM, NOT IN FAMILY → create or join ── */
  if (!inFamily) {
    return <SetupFamily qc={qc} />;
  }

  /* ── 3. head_only MEMBER (not primary, not shared) → own status + leave ── */
  if (!canSeeOverview) {
    return <MemberView status={status} qc={qc} />;
  }

  /* ── 4. PRIMARY, or SHARED-mode member → full overview ── */
  if (ovLoading || !overview) return <PageLoader />;
  const { family, members, combined, period } = overview;
  const monthLabel = `${MONTHS[period.month - 1]} ${period.year}`;

  return (
    <Shell title={`👨‍👩‍👧 ${family.name}`} subtitle={`Family overview · ${monthLabel}`} mobileTitle={family.name} mobileSub={`Family · ${monthLabel}`}>
      <div className="mob-content" style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>

        {/* Shared-mode badge */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:7, marginBottom:16, padding:'5px 12px', borderRadius:20, fontSize:11.5, fontWeight:700,
          background: sharedMode ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)', color: sharedMode ? '#22C55E' : '#F59E0B' }}>
          {sharedMode ? '🤝 Shared — everyone sees everyone' : '👑 Head-only — only you see members'}
        </div>

        {/* Invite code banner — primary only */}
        {isPrimary
          ? <InviteCodeBar code={family.family_code} qc={qc} />
          : <SharedMemberBar familyName={family.name} qc={qc} />
        }

        {/* Combined totals */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { label:'Family Income',  value: fmt(combined.income),          sub:'This month',                                    icon:<TrendingUp size={20} color="#00C896"/>,   bg:'rgba(0,200,150,.12)',  color:'#00C896', border:'rgba(0,200,150,.2)'  },
            { label:'Family Expense', value: fmt(combined.expense),         sub:'This month',                                    icon:<TrendingDown size={20} color="#EC4899"/>, bg:'rgba(236,72,153,.12)',  color:'#EC4899', border:'rgba(236,72,153,.2)'  },
            { label: combined.net >= 0 ? 'Net Saved' : 'Over Budget', value: fmt(Math.abs(combined.net)), sub: combined.net >= 0 ? 'Positive' : 'Deficit', icon:<Wallet size={20} color="#8B5CF6"/>, bg:'rgba(139,92,246,.12)', color: combined.net >= 0 ? '#00C896' : '#EC4899', border: combined.net >= 0 ? 'rgba(0,200,150,.2)' : 'rgba(236,72,153,.2)' },
            { label:'Total Net Worth', value: fmt(combined.net_balance),    sub:'All accounts',                                  icon:<Users size={20} color="#3B82F6"/>,        bg:'rgba(59,130,246,.12)', color:'#3B82F6', border:'rgba(59,130,246,.2)' },
          ].map(({ label, value, sub, icon, bg, color, border }) => (
            <div key={label} style={{
              background:'var(--surface)', borderRadius:18, padding:'18px 16px',
              boxShadow:'0 2px 16px rgba(139,92,246,.07)', border:`1px solid ${border}`,
              display:'flex', flexDirection:'column', alignItems:'flex-start',
            }}>
              <div style={{ width:40, height:40, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginBottom:12 }}>{icon}</div>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4, whiteSpace:'nowrap' }}>{label}</div>
              <div className="mono" style={{ fontSize:20, fontWeight:900, color, letterSpacing:-0.5, lineHeight:1.1, marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>{value}</div>
              <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, whiteSpace:'nowrap' }}>{sub}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:13, fontWeight:700, color:'var(--text2)', marginBottom:12 }}>
          Family Members ({members.length})
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
          {members.map(m => (
            <div key={m.id} onClick={() => m.is_me ? null : setActiveMember(m.id)}
              style={{ background:'var(--surface)', borderRadius:18, padding:'18px 20px', border:'1px solid var(--border-light)', boxShadow:'0 4px 20px rgba(139,92,246,.06)', cursor: m.is_me ? 'default' : 'pointer', transition:'transform .2s' }}
              onMouseEnter={e => { if(!m.is_me) e.currentTarget.style.transform='translateY(-3px)'; }}
              onMouseLeave={e => e.currentTarget.style.transform=''}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#8B5CF6,#a29bfe)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff', flexShrink:0 }}>
                  {m.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {m.name}{m.is_me ? ' (You)' : ''}
                  </div>
                  <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:20, background: m.role==='primary' ? 'rgba(245,158,11,.15)' : 'rgba(139,92,246,.12)', color: m.role==='primary' ? '#F59E0B' : 'var(--accent)' }}>
                    {m.role === 'primary' ? '👑 Head' : 'Member'}
                  </span>
                </div>
                {!m.is_me && <ChevronRight size={18} color="var(--text3)"/>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { l:'Income',    v:fmt(m.income),  c:'#22C55E' },
                  { l:'Expense',   v:fmt(m.expense), c:'#EC4899' },
                  { l:'Net',       v:`${m.net>=0?'+':''}${fmt(m.net)}`, c: m.net>=0?'#22C55E':'#EC4899' },
                  { l:'Net Worth', v:fmt(m.net_balance), c:'var(--text)' },
                ].map(s => (
                  <div key={s.l} style={{ background:'var(--surface2)', borderRadius:10, padding:'9px 11px' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:2 }}>{s.l}</div>
                    <div className="mono" style={{ fontSize:13.5, fontWeight:800, color:s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeMember && (
        <MemberDetailModal memberId={activeMember} onClose={() => setActiveMember(null)} fmt={fmt} qc={qc} canRemove={isPrimary} />
      )}
    </Shell>
  );
}

/* ── Bar shown to a shared-mode member (no code, just leave) ── */
function SharedMemberBar({ familyName, qc }) {
  const leaveMut = useMutation({
    mutationFn: () => familyAPI.leave(),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['family-status'] }); qc.invalidateQueries({ queryKey:['family-overview'] }); },
  });
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', background:'var(--surface)', borderRadius:14, padding:'14px 18px', marginBottom:20, border:'1px solid var(--border-light)' }}>
      <div style={{ fontSize:13, color:'var(--text3)' }}>
        You're a member of <strong style={{ color:'var(--text)' }}>{familyName}</strong>. Everyone here can see each other's finances.
      </div>
      <button onClick={() => { if(confirm('Leave this family? You will no longer see shared data and others won’t see yours.')) leaveMut.mutate(); }}
        style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'1.5px solid rgba(236,72,153,.3)', background:'var(--red-light)', color:'#EC4899', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
        <LogOut size={13}/> Leave
      </button>
    </div>
  );
}

/* ── Layout shell ── */
function Shell({ children, title='Family Budget', subtitle="Manage your family's finances", mobileTitle='Family Budget', mobileSub='' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div className="mob-header">
        <div>
          <div className="mob-header-title">{mobileTitle}</div>
          {mobileSub && <div className="mob-header-sub">{mobileSub}</div>}
        </div>
      </div>
      <div className="mob-hide"><Topbar title={title} subtitle={subtitle}/></div>
      {children}
    </div>
  );
}

/* ── Invite code bar (primary) ── */
function InviteCodeBar({ code, qc }) {
  const [copied, setCopied] = useState(false);
  const leaveMut = useMutation({
    mutationFn: () => familyAPI.leave(),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['family-status'] }); qc.invalidateQueries({ queryKey:['family-overview'] }); },
  });
  const copy = () => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(()=>setCopied(false), 1500); };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', background:'var(--surface)', borderRadius:14, padding:'14px 18px', marginBottom:20, border:'1px solid var(--border-light)' }}>
      <div style={{ fontSize:13, color:'var(--text3)' }}>
        <strong style={{ color:'var(--text)' }}>Invite code:</strong> share this so family can join
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--accent-light)', borderRadius:10, padding:'7px 14px' }}>
        <span className="mono" style={{ fontSize:18, fontWeight:800, letterSpacing:3, color:'var(--accent)' }}>{code}</span>
        <button onClick={copy} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', display:'flex' }}>
          {copied ? <Check size={16}/> : <Copy size={16}/>}
        </button>
      </div>
      <button onClick={() => { if(confirm('Disband this family? All members will be removed.')) leaveMut.mutate(); }}
        style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, border:'1.5px solid rgba(236,72,153,.3)', background:'var(--red-light)', color:'#EC4899', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
        <LogOut size={13}/> Disband
      </button>
    </div>
  );
}

/* ── Create or Join (premium, no family yet) ── */
function SetupFamily({ qc }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [shareMode, setShareMode] = useState('shared'); // default to shared (couples)
  const [err, setErr]   = useState('');

  const refresh = () => { qc.invalidateQueries({ queryKey:['family-status'] }); qc.invalidateQueries({ queryKey:['family-overview'] }); };
  const createMut = useMutation({
    mutationFn: () => familyAPI.create(name, shareMode),
    onSuccess: refresh,
    onError: e => setErr(e.response?.data?.message || 'Failed to create family'),
  });
  const joinMut = useMutation({
    mutationFn: () => familyAPI.join(code),
    onSuccess: refresh,
    onError: e => setErr(e.response?.data?.message || 'Failed to join family'),
  });

  return (
    <Shell>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ width:'100%', maxWidth:440 }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>👨‍👩‍👧</div>
            <div style={{ fontSize:21, fontWeight:800, color:'var(--text)', marginBottom:6 }}>Set up Family Budget</div>
            <div style={{ fontSize:13.5, color:'var(--text3)' }}>Start a family as head, or join one with a code.</div>
          </div>

          {err && <div style={{ background:'var(--red-light)', color:'#EC4899', padding:'10px 14px', borderRadius:10, marginBottom:16, fontSize:13 }}>⚠️ {err}</div>}

          {/* Choice cards */}
          {!mode && (
            <div style={{ display:'grid', gap:12 }}>
              <button onClick={() => { setMode('create'); setErr(''); }}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 20px', borderRadius:16, border:'1.5px solid var(--border)', background:'var(--surface)', cursor:'pointer', textAlign:'left' }}>
                <div style={{ width:46, height:46, borderRadius:13, background:'rgba(139,92,246,.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Plus size={22} color="#8B5CF6"/>
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>Create a family</div>
                  <div style={{ fontSize:12.5, color:'var(--text3)' }}>You become the head & get an invite code</div>
                </div>
              </button>
              <button onClick={() => { setMode('join'); setErr(''); }}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 20px', borderRadius:16, border:'1.5px solid var(--border)', background:'var(--surface)', cursor:'pointer', textAlign:'left' }}>
                <div style={{ width:46, height:46, borderRadius:13, background:'rgba(34,197,94,.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <UserPlus size={22} color="#22C55E"/>
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>Join a family</div>
                  <div style={{ fontSize:12.5, color:'var(--text3)' }}>Enter the code from your family head</div>
                </div>
              </button>
            </div>
          )}

          {/* Create form */}
          {mode === 'create' && (
            <div style={{ background:'var(--surface)', borderRadius:16, padding:'20px', border:'1px solid var(--border-light)' }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:8 }}>Family Name</label>
              <input autoFocus value={name} onChange={e=>{setName(e.target.value);setErr('');}} placeholder="e.g. The Kumar Family"
                onKeyDown={e=>e.key==='Enter'&&name.trim()&&createMut.mutate()}
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:16 }}/>

              {/* Visibility mode */}
              <label style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:8 }}>Who can see what?</label>
              <div style={{ display:'grid', gap:8, marginBottom:16 }}>
                {[
                  { id:'shared',    icon:'🤝', title:'Shared (for couples)', desc:'Everyone sees everyone\'s transactions & dashboards' },
                  { id:'head_only', icon:'👑', title:'Head-only (for parents)', desc:'Only you see members; they see only themselves' },
                ].map(opt => (
                  <button key={opt.id} type="button" onClick={() => setShareMode(opt.id)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12, cursor:'pointer', textAlign:'left',
                      border: shareMode===opt.id ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                      background: shareMode===opt.id ? 'var(--accent-light)' : 'var(--surface2)' }}>
                    <span style={{ fontSize:22 }}>{opt.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13.5, fontWeight:700, color: shareMode===opt.id ? 'var(--accent)' : 'var(--text)' }}>{opt.title}</div>
                      <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:1 }}>{opt.desc}</div>
                    </div>
                    {shareMode===opt.id && <Check size={16} color="var(--accent)"/>}
                  </button>
                ))}
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>{setMode(null);setErr('');}} style={{ flex:1, padding:'11px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text3)', fontWeight:600, fontSize:14, cursor:'pointer' }}>Back</button>
                <button onClick={()=>createMut.mutate()} disabled={!name.trim()||createMut.isPending}
                  style={{ flex:2, padding:'11px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#8B5CF6,#3B82F6)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity:(!name.trim())?.6:1 }}>
                  {createMut.isPending ? 'Creating…' : 'Create Family'}
                </button>
              </div>
            </div>
          )}

          {/* Join form */}
          {mode === 'join' && (
            <div style={{ background:'var(--surface)', borderRadius:16, padding:'20px', border:'1px solid var(--border-light)' }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:8 }}>Family Code</label>
              <input autoFocus value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setErr('');}} placeholder="ABC123" maxLength={6}
                onKeyDown={e=>e.key==='Enter'&&code.trim()&&joinMut.mutate()}
                style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:20, fontWeight:800, letterSpacing:4, textAlign:'center', outline:'none', boxSizing:'border-box', marginBottom:12, fontFamily:'monospace' }}/>
              <div style={{ fontSize:12, color:'var(--text3)', background:'rgba(245,158,11,.08)', borderRadius:9, padding:'9px 12px', marginBottom:16 }}>
                ⚠️ By joining, the family head will be able to see your accounts and spending.
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>{setMode(null);setErr('');}} style={{ flex:1, padding:'11px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text3)', fontWeight:600, fontSize:14, cursor:'pointer' }}>Back</button>
                <button onClick={()=>joinMut.mutate()} disabled={!code.trim()||joinMut.isPending}
                  style={{ flex:2, padding:'11px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#22C55E,#00b894)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity:(!code.trim())?.6:1 }}>
                  {joinMut.isPending ? 'Joining…' : 'Join Family'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ── Member view (joined, not primary) ── */
function MemberView({ status, qc }) {
  const leaveMut = useMutation({
    mutationFn: () => familyAPI.leave(),
    onSuccess: () => qc.invalidateQueries({ queryKey:['family-status'] }),
  });
  const head = status.members?.find(m => m.family_role === 'primary');

  return (
    <Shell mobileTitle={status.family_name} mobileSub="You're a family member">
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ width:'100%', maxWidth:440, textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>👨‍👩‍👧</div>
          <div style={{ fontSize:21, fontWeight:800, color:'var(--text)', marginBottom:6 }}>{status.family_name}</div>
          <div style={{ fontSize:13.5, color:'var(--text3)', marginBottom:20 }}>
            You're a member of this family.{head ? ` ${head.name} (head) can see your accounts and spending.` : ''}
          </div>
          <div style={{ background:'var(--surface)', borderRadius:14, padding:'16px 20px', border:'1px solid var(--border-light)', marginBottom:20, textAlign:'left' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Members</div>
            {status.members?.map(m => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0' }}>
                <span style={{ fontSize:13.5, color:'var(--text)', fontWeight:600 }}>{m.name}{m.is_me?' (You)':''}</span>
                <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:20, background: m.family_role==='primary'?'rgba(245,158,11,.15)':'rgba(139,92,246,.12)', color: m.family_role==='primary'?'#F59E0B':'var(--accent)' }}>
                  {m.family_role==='primary'?'👑 Head':'Member'}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => { if(confirm('Leave this family? The head will no longer see your data.')) leaveMut.mutate(); }}
            style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 24px', borderRadius:12, border:'1.5px solid rgba(236,72,153,.3)', background:'var(--red-light)', color:'#EC4899', fontWeight:700, fontSize:14, cursor:'pointer' }}>
            <LogOut size={15}/> Leave Family
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* ── Member detail modal (primary clicks a member) ── */
function MemberDetailModal({ memberId, onClose, fmt, qc, canRemove }) {
  const { data, isLoading } = useQuery({
    queryKey: ['family-member', memberId],
    queryFn: () => familyAPI.memberDetail(memberId).then(r => r.data.data),
  });
  const removeMut = useMutation({
    mutationFn: () => familyAPI.removeMember(memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['family-overview'] }); qc.invalidateQueries({ queryKey:['family-status'] }); onClose(); },
  });

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:540, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div className="modal-title" style={{ margin:0, flex:1 }}>{isLoading ? 'Loading…' : data?.member.name}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}><X size={20}/></button>
        </div>

        {isLoading ? <PageLoader /> : (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Accounts ({data.wallets.length})</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {data.wallets.map(w => (
                <div key={w.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:10, background:'var(--surface2)' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{w.name}{w.last_four?` ••${w.last_four}`:''}</span>
                  <span className="mono" style={{ fontSize:13.5, fontWeight:800, color: parseFloat(w.balance)>=0?'var(--text)':'#EC4899' }}>{fmt(w.balance)}</span>
                </div>
              ))}
              {!data.wallets.length && <div style={{ fontSize:13, color:'var(--text3)', padding:'8px 0' }}>No accounts yet.</div>}
            </div>

            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Recent Transactions</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:18 }}>
              {data.recent_transactions.map(tx => (
                <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, background:'var(--surface2)' }}>
                  <span style={{ fontSize:15 }}>{tx.category_emoji || '💸'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.description || tx.payment_name}</div>
                    <div style={{ fontSize:10.5, color:'var(--text3)' }}>{new Date(tx.transaction_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {tx.category_name || 'Uncategorized'}</div>
                  </div>
                  <span className="mono" style={{ fontSize:13, fontWeight:800, color: tx.type==='income'?'#22C55E':'#EC4899' }}>
                    {tx.type==='income'?'+':'−'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
              {!data.recent_transactions.length && <div style={{ fontSize:13, color:'var(--text3)', padding:'8px 0' }}>No transactions yet.</div>}
            </div>

            {canRemove && (
              <button onClick={() => { if(confirm('Remove this member from the family?')) removeMut.mutate(); }}
                style={{ width:'100%', padding:'10px', borderRadius:10, border:'1.5px solid rgba(236,72,153,.3)', background:'var(--red-light)', color:'#EC4899', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Remove from family
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
