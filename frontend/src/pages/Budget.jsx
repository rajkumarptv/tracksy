import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsAPI, categoriesAPI, transactionsAPI } from '../services/api';
import { Topbar, PageLoader, ProgressBar, EmptyState } from '../components/ui';
import { Plus, PieChart, AlertTriangle, CheckCircle } from 'lucide-react';
import { useFmt, useT } from '../i18n';
import useAuthStore from '../store/authStore';
import usePremiumStore from '../store/premiumStore';

const FREE_BUDGET_LIMIT = 3;

export default function Budget() {
  const qc = useQueryClient();
  const fmt = useFmt();
  const t = useT();
  const { user } = useAuthStore();
  const { openPremium } = usePremiumStore();
  const [showModal, setShowModal] = useState(false);
  const [editBudget, setEditBudget] = useState(null);

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsAPI.getAll().then(r => r.data.data),
  });

  const atBudgetLimit = !user?.is_premium && (budgets||[]).length >= FREE_BUDGET_LIMIT;
  const openAddBudget = () => atBudgetLimit ? openPremium() : (setEditBudget(null), setShowModal(true));

  const deleteMutation = useMutation({
    mutationFn: (id) => budgetsAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  });

  /* ── 6-month trend data for sparklines ── */
  const { data: trendTx } = useQuery({
    queryKey: ['budget-trend'],
    queryFn: () => transactionsAPI.getAll({ limit: 1000 }).then(r => r.data.data || []),
    staleTime: 5 * 60 * 1000,
  });

  const { spendTrend, savingsTrend, budgetTrend, healthTrend } = useMemo(() => {
    const now = new Date();
    const spend = [], savings = [], budget = [], health = [];
    for (let i = 5; i >= 0; i--) {
      const yr = now.getFullYear(), mo = now.getMonth() - i;
      const start = new Date(yr, mo, 1);
      const end   = new Date(yr, mo + 1, 0, 23, 59, 59);
      const slice = (trendTx || []).filter(tx => {
        const d = new Date(tx.transaction_date);
        return d >= start && d <= end;
      });
      const inc = slice.filter(tx => tx.type === 'income').reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
      const exp = slice.filter(tx => tx.type === 'expense').reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
      spend.push(exp);
      savings.push(Math.max(0, inc - exp));
      budget.push(inc);
      // health: percentage of expense vs income (lower = healthier)
      health.push(inc > 0 ? Math.min(100, Math.round((exp / inc) * 100)) : 0);
    }
    return { spendTrend: spend, savingsTrend: savings, budgetTrend: budget, healthTrend: health };
  }, [trendTx]);

  const totalBudget  = (budgets||[]).reduce((s,b) => s + parseFloat(b.amount||0), 0);
  const totalSpent   = (budgets||[]).reduce((s,b) => s + parseFloat(b.spent||0),  0);
  const totalPct     = totalBudget > 0 ? (totalSpent/totalBudget)*100 : 0;
  const remaining    = Math.max(0, totalBudget - totalSpent);
  const atRisk       = (budgets||[]).filter(b => parseFloat(b.percentage) >= 85).length;
  const onTrack      = (budgets||[]).filter(b => parseFloat(b.percentage) < 85).length;
  const mostExpenses = [...(budgets||[])].sort((a,b) => b.spent - a.spent).slice(0,6);

  if (isLoading) return <PageLoader />;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Mobile header */}
      <div className="mob-header">
        <div>
          <div className="mob-header-title">{t('budget_title')}</div>
          <div className="mob-header-sub">{t('budget_sub')}</div>
        </div>
      </div>

      {/* Desktop topbar */}
      <div className="mob-hide">
        <Topbar title={t('budget_title')} subtitle={t('budget_sub')}>
          <button className="btn btn-primary btn-sm"
            style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}
            onClick={openAddBudget}>
            <Plus size={13}/> {t('budget_add')}
          </button>
        </Topbar>
      </div>

      <div className="mob-content" style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>

        {/* Free-tier limit banner */}
        {!user?.is_premium && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background: atBudgetLimit ? 'rgba(255,184,77,.12)' : 'rgba(108,99,255,.06)', borderRadius:12, padding:'10px 16px', marginBottom:18, border:`1px solid ${atBudgetLimit ? 'rgba(255,184,77,.3)' : 'rgba(108,99,255,.15)'}` }}>
            <span style={{ fontSize:18 }}>{atBudgetLimit ? '⚠️' : '📊'}</span>
            <span style={{ fontSize:12.5, color: atBudgetLimit ? '#b8860b' : 'var(--text3)', flex:1 }}>
              {atBudgetLimit
                ? <><strong style={{ color:'#FFB84D' }}>Budget limit reached</strong> — Free plan allows {FREE_BUDGET_LIMIT} budgets.</>
                : <>{(budgets||[]).length} / {FREE_BUDGET_LIMIT} budgets used on free plan.</>}
            </span>
            {atBudgetLimit && (
              <button onClick={openPremium} style={{ fontSize:12, fontWeight:700, padding:'5px 12px', borderRadius:8, border:'none', background:'#FFB84D', color:'#fff', cursor:'pointer' }}>
                Upgrade ✨
              </button>
            )}
          </div>
        )}

        {/* Summary row */}
        <div className="mob-summary-scroll" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
          {[
            { label:t('budget_total'),  value: fmt(totalBudget,{noDecimals:true}), sub:t('dash_this_month'),                   icon:'💰', bg:'rgba(108,99,255,.1)', color:'#6C63FF' },
            { label:t('budget_spent'),  value: fmt(totalSpent,{noDecimals:true}),  sub:`${totalPct.toFixed(0)}% ${t('dash_used')}`, icon:'📤', bg:'rgba(255,91,91,.1)',  color:'#FF5B5B' },
            { label:t('budget_remaining'), value: fmt(remaining,{noDecimals:true}), sub:t('dash_left'),                icon:'🎯', bg:'rgba(55,214,122,.1)', color:'#37D67A' },
            { label:t('budget_health'), value: atRisk > 0 ? `${atRisk} ⚠️` : `✓ ${t('budget_on_track')}`, sub:`${onTrack} ${t('budget_on_track')}`,
              icon: atRisk > 0 ? '⚠️' : '✅', bg: atRisk > 0 ? 'rgba(255,184,77,.12)' : 'rgba(55,214,122,.1)',
              color: atRisk > 0 ? '#FFB84D' : '#37D67A' },
          ].map(({ label, value, sub, icon, bg, color }) => (
            <div key={label} style={{
              background:'var(--surface)', borderRadius:20, padding:'16px 18px',
              boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)',
              display:'flex', alignItems:'center', gap:14,
            }}>
              <div style={{ width:42, height:42, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
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

        {/* Overall progress */}
        <div style={{
          background:'var(--surface)', borderRadius:20, padding:'20px 24px',
          boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)',
          marginBottom:24,
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{t('budget_title')} Progress</div>
            <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--accent)' }}>{totalPct.toFixed(0)}% {t('budget_spent')}</span>
          </div>
          <ProgressBar value={totalPct} color={totalPct >= 85 ? 'var(--red)' : totalPct >= 65 ? 'var(--amber)' : 'var(--accent)'} height={10}/>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:12, color:'var(--text3)', fontWeight:500 }}>
            <span>{fmt(0,{noDecimals:true})}</span>
            <span style={{ color:'var(--text2)' }}>{fmt(totalSpent,{noDecimals:true})} {t('budget_spent')} {t('common_of')} {fmt(totalBudget,{noDecimals:true})}</span>
            <span>{fmt(totalBudget,{noDecimals:true})}</span>
          </div>
        </div>

        <div className="mob-grid-1col" style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>

          {/* Budget cards grid */}
          <div>
            {!(budgets||[]).length ? (
              <div style={{ background:'var(--surface)', borderRadius:20, boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)' }}>
                <EmptyState icon="📊" title={t('budget_empty')}
                  description={t('budget_empty_desc')}
                  action={<button className="btn btn-primary" onClick={() => setShowModal(true)}
                    style={{ background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none' }}>
                    {t('budget_create')}
                  </button>}/>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
                {(budgets||[]).map(b => {
                  const pct = parseFloat(b.percentage||0);
                  const isRisk = pct >= 85;
                  const barColor = pct >= 85 ? 'var(--red)' : pct >= 65 ? 'var(--amber)' : (b.color || 'var(--accent)');
                  return (
                    <div key={b.id} style={{
                      background:'var(--surface)', borderRadius:20, padding:'20px 22px',
                      boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)',
                      position:'relative', overflow:'hidden', transition:'all .2s ease',
                    }}
                    onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                    onMouseLeave={e=>e.currentTarget.style.transform=''}>

                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:38, height:38, borderRadius:12, background:(b.color||'#6C63FF')+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                            {b.emoji}
                          </div>
                          <div>
                            <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{b.name}</div>
                            <div style={{ fontSize:11, color:'var(--text3)', marginTop:1, textTransform:'capitalize' }}>{b.period}</div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={() => { setEditBudget(b); setShowModal(true); }}
                            style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', padding:'5px 7px', fontSize:12 }}>✏️</button>
                          <button onClick={() => { if(confirm(t('budget_delete_confirm'))) deleteMutation.mutate(b.id); }}
                            style={{ background:'var(--red-light)', border:'1px solid rgba(255,91,91,.2)', borderRadius:8, cursor:'pointer', padding:'5px 7px', fontSize:12 }}>🗑️</button>
                        </div>
                      </div>

                      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14 }}>
                        {/* Progress ring */}
                        <div style={{ position:'relative', flexShrink:0 }}>
                          <svg width="64" height="64" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface3)" strokeWidth="7"/>
                            <circle cx="32" cy="32" r="26" fill="none" stroke={barColor} strokeWidth="7"
                              strokeDasharray={`${(pct/100)*163.4} 163.4`} strokeLinecap="round"
                              transform="rotate(-90 32 32)" style={{ transition:'stroke-dasharray .6s ease' }}/>
                          </svg>
                          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ fontSize:12, fontWeight:800, color:'var(--text)' }}>{Math.round(pct)}%</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>{t('budget_remaining')}</div>
                          <div className="mono" style={{ fontSize:20, fontWeight:800, letterSpacing:-0.5, color:'var(--text)' }}>
                            {fmt(b.remaining||0,{noDecimals:true})}
                          </div>
                          <div style={{ fontSize:11.5, color:'var(--text3)', fontFamily:'Space Grotesk, Inter, sans-serif', marginTop:2 }}>
                            {t('common_of')} {fmt(b.amount||0,{noDecimals:true})}
                          </div>
                        </div>
                      </div>

                      <ProgressBar value={pct} color={barColor} height={6}/>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                        <span style={{ fontSize:12, color:'var(--text3)' }}>
                          {fmt(b.spent||0,{noDecimals:true})} {t('budget_spent')}
                        </span>
                        {isRisk ? (
                          <span style={{ fontSize:11.5, color:'var(--amber)', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                            <AlertTriangle size={11}/> {t('budget_over')}
                          </span>
                        ) : (
                          <span style={{ fontSize:11.5, color:'var(--green)', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                            <CheckCircle size={11}/> {t('budget_on_track')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Most expenses */}
            <div style={{ background:'var(--surface)', borderRadius:20, padding:'20px 22px', boxShadow:'0 4px 24px rgba(108,99,255,.08)', border:'1px solid var(--border-light)' }}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <PieChart size={16} color="var(--accent)"/> {t('budget_spent')}
              </div>
              {mostExpenses.map((b,i) => (
                <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom: i<mostExpenses.length-1 ? '1px solid var(--border-light)' : 'none' }}>
                  <div style={{ width:30, height:30, borderRadius:9, background:(b.color||'#6C63FF')+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                    {b.emoji}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.name}</div>
                    <div style={{ width:'100%', height:3, background:'var(--surface3)', borderRadius:4, marginTop:5 }}>
                      <div style={{ width:`${Math.min(100,parseFloat(b.percentage||0))}%`, height:'100%', background:b.color||'var(--accent)', borderRadius:4 }}/>
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize:12.5, fontWeight:700, color:'var(--text)', flexShrink:0 }}>
                    {fmt(b.spent||0,{noDecimals:true})}
                  </span>
                </div>
              ))}
              {!mostExpenses.length && (
                <div style={{ fontSize:13, color:'var(--text3)', textAlign:'center', padding:'16px 0' }}>No spending data yet</div>
              )}
            </div>

            {/* Tips card */}
            <div style={{
              background:'linear-gradient(135deg,#6C63FF 0%,#5B8CFF 100%)',
              borderRadius:20, padding:'20px 22px', color:'#fff',
              boxShadow:'0 8px 28px rgba(108,99,255,.3)',
            }}>
              <div style={{ fontSize:20, marginBottom:8 }}>💡</div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>Budget Tip</div>
              <div style={{ fontSize:12.5, opacity:.85, lineHeight:1.6 }}>
                Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings. Small adjustments lead to big results!
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <BudgetModal
          budget={editBudget}
          onClose={() => { setShowModal(false); setEditBudget(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey:['budgets'] }); setShowModal(false); setEditBudget(null); }}
        />
      )}

      {/* Mobile FAB */}
      <button className="mob-fab" onClick={() => { setEditBudget(null); setShowModal(true); }}>
        <Plus size={26} color="#fff"/>
      </button>
    </div>
  );
}

function BudgetModal({ budget, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:       budget?.name       || '',
    amount:     budget?.amount     || '',
    emoji:      budget?.emoji      || '📌',
    color:      budget?.color      || '#6C63FF',
    category_id:budget?.category_id|| '',
    period:     budget?.period     || 'monthly',
    start_date: budget?.start_date || new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');

  const { data: categories } = useQuery({ queryKey:['categories'], queryFn:() => categoriesAPI.getAll().then(r=>r.data.data) });

  const mutation = useMutation({
    mutationFn: (data) => budget ? budgetsAPI.update(budget.id,data) : budgetsAPI.create(data),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.message || 'Error saving budget'),
  });

  const PRESET_COLORS = ['#6C63FF','#5B8CFF','#37D67A','#FFB84D','#FF5B5B','#FF79A8','#00C896','#A29BFE'];

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{budget ? 'Edit' : 'New'} Budget</div>
        {error && <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'8px 12px', borderRadius:10, marginBottom:14, fontSize:13 }}>{error}</div>}

        <div className="form-group">
          <label className="form-label">Budget Name</label>
          <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Food & Groceries"/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group">
            <label className="form-label">Amount ($)</label>
            <input className="form-input" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="500"/>
          </div>
          <div className="form-group">
            <label className="form-label">Period</label>
            <select className="form-input" value={form.period} onChange={e=>setForm(f=>({...f,period:e.target.value}))}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Emoji</label>
            <input className="form-input" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="📌" style={{ fontSize:20, textAlign:'center' }}/>
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Color</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  style={{ width:28, height:28, borderRadius:8, background:c, border: form.color===c ? '3px solid var(--text)' : '2px solid transparent', cursor:'pointer', outline:'none' }}/>
              ))}
              <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                style={{ width:30, height:30, borderRadius:8, cursor:'pointer', border:'1px solid var(--border)', padding:2 }}/>
            </div>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Category (optional)</label>
            <select className="form-input" value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>
              <option value="">No category link</option>
              {(categories||[]).filter(c=>c.type==='expense'||c.type==='both').map(c=>(
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:8, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={()=>mutation.mutate(form)}
            style={{ background:'linear-gradient(135deg,#6C63FF,#5B8CFF)', border:'none', boxShadow:'0 4px 14px rgba(108,99,255,.35)' }}>
            {mutation.isPending ? 'Saving…' : budget ? 'Update Budget' : 'Create Budget'}
          </button>
        </div>
      </div>
    </div>
  );
}
