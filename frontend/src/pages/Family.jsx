import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, ChevronRight, X, Copy, Check, LogOut, UserPlus, Plus,
} from 'lucide-react';
import { familyAPI } from '../services/api';
import { track } from '../lib/analytics';
import { PageLoader } from '../components/ui';
import { useFmt } from '../i18n';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { THEME } from '../theme';
import styles from './Budget.module.css';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ── Palette — derived from the shared dashboard theme (same as Budget/Accounts) ── */
const DS = {
  light: {
    ...THEME.light,
    card: THEME.light.cardBg, shadow: THEME.light.cardShadow,
    overviewBg: THEME.light.flowBg, overviewBorder: THEME.light.flowBorder,
  },
  dark: {
    ...THEME.dark,
    card: THEME.dark.cardBg, shadow: THEME.dark.cardShadow,
    overviewBg: THEME.dark.flowBg, overviewBorder: THEME.dark.flowBorder,
  },
  purple:'#1D4ED8', green:'#047857', pink:'#DC2626', orange:'#D97706', blue:'#3B82F6', danger:'#EF4444',
};

const spring = { type:'spring', stiffness:280, damping:28 };
const containerVar = { hidden:{}, show:{ transition:{ staggerChildren:.07 } } };
const cardVar = { hidden:{ opacity:0, y:22 }, show:{ opacity:1, y:0, transition:spring } };

function usePalette() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  return { t: isDark ? DS.dark : DS.light, isDark };
}

