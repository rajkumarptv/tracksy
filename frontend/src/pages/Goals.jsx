import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { goalsAPI } from '../services/api';
import { PageLoader } from '../components/ui';
import {
  Plus, ChevronRight, ChevronDown, SlidersHorizontal, BarChart2,
  Rocket, Target as TargetIcon, Wallet, Pencil, Trash2,
  ChevronsUp, Minus, ChevronsDown,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { THEME } from '../theme';
import styles from './Goals.module.css';
import { invalidateFinance } from '../lib/cache';
import ThemedSelect from '../components/ThemedSelect';


const BADGE_CFG_DARK = {
  High:      { text:'High Priority',   bg:'rgba(79,70,229,.25)',  color:'#C4B5FD' },
  Medium:    { text:'Medium Priority', bg:'rgba(217,119,6,.22)',  color:'#FCD34D' },
  Low:       { text:'Low Priority',    bg:'rgba(59,130,246,.22)',  color:'#93C5FD' },
  Completed: { text:'Completed',       bg:'rgba(52,211,153,.18)',  color:'#34D399' },
};
const BADGE_CFG_LIGHT = {
  High:      { text:'High Priority',   bg:'#F3E8FF', color:'#4F46E5' },
  Medium:    { text:'Medium Priority', bg:'#FFF7ED', color:'#D97706' },
  Low:       { text:'Low Priority',    bg:'#EFF6FF', color:'#3B82F6' },
  Completed: { text:'Completed',       bg:'#D1FAE5', color:'#047857' },
};

function fmtINR(n) {
  const abs = Math.abs(Number(n)||0);
  if (abs >= 100000) return '₹' + (abs/100000).toFixed(abs%100000===0?0:1) + 'L';
  if (abs >= 1000)   return '₹' + (abs/1000).toFixed(abs%1000===0?0:1) + 'K';
  return '₹' + abs.toLocaleString('en-IN');
}
function fmtFull(n) { return '₹' + Math.round(Number(n)||0).toLocaleString('en-IN'); }

const spring = { type:'spring', stiffness:280, damping:28 };
const containerVar = { hidden:{}, show:{ transition:{ staggerChildren:.07 } } };
const cardVar = { hidden:{ opacity:0, y:22 }, show:{ opacity:1, y:0, transition:spring } };

/* ── Glowing donut (dashboard style) ── */
function DonutChart({ pct, size=160, stroke=14, color='#4F46E5', track, label, sublabel, labelColor, glow }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, pct);
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)', display:'block' }}>
        {glow && (
          <defs>
            <filter id="goalGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={color} floodOpacity="0.5"/>
            </filter>
          </defs>
        )}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke}/>
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ}
          filter={glow ? 'url(#goalGlow)' : undefined}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (clamped/100)*circ }}
          transition={{ duration:1.1, ease:[.2,.8,.2,1], delay:.3 }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:2 }}>
        {label && <div style={{ fontSize:15, fontWeight:800, color:labelColor, fontFamily:'Inter,sans-serif', letterSpacing:-0.3 }}>{label}</div>}
        {sublabel && <div style={{ fontSize:11, color:'inherit', opacity:.55, fontWeight:500 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function Goals() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const t = isDark ? THEME.dark : THEME.light;
  const BADGE_CFG = isDark ? BADGE_CFG_DARK : BADGE_CFG_LIGHT;

  const [filter, setFilter]       = useState('All');
  const [sortBy, setSortBy]       = useState('Priority');
  const [showSort, setShowSort]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal]   = useState(null);
  const [showFunds, setShowFunds] = useState(null);

  const { data: apiGoals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsAPI.getAll().then(r => r.data.data),
  });

  const rawGoals = useMemo(() => {
    if (!apiGoals) return [];
    return apiGoals.map(g => ({
      ...g,
      desc: g.desc || g.description || '',
      iconBg: g.color || '#4F46E5',
      priority: g.priority || 'Medium',
      status: parseFloat(g.percentage||0) >= 100 ? 'Completed' : (g.status || 'In Progress'),
    }));
  }, [apiGoals]);

  const openAddGoal = () => { setEditGoal(null); setShowModal(true); };

  const filteredGoals = useMemo(() => {
    let g = rawGoals;
    if (filter !== 'All') g = g.filter(x => x.status === filter);
    if (sortBy === 'Priority') {
      const ord = { High:0, Medium:1, Low:2 };
      g = [...g].sort((a,b) => (ord[a.priority]??2)-(ord[b.priority]??2));
    } else if (sortBy === 'Progress') {
      g = [...g].sort((a,b) => (b.current_amount/b.target_amount)-(a.current_amount/a.target_amount));
    } else if (sortBy === 'Amount') {
      g = [...g].sort((a,b) => b.target_amount-a.target_amount);
    } else if (sortBy === 'Name') {
      g = [...g].sort((a,b) => a.name.localeCompare(b.name));
    }
    return g;
  }, [rawGoals, filter, sortBy]);

  const totalTarget    = rawGoals.reduce((s,g) => s+parseFloat(g.target_amount||0), 0);
  const totalSaved     = rawGoals.reduce((s,g) => s+parseFloat(g.current_amount||0), 0);
  const overallPct     = totalTarget>0 ? Math.round((totalSaved/totalTarget)*100) : 0;
  const completedCt    = rawGoals.filter(g=>g.status==='Completed').length;
  const inProgressCt   = rawGoals.filter(g=>g.status==='In Progress').length;
  const pausedCt       = rawGoals.filter(g=>g.status==='Paused').length;
  const filterCounts   = { All:rawGoals.length, 'In Progress':inProgressCt, Completed:completedCt, Paused:pausedCt };
  const totalMonthly   = rawGoals.filter(g=>g.status!=='Completed').reduce((s,g)=>s+parseFloat(g.monthly_contribution||0), 0);
  const savedThisMonth = Math.round(totalMonthly*1.72);

  const deleteMutation = useMutation({
    mutationFn: (id) => goalsAPI.delete(id),
    onSuccess: () => invalidateFinance(qc),
  });

  if (isLoading) return <PageLoader />;

  const TAB_FILTERS = ['All','In Progress','Completed','Paused'];

  return (
    <div className={styles.page} style={{ background:t.bg }}>
      <motion.div className={styles.inner} variants={containerVar} initial="hidden" animate="show">

        {/* ── Header ── */}
        <motion.div className={styles.header} variants={cardVar}>
          <div>
            <h1 className={styles.h1} style={{ color:t.text }}>Goals</h1>
            <div className={styles.sub} style={{ color:t.text2 }}>Plan for your dreams. Achieve more.</div>
          </div>
          <div className={styles.headerBtns}>
            <button className={styles.circleBtn} style={{ background:t.cardBg, border:`1px solid ${t.border}` }}>
              <BarChart2 size={19} color={t.text2}/>
            </button>
            <motion.button className={styles.circleBtn} whileTap={{ scale:.9 }}
              style={{ background:'#4F46E5', border:'none', boxShadow:'0 8px 24px rgba(124,58,237,.35)' }}
              onClick={openAddGoal}>
              <Plus size={22} color="#fff"/>
            </motion.button>
          </div>
        </motion.div>

        {/* ── Overview card ── */}
        <motion.div className={styles.overview} variants={cardVar}
          style={{ background:t.flowBg, border:t.flowBorder, boxShadow:t.glowShadow }}>
          <div className={styles.overviewLeft}>
            <div style={{ fontSize:11.5, color:t.text2, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em' }}>Overall Progress</div>
            <div className={styles.bigPct} style={{ color:t.purple }}>{overallPct}%</div>
            <div style={{ fontSize:12.5, color:t.text3 }}>of total goals completed</div>
            <div className={styles.overviewStats}>
              <div>
                <div style={{ fontSize:10.5, color:t.text3, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>Total Goal Target</div>
                <div style={{ fontSize:16, fontWeight:800, color:t.text, fontFamily:'Inter,sans-serif', marginTop:2 }}>{fmtFull(totalTarget)}</div>
              </div>
              <div>
                <div style={{ fontSize:10.5, color:t.text3, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>Total Amount Saved</div>
                <div style={{ fontSize:16, fontWeight:800, color:t.green, fontFamily:'Inter,sans-serif', marginTop:2 }}>{fmtFull(totalSaved)}</div>
              </div>
            </div>
          </div>
          <div className={styles.overviewDonut}>
            <DonutChart pct={overallPct} size={156} stroke={13}
              color={t.purple} track={isDark?'rgba(79,70,229,.18)':'#EEE8FF'}
              label={fmtINR(totalSaved)} sublabel="Saved" labelColor={t.text} glow={isDark}/>
          </div>
        </motion.div>

        {/* ── Filters + sort ── */}
        <motion.div className={styles.filterRow} variants={cardVar}>
          <div className={styles.chips}>
            {TAB_FILTERS.map(key => {
              const active = filter === key;
              return (
                <motion.button key={key} whileTap={{ scale:.94 }} className={styles.chip}
                  style={{
                    background: active ? (isDark?'rgba(79,70,229,.18)':'#EEF0FF') : t.cardBg,
                    border: `1.5px solid ${active ? t.purple : t.border}`,
                    color: active ? (isDark?'#C4B5FD':t.purple) : t.text2,
                  }}
                  onClick={()=>setFilter(key)}>
                  {key} ({filterCounts[key]||0})
                </motion.button>
              );
            })}
          </div>
          <div style={{ position:'relative', flexShrink:0 }}>
            <button onClick={()=>setShowSort(v=>!v)} className={styles.sortBtn}
              style={{ background:t.cardBg, border:`1.5px solid ${t.border}`, color:t.text2 }}>
              <SlidersHorizontal size={14}/> {sortBy} <ChevronDown size={13}/>
            </button>
            {showSort && <div onClick={()=>setShowSort(false)} style={{ position:'fixed', inset:0, zIndex:49 }}/>}
            <AnimatePresence>
              {showSort && (
                <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                  style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:t.cardBg, border:`1px solid ${t.border}`, borderRadius:14, zIndex:50, minWidth:150, overflow:'hidden', boxShadow:t.cardShadow }}>
                  {['Priority','Progress','Amount','Name'].map(s => (
                    <button key={s} onClick={()=>{setSortBy(s);setShowSort(false);}}
                      style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 15px', background:sortBy===s?'rgba(79,70,229,.12)':'transparent', color:sortBy===s?(isDark?'#C4B5FD':t.purple):t.text2, border:'none', fontSize:12.5, fontWeight:sortBy===s?700:500, cursor:'pointer' }}>
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Main grid: goals list + motivation ── */}
        <div className={styles.grid}>

          {/* Goals card */}
          <motion.div className={styles.goalsCard} variants={cardVar}
            style={{ background:t.cardBg, border:`1px solid ${t.border}`, boxShadow:t.cardShadow }}>
            <div className={styles.cardHead}>
              <span style={{ fontSize:16, fontWeight:700, color:t.text }}>My Goals</span>
              <span style={{ fontSize:12.5, color:t.text3 }}>{filteredGoals.length} goal{filteredGoals.length!==1?'s':''}</span>
            </div>

            {filteredGoals.length === 0 ? (
              <div style={{ textAlign:'center', padding:'42px 20px' }}>
                <div style={{ fontSize:38, marginBottom:12 }}>🎯</div>
                <div style={{ fontSize:15, fontWeight:700, color:t.text }}>No {filter !== 'All' ? filter : ''} goals yet</div>
                <div style={{ fontSize:13, color:t.text3, marginTop:4 }}>Tap + to create one</div>
              </div>
            ) : filteredGoals.map((g, idx) => {
              const pct = Math.min(100, Math.round((parseFloat(g.current_amount)||0)/(parseFloat(g.target_amount)||1)*100));
              const isComplete = g.status==='Completed' || pct>=100;
              const badge = BADGE_CFG[isComplete?'Completed':g.priority] || BADGE_CFG.Medium;
              const barColor = isComplete ? t.green : (g.color || t.purple);
              const isDummy = String(g.id).startsWith('d');
              return (
                <motion.div key={g.id} className={styles.goalRow}
                  style={{ borderTop: idx>0 ? `1px solid ${t.divider}` : 'none' }}
                  initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} transition={{ delay:.2+idx*.06 }}>
                  <div className={styles.goalIcon} style={{ background:g.iconBg||t.purple, boxShadow:`0 4px 14px ${g.iconBg||t.purple}55` }}>
                    <span style={{ fontSize:24 }}>{g.emoji}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:15, fontWeight:700, color:t.text }}>{g.name}</span>
                      <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 9px', borderRadius:14, background:badge.bg, color:badge.color, whiteSpace:'nowrap' }}>{badge.text}</span>
                    </div>
                    {g.desc && <div style={{ fontSize:12, color:t.text3, marginTop:2 }}>{g.desc}</div>}
                    <div className={styles.goalTrack} style={{ background:t.track }}>
                      <motion.div style={{ height:'100%', borderRadius:999, background:barColor }}
                        initial={{ width:0 }} animate={{ width:`${pct}%` }}
                        transition={{ duration:.8, delay:.3+idx*.06, ease:[.2,.8,.2,1] }}/>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:5 }}>
                      <span style={{ fontSize:11.5, color:t.text3, fontFamily:'Inter,sans-serif' }}>
                        {fmtFull(g.current_amount)} / {fmtFull(g.target_amount)}
                      </span>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {!isComplete && !isDummy && (
                          <>
                            <button title="Edit" onClick={()=>{setEditGoal(g);setShowModal(true);}}
                              style={{ background:'transparent', border:'none', cursor:'pointer', padding:2, display:'flex' }}>
                              <Pencil size={13} color={t.text3}/>
                            </button>
                            <button title="Delete" onClick={()=>{if(window.confirm('Delete this goal?'))deleteMutation.mutate(g.id);}}
                              style={{ background:'transparent', border:'none', cursor:'pointer', padding:2, display:'flex' }}>
                              <Trash2 size={13} color={t.red}/>
                            </button>
                          </>
                        )}
                        {!isComplete && (
                          <button onClick={()=>!isDummy && setShowFunds(g)}
                            style={{ fontSize:11, fontWeight:700, padding:'4px 11px', borderRadius:10, border:'none', background:`${g.iconBg||'#4F46E5'}22`, color:g.iconBg||t.purple, cursor:'pointer', whiteSpace:'nowrap' }}>
                            + Add Funds
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ flexShrink:0, textAlign:'right' }}>
                    <span style={{ fontSize:15, fontWeight:800, color:barColor, fontFamily:'Inter,sans-serif' }}>{pct}%</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Motivation card */}
          <motion.div className={styles.motivCard} variants={cardVar}
            style={{ background:t.cardBg, border:`1px solid ${t.border}`, boxShadow:t.cardShadow }}>
            <span className={styles.spark} style={{ top:12, right:16, color: isDark?'rgba(52,211,153,.4)':'rgba(5,150,105,.4)' }}>✦</span>
            <span className={styles.spark} style={{ bottom:16, right:52, fontSize:8, color: isDark?'rgba(52,211,153,.25)':'rgba(5,150,105,.25)' }}>✦</span>

            <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}>
              <div className={styles.motivRing} style={{ border:`2.5px solid ${isDark?'rgba(52,211,153,.3)':'#A7F3D0'}` }}>
                <div className={styles.motivRingInner} style={{ background: isDark?'rgba(52,211,153,.12)':'rgba(5,150,105,.1)' }}>
                  <Rocket size={26} color={t.green}/>
                </div>
              </div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:800, color:t.text, marginBottom:4 }}>Keep going! 🚀</div>
              <div style={{ fontSize:12.5, color:t.text2, lineHeight:1.55 }}>
                You are <b style={{ color:t.green }}>{fmtINR(Math.abs(savedThisMonth - totalMonthly))}</b> ahead of your monthly savings target.
              </div>
            </div>

            <div className={styles.motivDivider} style={{ background:t.divider }}/>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { Icon:TargetIcon, label:'Monthly Target',   val:fmtFull(totalMonthly),   clr:t.text,  bg:'rgba(79,70,229,.14)', ic:t.purple },
                { Icon:Wallet,     label:'Saved This Month', val:fmtFull(savedThisMonth), clr:t.green, bg: isDark?'rgba(52,211,153,.12)':'rgba(5,150,105,.12)', ic:t.green },
              ].map(({ Icon, label, val, clr, bg, ic })=>(
                <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:11, background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Icon size={15} color={ic}/>
                    </div>
                    <span style={{ fontSize:12.5, color:t.text2 }}>{label}</span>
                  </div>
                  <span style={{ fontSize:14.5, fontWeight:800, color:clr, fontFamily:'Inter,sans-serif' }}>{val}</span>
                </div>
              ))}
            </div>

            <div className={styles.motivDivider} style={{ background:t.divider }}/>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:10.5, fontWeight:700, color:t.text3, textTransform:'uppercase', letterSpacing:'.06em' }}>Goal Breakdown</div>
              {[
                { label:'In Progress', count:inProgressCt, color:t.purple, bg:'rgba(79,70,229,.14)' },
                { label:'Completed',   count:completedCt,  color:t.green,  bg: isDark?'rgba(52,211,153,.12)':'rgba(5,150,105,.12)' },
                { label:'Paused',      count:pausedCt,     color:t.orange, bg:'rgba(217,119,6,.14)' },
              ].map(({ label, count, color, bg })=>(
                <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12.5, color:t.text2 }}>{label}</span>
                  <span style={{ fontSize:12.5, fontWeight:800, padding:'2px 11px', borderRadius:14, background:bg, color }}>{count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>


      </motion.div>

      {showModal && <GoalModal goal={editGoal} onClose={()=>{setShowModal(false);setEditGoal(null);}} onSaved={()=>{invalidateFinance(qc);setShowModal(false);setEditGoal(null);}}/>}
      {showFunds && <AddFundsModal goal={showFunds} onClose={()=>setShowFunds(null)} onSaved={()=>{invalidateFinance(qc);setShowFunds(null);}}/>}
    </div>
  );
}

function GoalModal({ goal, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:                goal?.name                || '',
    target_amount:       goal?.target_amount       || '',
    current_amount:      goal?.current_amount      || '',
    emoji:               goal?.emoji               || '🎯',
    color:               goal?.color               || '#4F46E5',
    target_date:         goal?.target_date ? goal.target_date.split('T')[0] : '',
    monthly_contribution:goal?.monthly_contribution|| '',
    priority:            goal?.priority            || 'Medium',
    desc:                goal?.desc                || '',
  });
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: (data) => goal ? goalsAPI.update(goal.id, data) : goalsAPI.create(data),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.message || 'Error saving goal'),
  });
  const submit = () => {
    if (!form.name.trim()) return setError('Please enter a goal name');
    if (!(parseFloat(form.target_amount) > 0)) return setError('Please enter a valid target amount');
    if (parseFloat(form.current_amount) > parseFloat(form.target_amount)) return setError("Saved amount can't exceed the target");
    setError('');
    mutation.mutate(form);
  };
  const COLORS = ['#4F46E5','#059669','#DC2626','#3B82F6','#D97706','#EF4444','#06B6D4','#10B981'];
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{goal ? 'Edit Goal' : 'New Goal'}</div>
        {error && <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'8px 12px', borderRadius:10, marginBottom:14, fontSize:13 }}>{error}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Goal Name</label>
            <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Emergency Fund"/>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Description</label>
            <input className="form-input" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="Short description"/>
          </div>
          <div className="form-group">
            <label className="form-label">Target Amount</label>
            <input className="form-input" type="number" min="0" value={form.target_amount} onChange={e=>setForm(f=>({...f,target_amount:e.target.value}))} placeholder="100000"/>
          </div>
          <div className="form-group">
            <label className="form-label">Already Saved</label>
            <input className="form-input" type="number" min="0" value={form.current_amount} onChange={e=>setForm(f=>({...f,current_amount:e.target.value}))} placeholder="0"/>
          </div>
          <div className="form-group">
            <label className="form-label">Monthly Contribution</label>
            <input className="form-input" type="number" min="0" value={form.monthly_contribution} onChange={e=>setForm(f=>({...f,monthly_contribution:e.target.value}))} placeholder="5000"/>
          </div>
          <div className="form-group">
            <label className="form-label">Target Date</label>
            <input className="form-input" type="date" value={form.target_date} onChange={e=>setForm(f=>({...f,target_date:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <ThemedSelect value={form.priority} onChange={v=>setForm(f=>({...f,priority:v}))}
              options={[
                { value:'High',   label:'High',   icon:<ChevronsUp size={16} color="#EF4444"/> },
                { value:'Medium', label:'Medium', icon:<Minus size={16} color="#D97706"/> },
                { value:'Low',    label:'Low',    icon:<ChevronsDown size={16} color="#059669"/> },
              ]}/>
          </div>
          <div className="form-group">
            <label className="form-label">Icon (emoji)</label>
            <input className="form-input" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} style={{ fontSize:20, textAlign:'center' }}/>
          </div>
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">Color</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              {COLORS.map(c=>(
                <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{ width:28, height:28, borderRadius:8, background:c, border:form.color===c?'3px solid var(--text)':'2px solid transparent', cursor:'pointer' }}/>
              ))}
              <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{ width:30, height:30, borderRadius:8, cursor:'pointer', border:'1px solid var(--border)', padding:2 }}/>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:16, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mutation.isPending} onClick={submit} style={{ background:'#4F46E5', border:'none' }}>
            {mutation.isPending ? 'Saving' : goal ? 'Update Goal' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddFundsModal({ goal, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const mutation = useMutation({
    mutationFn: () => goalsAPI.addFunds(goal.id, parseFloat(amount)),
    onSuccess: onSaved,
  });
  const pct = Math.min(100, Math.round((parseFloat(goal.current_amount)||0)/(parseFloat(goal.target_amount)||1)*100));
  const clr = goal.color || '#4F46E5';
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:400 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:clr+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{goal.emoji}</div>
          <div className="modal-title" style={{ margin:0 }}>Add Funds — {goal.name}</div>
        </div>
        <div style={{ background:'var(--surface2)', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text3)', marginBottom:8 }}>
            <span>{fmtFull(goal.current_amount)} saved</span><span>{fmtFull(goal.target_amount)} target</span>
          </div>
          <div style={{ height:8, borderRadius:100, background:'var(--surface)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`, borderRadius:100, background:clr }}/>
          </div>
          <div style={{ textAlign:'right', fontSize:12, fontWeight:700, color:clr, marginTop:5 }}>{pct}%</div>
        </div>
        <div className="form-group">
          <label className="form-label">Amount to Add</label>
          <input className="form-input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="5000" autoFocus style={{ fontSize:18, fontWeight:700 }}/>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mutation.isPending||!amount} onClick={()=>mutation.mutate()} style={{ background:`linear-gradient(135deg,${clr},${clr}dd)`, border:'none' }}>
            {mutation.isPending ? 'Adding' : 'Add Funds'}
          </button>
        </div>
      </div>
    </div>
  );
}
