import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsAPI, transactionsAPI } from '../services/api';
import { Topbar, PageLoader, ProgressBar, EmptyState } from '../components/ui';
import { Plus, Target, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { useFmt, useT } from '../i18n';
import useAuthStore from '../store/authStore';
import usePremiumStore from '../store/premiumStore';

const FREE_GOAL_LIMIT = 3;

export default function Goals() {
  const qc = useQueryClient();
  const fmt = useFmt();
  const t = useT();
  const { user } = useAuthStore();
  const { openPremium } = usePremiumStore();
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [showFunds, setShowFunds] = useState(null);

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsAPI.getAll().then(r => r.data.data),
  });

  const atGoalLimit = !user?.is_premium && (goals||[]).length >= FREE_GOAL_LIMIT;
  const openAddGoal = () => atGoalLimit ? openPremium() : (setEditGoal(null), setShowModal(true));

  /* 6-month trend data for sparklines */
  const { data: trendTx } = useQuery({
    queryKey: ['goals-trend'],
    queryFn: () => transactionsAPI.getAll({ limit: 1000 }).then(r => r.data.data || []),
    staleTime: 5 * 60 * 1000,
  });

  const { savedTrend, targetTrend, incomeTrend, completedTrend } = useMemo(() => {
    const saved = [], target = [], income = [], completed = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const yr = now.getFullYear(), mo = now.getMonth() - i;
      const start = new Date(yr, mo, 1);
      const end   = new Date(yr, mo + 1, 0, 23, 59, 59);
      const slice = (trendTx || []).filter(tx => {
        const d = new Date(tx.transaction_date); return d >= start && d <= end;
      });
      const inc = slice.filter(tx => tx.type === 'income').reduce((s, tx) => s + parseFloat(tx.amount||0), 0);
      const exp = slice.filter(tx => tx.type === 'expense').reduce((s, tx) => s + parseFloat(tx.amount||0), 0);
      income.push(inc);
      saved.push(Math.max(0, inc - exp));
      target.push(inc * 0.8); // target proxy
      completed.push(Math.max(0, inc - exp));
    }
    return { savedTrend: saved, targetTrend: target, incomeTrend: income, completedTrend: completed };
  }, [trendTx]);

  const deleteMutation = useMutation({
    mutationFn: (id) => goalsAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });

  if (isLoading) return <PageLoader />;

  const totalTarget  = (goals||[]).reduce((s,g) => s + parseFloat(g.target_amount||0), 0);
  const totalSaved   = (goals||[]).reduce((s,g) => s + parseFloat(g.current_amount||0), 0);
  const avgProgress  = goals?.length ? (goals.reduce((s,g) => s + parseFloat(g.percentage||0), 0) / goals.length) : 0;
  const completed    = (goals||[]).filter(g => parseFloat(g.percentage) >= 100).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Mobile header */}
      <div className="mob-header">
        <div>
          <div className="mob-header-title">{t('goals_title')}</div>
          <div className="mob-header-sub">{t('goals_sub')}</div>
        </div>
      </div>

      {/* Desktop topbar */}
      <div className="mob-hide">
        <Topbar title={t('goals_title')} subtitle={t('goals_sub')}>
          <button className="btn btn-primary btn-sm"
            style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}
            onClick={openAddGoal}>
            <Plus size={13}/> {t('goals_add')}
          </button>
        </Topbar>
      </div>

      <div className="mob-content" style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>

        {/* Free-tier limit banner */}
        {!user?.is_premium && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background: atGoalLimit ? 'rgba(255,184,77,.12)' : 'rgba(108,99,255,.06)', borderRadius:12, padding:'10px 16px', marginBottom:18, border:`1px solid ${atGoalLimit ? 'rgba(255,184,77,.3)' : 'rgba(108,99,255,.15)'}` }}>
            <span style={{ fontSize:18 }}>{atGoalLimit ? '⚠️' : '🎯'}</span>
            <span style={{ fontSize:12.5, color: atGoalLimit ? '#b8860b' : 'var(--text3)', flex:1 }}>
              {atGoalLimit
                ? <><strong style={{ color:'#FFB84D' }}>Goal limit reached</strong> — Free plan allows {FREE_GOAL_LIMIT} saving goals.</>
                : <>{(goals||[]).length} / {FREE_GOAL_LIMIT} goals used on free plan.</>}
            </span>
            {atGoalLimit && (
              <button onClick={openPremium} style={{ fontSize:12, fontWeight:700, padding:'5px 12px', borderRadius:8, border:'none', background:'#FFB84D', color:'#fff', cursor:'pointer' }}>
                Upgrade ✨
              </button>
            )}
          </div>
        )}

        {/* Summary cards */}
        <div className="mob-summary-scroll" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
          {[
            { label:t('goals_total_goals'),        value: goals?.length || 0,                sub:t('goals_active_sub'),                   icon:<Target size={20} color="#6C63FF"/>,    bg:'rgba(108,99,255,.1)', color:'#6C63FF' },
            { label:t('goals_total_saved_label'),  value: fmt(totalSaved,{noDecimals:true}), sub:t('goals_across_goals'),                  icon:<DollarSign size={20} color="#37D67A"/>, bg:'rgba(55,214,122,.1)', color:'#37D67A' },
            { label:t('goals_total_target_label'), value: fmt(totalTarget,{noDecimals:true}),sub:t('goals_overall_target'),                icon:<TrendingUp size={20} color="#5B8CFF"/>,  bg:'rgba(91,140,255,.1)', color:'#5B8CFF' },
            { label:t('goals_completed_label'),    value: completed,                         sub:`${avgProgress.toFixed(0)}% avg`,         icon:<Calendar size={20} color="#FFB84D"/>,   bg:'rgba(255,184,77,.1)', color:'#FFB84D' },
          ].map(({ label, value, sub, icon, bg, color }) => (
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

        {/* Goals grid */}
        {!goals?.length ? (
          <div style={{ background:'var(--surface)', borderRadius:22, boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)' }}>
            <EmptyState icon="🎯" title={t('goals_empty')}
              description={t('goals_empty_desc')}
              action={<button className="btn btn-primary" onClick={() => setShowModal(true)}
                style={{ background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none' }}>
                {t('goals_add_first')}
              </button>}/>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
            {goals.map(g => {
              const pct = parseFloat(g.percentage||0);
              const isComplete = pct >= 100;
              const daysLeft = g.target_date
                ? Math.max(0, Math.ceil((new Date(g.target_date) - new Date()) / 86400000))
                : null;

              return (
                <div key={g.id} style={{
                  background:'var(--surface)', borderRadius:22, padding:'22px 24px',
                  boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)',
                  position:'relative', overflow:'hidden', transition:'all .22s ease',
                }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                onMouseLeave={e=>e.currentTarget.style.transform=''}>

                  {/* Top color bar */}
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: isComplete ? 'var(--green)' : (g.color||'var(--accent)'), borderRadius:'22px 22px 0 0' }}/>

                  {/* Completed badge */}
                  {isComplete && (
                    <div style={{ position:'absolute', top:12, right:12, background:'var(--green)', color:'#fff', fontSize:10, fontWeight:700, borderRadius:20, padding:'3px 10px' }}>
                      {t('goals_complete_badge')}
                    </div>
                  )}

                  {/* Header */}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{
                        width:44, height:44, borderRadius:14,
                        background:(g.color||'#6C63FF')+'22',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:22, flexShrink:0,
                      }}>{g.emoji}</div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{g.name}</div>
                        {g.target_date && (
                          <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:2 }}>
                            🗓 {daysLeft > 0 ? `${daysLeft} ${t('goals_days_left')}` : t('goals_date_passed')}
                          </div>
                        )}
                      </div>
                    </div>
                    {!isComplete && (
                      <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                        <button onClick={() => { setEditGoal(g); setShowModal(true); }}
                          style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', padding:'5px 7px', fontSize:12 }}>✏️</button>
                        <button onClick={() => { if(confirm(t('goals_delete_confirm'))) deleteMutation.mutate(g.id); }}
                          style={{ background:'var(--red-light)', border:'1px solid rgba(255,91,91,.2)', borderRadius:8, cursor:'pointer', padding:'5px 7px', fontSize:12 }}>🗑️</button>
                      </div>
                    )}
                  </div>

                  {/* Amount display */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{t('goals_saved')}</div>
                      <div className="mono" style={{ fontSize:22, fontWeight:900, color:'var(--text)', letterSpacing:-0.5 }}>
                        {fmt(g.current_amount||0,{noDecimals:true})}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{t('goals_target')}</div>
                      <div className="mono" style={{ fontSize:14, fontWeight:700, color:'var(--text2)' }}>
                        {fmt(g.target_amount||0,{noDecimals:true})}
                      </div>
                    </div>
                    <div style={{
                      fontSize:18, fontWeight:900, color: isComplete ? 'var(--green)' : (g.color||'var(--accent)'),
                      fontFamily:'Space Grotesk, Inter, sans-serif',
                    }}>
                      {Math.min(100,Math.round(pct))}%
                    </div>
                  </div>

                  <ProgressBar value={Math.min(100,pct)} color={isComplete ? 'var(--green)' : (g.color||'var(--accent)')} height={8}/>

                  {/* Footer */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14 }}>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>
                      {t('goals_monthly_label')} <span className="mono" style={{ fontWeight:600, color:'var(--text2)' }}>
                        {fmt(g.monthly_contribution||0,{noDecimals:true})}
                      </span>
                    </div>
                    {!isComplete && (
                      <button onClick={() => setShowFunds(g)}
                        style={{
                          background:'linear-gradient(135deg,#6C63FF,#5B8CFF)',
                          color:'#fff', border:'none', borderRadius:10,
                          padding:'7px 14px', fontSize:12.5, fontWeight:700,
                          cursor:'pointer', boxShadow:'0 4px 12px rgba(108,99,255,.3)',
                          transition:'all .15s', fontFamily:'Inter,sans-serif',
                        }}>
                        {t('goals_add_funds')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <GoalModal
          goal={editGoal}
          onClose={() => { setShowModal(false); setEditGoal(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey:['goals'] }); setShowModal(false); setEditGoal(null); }}
        />
      )}

      {showFunds && (
        <AddFundsModal
          goal={showFunds}
          onClose={() => setShowFunds(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey:['goals'] }); setShowFunds(null); }}
        />
      )}

      {/* Mobile FAB */}
      <button className="mob-fab" onClick={() => { setEditGoal(null); setShowModal(true); }}>
        <Plus size={26} color="#fff"/>
      </button>
    </div>
  );
}

function GoalModal({ goal, onClose, onSaved }) {
  const t = useT();
  const [form, setForm] = useState({
    name:                goal?.name                || '',
    target_amount:       goal?.target_amount       || '',
    current_amount:      goal?.current_amount      || 0,
    emoji:               goal?.emoji               || '🎯',
    color:               goal?.color               || '#6C63FF',
    target_date:         goal?.target_date ? goal.target_date.split('T')[0] : '',
    monthly_contribution:goal?.monthly_contribution|| 0,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => goal ? goalsAPI.update(goal.id,data) : goalsAPI.create(data),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.message || 'Error saving goal'),
  });

  const PRESET_COLORS = ['#6C63FF','#5B8CFF','#37D67A','#FFB84D','#FF5B5B','#FF79A8','#A29BFE','#00C896'];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{goal ? t('goals_edit_title') : t('goals_new_title')}</div>
        {error && <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'8px 12px', borderRadius:10, marginBottom:14, fontSize:13 }}>{error}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">{t('goals_name')}</label>
            <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. New MacBook, Emergency Fund, Vacation"/>
          </div>
          <div className="form-group">
            <label className="form-label">{t('goals_amount')}</label>
            <input className="form-input" type="number" value={form.target_amount} onChange={e=>setForm(f=>({...f,target_amount:e.target.value}))} placeholder="1000"/>
          </div>
          <div className="form-group">
            <label className="form-label">{t('goals_already_saved')}</label>
            <input className="form-input" type="number" value={form.current_amount} onChange={e=>setForm(f=>({...f,current_amount:e.target.value}))} placeholder="0"/>
          </div>
          <div className="form-group">
            <label className="form-label">{t('goals_monthly_contrib')}</label>
            <input className="form-input" type="number" value={form.monthly_contribution} onChange={e=>setForm(f=>({...f,monthly_contribution:e.target.value}))} placeholder="100"/>
          </div>
          <div className="form-group">
            <label className="form-label">{t('goals_date')}</label>
            <input className="form-input" type="date" value={form.target_date} onChange={e=>setForm(f=>({...f,target_date:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">{t('goals_emoji_label')}</label>
            <input className="form-input" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} style={{ fontSize:20, textAlign:'center' }}/>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">{t('goals_color_label')}</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  style={{ width:28, height:28, borderRadius:8, background:c, border: form.color===c ? '3px solid var(--text)' : '2px solid transparent', cursor:'pointer', outline:'none' }}/>
              ))}
              <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                style={{ width:30, height:30, borderRadius:8, cursor:'pointer', border:'1px solid var(--border)', padding:2 }}/>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>{t('modal_cancel')}</button>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={()=>mutation.mutate(form)}
            style={{ background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
            {mutation.isPending ? t('goals_saving') : goal ? t('goals_update') : t('goals_create')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddFundsModal({ goal, onClose, onSaved }) {
  const t = useT();
  const fmt = useFmt();
  const [amount, setAmount] = useState('');
  const mutation = useMutation({
    mutationFn: () => goalsAPI.addFunds(goal.id, parseFloat(amount)),
    onSuccess: onSaved,
  });
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:380 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:(goal.color||'#6C63FF')+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
            {goal.emoji}
          </div>
          <div className="modal-title" style={{ margin:0 }}>{t('goals_funds_add')} — {goal.name}</div>
        </div>

        <div style={{ background:'var(--surface2)', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text3)', marginBottom:8 }}>
            <span>{fmt(goal.current_amount||0,{noDecimals:true})} {t('goals_saved_label')}</span>
            <span>{fmt(goal.target_amount||0,{noDecimals:true})} {t('goals_target_label')}</span>
          </div>
          <ProgressBar value={parseFloat(goal.percentage||0)} color={goal.color||'var(--accent)'} height={8}/>
        </div>

        <div className="form-group">
          <label className="form-label">{t('goals_funds_amount')}</label>
          <input className="form-input" type="number" value={amount}
            onChange={e=>setAmount(e.target.value)} placeholder="100" autoFocus
            style={{ fontSize:18, fontWeight:700 }}/>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>{t('modal_cancel')}</button>
          <button className="btn btn-primary" disabled={mutation.isPending||!amount} onClick={()=>mutation.mutate()}
            style={{ background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
            {mutation.isPending ? t('goals_adding') : t('goals_funds_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}