/* ── Themed page shell with header ── */
function Page({ t, title, subtitle, actions, children }) {
  return (
    <div className={styles.page} style={{ background:t.bg }}>
      <motion.div className={styles.inner} variants={containerVar} initial="hidden" animate="show">
        <motion.div className={styles.header} variants={cardVar}>
          <div>
            <h1 className={styles.h1} style={{ color:t.text }}>{title}</h1>
            <div className={styles.sub} style={{ color:t.text2 }}>{subtitle}</div>
          </div>
          {actions && <div className={styles.headerBtns}>{actions}</div>}
        </motion.div>
        {children}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function Family() {
  const fmt = useFmt();
  const { t } = usePalette();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [activeMember, setActiveMember] = useState(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['family-status'],
    queryFn: () => familyAPI.status().then(r => r.data.data),
    retry: false,
  });

  const inFamily   = status?.in_family;
  const isPrimary  = status?.role === 'primary';
  const sharedMode = status?.share_mode === 'shared';
  const canSeeOverview = inFamily && (isPrimary || sharedMode);

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['family-overview'],
    queryFn: () => familyAPI.overview().then(r => r.data.data),
    enabled: !!canSeeOverview,
    retry: false,
  });

  if (statusLoading) return <PageLoader />;

  /* ── 1. NOT IN A FAMILY → create or join ── */
  if (!inFamily) return <SetupFamily qc={qc} />;

  /* ── 3. head_only MEMBER (not primary, not shared) → own status + leave ── */
  if (!canSeeOverview) return <MemberView status={status} qc={qc} />;

  /* ── 4. PRIMARY, or SHARED-mode member → full overview ── */
  if (ovLoading || !overview) return <PageLoader />;
  const { family, members, combined, period } = overview;
  const monthLabel = `${MONTHS[period.month - 1]} ${period.year}`;
  const netWorth = parseFloat(combined.net_balance || 0);
  const nwNeg = netWorth < 0;

  return (
    <Page t={t} title={family.name} subtitle={`Family overview · ${monthLabel}`}>

      {/* Mode badge */}
      <motion.div variants={cardVar}
        style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 13px', borderRadius:14, fontSize:12, fontWeight:700, width:'fit-content',
          background: sharedMode ? 'rgba(4,120,87,.12)' : 'rgba(217,119,6,.12)', color: sharedMode ? DS.green : DS.orange }}>
        {sharedMode ? '🤝 Shared — everyone sees everyone' : '👑 Head-only — only you see members'}
      </motion.div>

      {/* Invite / member bar */}
      {isPrimary
        ? <InviteCodeBar code={family.family_code} qc={qc} t={t} />
        : <SharedMemberBar familyName={family.name} qc={qc} t={t} />}

      {/* ── Overview hero card ── */}
      <motion.div className={styles.overview} variants={cardVar}
        style={{ background:t.overviewBg, border:t.overviewBorder, boxShadow:t.glowShadow }}>
        <div className={styles.overviewHead}>
          <span style={{ fontSize:13.5, fontWeight:700, color:t.text2, display:'flex', alignItems:'center', gap:7 }}>
            <Users size={16} color={DS.purple}/> Combined · {monthLabel}
          </span>
        </div>
        <div className={styles.overviewBody}>
          <div className={styles.overviewLeft}>
            <div style={{ fontSize:13.5, color:t.text2 }}>Total Net Worth</div>
            <div className={styles.bigAmount} style={{ color: nwNeg ? DS.danger : t.text }}>
              {nwNeg && '−'}{fmt(Math.abs(netWorth),{noDecimals:true})}
            </div>
            <div style={{ fontSize:12.5, color:t.text2, marginTop:6 }}>Across {members.length} member{members.length!==1?'s':''}</div>
          </div>
          <div className={styles.overviewRight}>
            <div className={styles.statRow}>
              <span className={styles.dot} style={{ background:DS.green }}/>
              <span style={{ flex:1, fontSize:13.5, color:t.text2 }}>Family Income</span>
              <span style={{ fontSize:14.5, fontWeight:800, color:DS.green, fontFamily:'Inter, sans-serif' }}>{fmt(combined.income,{noDecimals:true})}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.dot} style={{ background:DS.pink }}/>
              <span style={{ flex:1, fontSize:13.5, color:t.text2 }}>Family Expense</span>
              <span style={{ fontSize:14.5, fontWeight:800, color:DS.pink, fontFamily:'Inter, sans-serif' }}>{fmt(combined.expense,{noDecimals:true})}</span>
            </div>
            <div style={{ height:1, background:t.border, margin:'10px 0' }}/>
            <div className={styles.statRow}>
              <span style={{ flex:1, fontSize:13.5, color:t.text2 }}>{combined.net >= 0 ? 'Net Saved' : 'Over Budget'}</span>
              <span style={{ fontSize:14.5, fontWeight:800, color: combined.net>=0?DS.green:DS.danger, fontFamily:'Inter, sans-serif' }}>
                {combined.net<0 && '−'}{fmt(Math.abs(combined.net),{noDecimals:true})}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Members ── */}
      <motion.div className={styles.card} variants={cardVar}
        style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle} style={{ color:t.text }}>Family Members ({members.length})</span>
        </div>
        <div style={{ display:'grid', gap:12 }}>
          {members.map((m,i) => {
            const mNet = parseFloat(m.net||0);
            return (
              <motion.div key={m.id} onClick={() => m.is_me ? null : setActiveMember(m.id)}
                initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} transition={{ delay:.2+i*.06 }}
                whileHover={m.is_me ? {} : { y:-2 }}
                style={{ background:t.surface, borderRadius:16, padding:'16px', border:`1px solid ${t.border}`, cursor: m.is_me ? 'default':'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:'#1D4ED8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff', flexShrink:0 }}>
                    {m.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14.5, fontWeight:700, color:t.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {m.name}{m.is_me ? ' (You)' : ''}
                    </div>
                    <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:14, display:'inline-block', marginTop:3,
                      background: m.role==='primary' ? 'rgba(217,119,6,.15)' : 'rgba(29,78,216,.12)', color: m.role==='primary' ? DS.orange : DS.purple }}>
                      {m.role === 'primary' ? '👑 Head' : 'Member'}
                    </span>
                  </div>
                  {!m.is_me && <ChevronRight size={18} color={t.text3}/>}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { l:'Income',    v:fmt(m.income,{noDecimals:true}),  c:DS.green },
                    { l:'Expense',   v:fmt(m.expense,{noDecimals:true}), c:DS.pink },
                    { l:'Net',       v:`${mNet<0?'−':mNet>0?'+':''}${fmt(Math.abs(mNet),{noDecimals:true})}`, c: mNet>=0?DS.green:DS.danger },
                    { l:'Net Worth', v:fmt(m.net_balance,{noDecimals:true}), c:t.text },
                  ].map(s => (
                    <div key={s.l} style={{ background:t.card, borderRadius:11, padding:'9px 11px', border:`1px solid ${t.border}` }}>
                      <div style={{ fontSize:10, color:t.text3, fontWeight:600, marginBottom:2 }}>{s.l}</div>
                      <div style={{ fontSize:13.5, fontWeight:800, color:s.c, fontFamily:'Inter, sans-serif' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {activeMember && (
        <MemberDetailModal memberId={activeMember} onClose={() => setActiveMember(null)} fmt={fmt} qc={qc} canRemove={isPrimary} t={t} />
      )}
    </Page>
  );
}

/* ── Bar shown to a shared-mode member (no code, just leave) ── */
function SharedMemberBar({ familyName, qc, t }) {
  const leaveMut = useMutation({
    mutationFn: () => familyAPI.leave().then(r => { track('family_left'); return r; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['family-status'] }); qc.invalidateQueries({ queryKey:['family-overview'] }); },
  });
  return (
    <motion.div variants={cardVar} className={styles.card}
      style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
      <div style={{ fontSize:13, color:t.text2, flex:1, minWidth:180 }}>
        You're a member of <strong style={{ color:t.text }}>{familyName}</strong>. Everyone here can see each other's finances.
      </div>
      <button onClick={() => { if(confirm('Leave this family? You will no longer see shared data and others won’t see yours.')) leaveMut.mutate(); }}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 15px', borderRadius:11, border:'1.5px solid rgba(220,38,38,.3)', background:'rgba(220,38,38,.08)', color:DS.pink, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
        <LogOut size={13}/> Leave
      </button>
    </motion.div>
  );
}

/* ── Invite code bar (primary) ── */
function InviteCodeBar({ code, qc, t }) {
  const [copied, setCopied] = useState(false);
  const leaveMut = useMutation({
    mutationFn: () => familyAPI.leave().then(r => { track('family_left'); return r; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['family-status'] }); qc.invalidateQueries({ queryKey:['family-overview'] }); },
  });
  const copy = () => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(()=>setCopied(false), 1500); };

  return (
    <motion.div variants={cardVar} className={styles.card}
      style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
      <div style={{ fontSize:13, color:t.text2 }}>
        <strong style={{ color:t.text }}>Invite code:</strong> share this so family can join
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(29,78,216,.1)', borderRadius:11, padding:'8px 15px' }}>
        <span style={{ fontSize:18, fontWeight:800, letterSpacing:3, color:DS.purple, fontFamily:'Inter, monospace' }}>{code}</span>
        <button onClick={copy} style={{ background:'none', border:'none', cursor:'pointer', color:DS.purple, display:'flex' }}>
          {copied ? <Check size={16}/> : <Copy size={16}/>}
        </button>
      </div>
      <button onClick={() => { if(confirm('Disband this family? All members will be removed.')) leaveMut.mutate(); }}
        style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'8px 15px', borderRadius:11, border:'1.5px solid rgba(220,38,38,.3)', background:'rgba(220,38,38,.08)', color:DS.pink, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
        <LogOut size={13}/> Disband
      </button>
    </motion.div>
  );
}

/* ── Create or Join (no family yet) ── */
function SetupFamily({ qc }) {
  const { t } = usePalette();
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [shareMode, setShareMode] = useState('shared');
  const [err, setErr]   = useState('');

  const refresh = () => { qc.invalidateQueries({ queryKey:['family-status'] }); qc.invalidateQueries({ queryKey:['family-overview'] }); };
  const createMut = useMutation({
    mutationFn: () => familyAPI.create(name, shareMode).then(r => { track('family_created'); return r; }),
    onSuccess: refresh,
    onError: e => setErr(e.response?.data?.message || 'Failed to create family'),
  });
  const joinMut = useMutation({
    mutationFn: () => familyAPI.join(code).then(r => { track('family_joined'); return r; }),
    onSuccess: refresh,
    onError: e => setErr(e.response?.data?.message || 'Failed to join family'),
  });

  const inputSt = { width:'100%', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${t.border}`, background:t.surface, color:t.text, fontSize:14, outline:'none', boxSizing:'border-box' };

  return (
    <Page t={t} title="Family" subtitle="Start a family as head, or join one with a code">
      {err && (
        <motion.div variants={cardVar} style={{ background:'rgba(220,38,38,.08)', color:DS.pink, padding:'11px 15px', borderRadius:12, fontSize:13, fontWeight:600, border:'1.5px solid rgba(220,38,38,.25)' }}>⚠️ {err}</motion.div>
      )}

      {!mode && (
        <>
          <motion.button variants={cardVar} onClick={() => { setMode('create'); setErr(''); }} className={styles.card}
            style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow, display:'flex', alignItems:'center', gap:14, cursor:'pointer', textAlign:'left', width:'100%' }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'rgba(29,78,216,.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Plus size={22} color={DS.purple}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700, color:t.text }}>Create a family</div>
              <div style={{ fontSize:12.5, color:t.text2 }}>You become the head & get an invite code</div>
            </div>
            <ChevronRight size={18} color={t.text3}/>
          </motion.button>
          <motion.button variants={cardVar} onClick={() => { setMode('join'); setErr(''); }} className={styles.card}
            style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow, display:'flex', alignItems:'center', gap:14, cursor:'pointer', textAlign:'left', width:'100%' }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'rgba(4,120,87,.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <UserPlus size={22} color={DS.green}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:700, color:t.text }}>Join a family</div>
              <div style={{ fontSize:12.5, color:t.text2 }}>Enter the code from your family head</div>
            </div>
            <ChevronRight size={18} color={t.text3}/>
          </motion.button>
        </>
      )}

      {mode === 'create' && (
        <motion.div variants={cardVar} className={styles.card} style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
          <label style={{ fontSize:12, fontWeight:700, color:t.text2, textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:8 }}>Family Name</label>
          <input autoFocus value={name} onChange={e=>{setName(e.target.value);setErr('');}} placeholder="e.g. The Kumar Family"
            onKeyDown={e=>e.key==='Enter'&&name.trim()&&createMut.mutate()} style={{ ...inputSt, marginBottom:16 }}/>

          <label style={{ fontSize:12, fontWeight:700, color:t.text2, textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:8 }}>Who can see what?</label>
          <div style={{ display:'grid', gap:8, marginBottom:16 }}>
            {[
              { id:'shared',    icon:'🤝', title:'Shared (for couples)', desc:'Everyone sees everyone\'s transactions & dashboards' },
              { id:'head_only', icon:'👑', title:'Head-only (for parents)', desc:'Only you see members; they see only themselves' },
            ].map(opt => (
              <button key={opt.id} type="button" onClick={() => setShareMode(opt.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:13, cursor:'pointer', textAlign:'left',
                  border: shareMode===opt.id ? `2px solid ${DS.purple}` : `1.5px solid ${t.border}`,
                  background: shareMode===opt.id ? 'rgba(29,78,216,.1)' : t.surface }}>
                <span style={{ fontSize:22 }}>{opt.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color: shareMode===opt.id ? DS.purple : t.text }}>{opt.title}</div>
                  <div style={{ fontSize:11.5, color:t.text2, marginTop:1 }}>{opt.desc}</div>
                </div>
                {shareMode===opt.id && <Check size={16} color={DS.purple}/>}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>{setMode(null);setErr('');}} style={{ flex:1, padding:'12px', borderRadius:12, border:`1.5px solid ${t.border}`, background:t.surface, color:t.text2, fontWeight:600, fontSize:14, cursor:'pointer' }}>Back</button>
            <button onClick={()=>createMut.mutate()} disabled={!name.trim()||createMut.isPending}
              style={{ flex:2, padding:'12px', borderRadius:12, border:'none', background:'#1D4ED8', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity:(!name.trim())?.6:1 }}>
              {createMut.isPending ? 'Creating…' : 'Create Family'}
            </button>
          </div>
        </motion.div>
      )}

      {mode === 'join' && (
        <motion.div variants={cardVar} className={styles.card} style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
          <label style={{ fontSize:12, fontWeight:700, color:t.text2, textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:8 }}>Family Code</label>
          <input autoFocus value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setErr('');}} placeholder="ABC123" maxLength={6}
            onKeyDown={e=>e.key==='Enter'&&code.trim()&&joinMut.mutate()}
            style={{ ...inputSt, fontSize:20, fontWeight:800, letterSpacing:4, textAlign:'center', marginBottom:12, fontFamily:'Inter, monospace' }}/>
          <div style={{ fontSize:12, color:t.text2, background:'rgba(217,119,6,.08)', borderRadius:10, padding:'9px 12px', marginBottom:16 }}>
            ⚠️ By joining, the family head will be able to see your accounts and spending.
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>{setMode(null);setErr('');}} style={{ flex:1, padding:'12px', borderRadius:12, border:`1.5px solid ${t.border}`, background:t.surface, color:t.text2, fontWeight:600, fontSize:14, cursor:'pointer' }}>Back</button>
            <button onClick={()=>joinMut.mutate()} disabled={!code.trim()||joinMut.isPending}
              style={{ flex:2, padding:'12px', borderRadius:12, border:'none', background:'#047857', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity:(!code.trim())?.6:1 }}>
              {joinMut.isPending ? 'Joining…' : 'Join Family'}
            </button>
          </div>
        </motion.div>
      )}
    </Page>
  );
}

/* ── Member view (joined, not primary, head-only) ── */
function MemberView({ status, qc }) {
  const { t } = usePalette();
  const leaveMut = useMutation({
    mutationFn: () => familyAPI.leave().then(r => { track('family_left'); return r; }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['family-status'] }),
  });
  const head = status.members?.find(m => m.family_role === 'primary');

  return (
    <Page t={t} title={status.family_name} subtitle="You're a family member">
      <motion.div variants={cardVar} className={styles.card}
        style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow, textAlign:'center', padding:'32px 24px' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>👨‍👩‍👧</div>
        <div style={{ fontSize:19, fontWeight:800, color:t.text, marginBottom:6 }}>{status.family_name}</div>
        <div style={{ fontSize:13.5, color:t.text2, maxWidth:420, marginInline:'auto' }}>
          You're a member of this family.{head ? ` ${head.name} (head) can see your accounts and spending.` : ''}
        </div>
      </motion.div>

      <motion.div variants={cardVar} className={styles.card} style={{ background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle} style={{ color:t.text }}>Members</span>
        </div>
        <div style={{ display:'grid', gap:8 }}>
          {status.members?.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, background:t.surface, border:`1px solid ${t.border}` }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:'#1D4ED8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>
                {m.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <span style={{ fontSize:13.5, color:t.text, fontWeight:600, flex:1 }}>{m.name}{m.is_me?' (You)':''}</span>
              <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:14, background: m.family_role==='primary'?'rgba(217,119,6,.15)':'rgba(29,78,216,.12)', color: m.family_role==='primary'?DS.orange:DS.purple }}>
                {m.family_role==='primary'?'👑 Head':'Member'}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.button variants={cardVar} onClick={() => { if(confirm('Leave this family? The head will no longer see your data.')) leaveMut.mutate(); }}
        style={{ alignSelf:'center', display:'inline-flex', alignItems:'center', gap:7, padding:'12px 26px', borderRadius:14, border:'1.5px solid rgba(220,38,38,.3)', background:'rgba(220,38,38,.08)', color:DS.pink, fontWeight:700, fontSize:14, cursor:'pointer' }}>
        <LogOut size={15}/> Leave Family
      </motion.button>
    </Page>
  );
}

/* ── Member detail modal (primary clicks a member) ── */
function MemberDetailModal({ memberId, onClose, fmt, qc, canRemove, t }) {
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
      <div className="modal" style={{ maxWidth:540, maxHeight:'88vh', overflowY:'auto', background:t.card, border:`1px solid ${t.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div style={{ fontSize:18, fontWeight:800, color:t.text, flex:1 }}>{isLoading ? 'Loading…' : data?.member.name}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:t.text3 }}><X size={20}/></button>
        </div>

        {isLoading ? <PageLoader /> : (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:t.text2, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Accounts ({data.wallets.length})</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {data.wallets.map(w => {
                const bal = parseFloat(w.balance);
                return (
                  <div key={w.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', borderRadius:11, background:t.surface, border:`1px solid ${t.border}` }}>
                    <span style={{ fontSize:13, fontWeight:600, color:t.text }}>{w.name}{w.last_four?` ••${w.last_four}`:''}</span>
                    <span style={{ fontSize:13.5, fontWeight:800, color: bal>=0?t.text:DS.danger, fontFamily:'Inter, sans-serif' }}>{bal<0&&'−'}{fmt(Math.abs(bal))}</span>
                  </div>
                );
              })}
              {!data.wallets.length && <div style={{ fontSize:13, color:t.text3, padding:'8px 0' }}>No accounts yet.</div>}
            </div>

            <div style={{ fontSize:12, fontWeight:700, color:t.text2, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Recent Transactions</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:18 }}>
              {data.recent_transactions.map(tx => (
                <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:11, background:t.surface, border:`1px solid ${t.border}` }}>
                  <span style={{ fontSize:16 }}>{tx.category_emoji || '💸'}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:t.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.description || tx.payment_name}</div>
                    <div style={{ fontSize:10.5, color:t.text3 }}>{new Date(tx.transaction_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {tx.category_name || 'Uncategorized'}</div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:800, color: tx.type==='income'?DS.green:DS.pink, fontFamily:'Inter, sans-serif' }}>
                    {tx.type==='income'?'+':'−'}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
              {!data.recent_transactions.length && <div style={{ fontSize:13, color:t.text3, padding:'8px 0' }}>No transactions yet.</div>}
            </div>

            {canRemove && (
              <button onClick={() => { if(confirm('Remove this member from the family?')) removeMut.mutate(); }}
                style={{ width:'100%', padding:'12px', borderRadius:12, border:'1.5px solid rgba(220,38,38,.3)', background:'rgba(220,38,38,.08)', color:DS.pink, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Remove from family
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
