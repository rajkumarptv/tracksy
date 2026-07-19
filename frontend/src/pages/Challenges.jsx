import { useState, useEffect } from 'react';
import { Trophy, Flame, Star, Zap, Target, Heart, Plus, X, CheckCircle, Calendar, TrendingUp } from 'lucide-react';
import { Topbar } from '../components/ui';
import { useFmt } from '../i18n';

const STORAGE_KEY = 'tracksy_challenges';
const BADGE_KEY   = 'tracksy_badges';

/* ── Challenge Templates ── */
const TEMPLATES = [
  {
    id:'52week', title:'52-Week Savings Challenge', emoji:'📅', color:'#8B5CF6', bg:'rgba(139,92,246,.12)',
    desc:'Save increasing amounts each week — ₹100 week 1, ₹200 week 2... up to ₹5,200 in week 52.',
    target: 52*(52+1)/2*100, // ₹1,37,800
    category:'savings', duration:52, unit:'weeks',
    milestones:[{ at:13, label:'Quarter done! 🌱' },{ at:26, label:'Halfway there! 🎯' },{ at:39, label:'75% complete! 🔥' },{ at:52, label:'Challenge Complete! 🏆' }],
  },
  {
    id:'nospend', title:'No-Spend Challenge', emoji:'🚫', color:'#EC4899', bg:'rgba(236,72,153,.12)',
    desc:'Avoid all non-essential spending for 30 days. Only pay for necessities.',
    target:30, category:'discipline', duration:30, unit:'days',
    milestones:[{ at:7, label:'1 week strong! 💪' },{ at:14, label:'2 weeks done! 🌟' },{ at:30, label:'30-day champion! 🏆' }],
  },
  {
    id:'emergency', title:'Emergency Fund Challenge', emoji:'🛡️', color:'#22C55E', bg:'rgba(34,197,94,.12)',
    desc:'Build a 3-month emergency fund. Save consistently until you reach your goal.',
    target: 0, // user sets it
    category:'savings', duration:90, unit:'days',
    milestones:[{ at:25, label:'Foundation set! 🏗️' },{ at:50, label:'Halfway built! 🔨' },{ at:100, label:'Emergency fund ready! 🛡️' }],
    customTarget:true,
  },
  {
    id:'vacation', title:'Vacation Savings Challenge', emoji:'✈️', color:'#3B82F6', bg:'rgba(59,130,246,.12)',
    desc:'Save for your dream vacation. Set your target and save every week until you get there.',
    target: 0, // user sets it
    category:'goal', duration:52, unit:'weeks',
    milestones:[{ at:25, label:'25% of the way! 🗺️' },{ at:50, label:'Halfway to paradise! 🌴' },{ at:75, label:'Almost there! ✈️' },{ at:100, label:'Bon voyage! 🎉' }],
    customTarget:true,
  },
  {
    id:'roundup', title:'Round-Up Savings Challenge', emoji:'🪙', color:'#F59E0B', bg:'rgba(245,158,11,.12)',
    desc:'Round up every purchase to the nearest ₹100 and save the difference. Small amounts add up!',
    target: 12000,
    category:'savings', duration:365, unit:'days',
    milestones:[{ at:25, label:'₹3,000 saved! 💰' },{ at:50, label:'₹6,000 saved! 💎' },{ at:100, label:'₹12,000 round-up champion! 🏆' }],
  },
  {
    id:'custom', title:'Custom Challenge', emoji:'⭐', color:'#A29BFE', bg:'rgba(162,155,254,.12)',
    desc:'Create your own savings challenge with a custom goal and timeline.',
    target:0, category:'custom', duration:30, unit:'days',
    customTarget:true, customTitle:true,
  },
];

const BADGES = [
  { id:'first_start',  emoji:'🌱', label:'First Step',       desc:'Started your first challenge' },
  { id:'week1',        emoji:'7️⃣',  label:'7-Day Streak',     desc:'7 consecutive check-ins' },
  { id:'month1',       emoji:'📅', label:'Month Strong',      desc:'30-day streak' },
  { id:'halfway',      emoji:'🎯', label:'Halfway Hero',      desc:'Reached 50% on any challenge' },
  { id:'first_complete',emoji:'🏆', label:'Champion',         desc:'Completed a full challenge' },
  { id:'saver',        emoji:'💰', label:'Super Saver',       desc:'Saved ₹10,000+ in challenges' },
  { id:'multi',        emoji:'⚡', label:'Multi-Challenger',  desc:'Running 3 challenges at once' },
  { id:'streak30',     emoji:'🔥', label:'On Fire',           desc:'30-day check-in streak' },
];

function loadData() {
  try { return { challenges: JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'), badges: JSON.parse(localStorage.getItem(BADGE_KEY)||'[]') }; }
  catch { return { challenges:[], badges:[] }; }
}

function genId() { return Math.random().toString(36).slice(2,10); }

function progressPct(c) {
  if (!c.target || c.target <= 0) return 0;
  return Math.min(100, Math.round((c.saved / c.target) * 100));
}

/* ── Level system ── */
function userLevel(totalSaved, completedCount) {
  const pts = totalSaved / 100 + completedCount * 500;
  if (pts >= 5000) return { level:5, title:'Finance Master', color:'#F59E0B', emoji:'👑' };
  if (pts >= 2000) return { level:4, title:'Savings Pro',    color:'#8B5CF6', emoji:'💎' };
  if (pts >= 800)  return { level:3, title:'Goal Getter',    color:'#22C55E', emoji:'🎯' };
  if (pts >= 200)  return { level:2, title:'Saver',          color:'#3B82F6', emoji:'⭐' };
  return { level:1, title:'Beginner',       color:'#A29BFE', emoji:'🌱' };
}

export default function Challenges() {
  const fmt = useFmt();
  const [data, setData] = useState(loadData);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customForm, setCustomForm] = useState({ title:'', target:'', duration:'30', unit:'days' });
  const [celebrate, setCelebrate] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

  const { challenges, badges } = data;

  function persist(newChallenges, newBadges) {
    const d = { challenges: newChallenges ?? challenges, badges: newBadges ?? badges };
    setData(d);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d.challenges));
    localStorage.setItem(BADGE_KEY, JSON.stringify(d.badges));
  }

  function awardBadge(id) {
    if (badges.includes(id)) return badges;
    const nb = [...badges, id];
    return nb;
  }

  function startChallenge(template) {
    const t = template.customTarget ? parseFloat(customForm.target) || 10000 : template.target;
    const title = template.customTitle ? customForm.title || template.title : template.title;
    const newC = {
      id: genId(), templateId: template.id, title, emoji: template.emoji,
      color: template.color, bg: template.bg, desc: template.desc,
      target: t, saved: 0, duration: parseInt(customForm.duration)||template.duration,
      unit: template.unit, startDate: new Date().toISOString().split('T')[0],
      checkIns: [], completed: false, milestones: template.milestones || [],
      category: template.category,
    };
    let nb = awardBadge('first_start');
    const active = challenges.filter(c=>!c.completed);
    if (active.length >= 2) nb = awardBadge('multi');
    persist([...challenges, newC], nb);
    setShowAdd(false);
    setSelectedTemplate(null);
    setCustomForm({ title:'', target:'', duration:'30', unit:'days' });
  }

  function checkIn(id, amount = 0) {
    const today = new Date().toISOString().split('T')[0];
    const updated = challenges.map(c => {
      if (c.id !== id) return c;
      if (c.checkIns.includes(today)) return c; // already checked in today
      const newSaved = c.saved + parseFloat(amount || 0);
      const pct = c.target > 0 ? (newSaved / c.target) * 100 : 0;
      const completed = pct >= 100;
      if (completed) setCelebrate(c.title);
      return { ...c, saved: newSaved, checkIns: [...c.checkIns, today], completed };
    });
    let nb = [...badges];
    const streak = getStreak(updated.find(c=>c.id===id)?.checkIns||[]);
    if (streak >= 7) nb = [...new Set([...nb, 'week1'])];
    if (streak >= 30) nb = [...new Set([...nb, 'month1', 'streak30'])];
    const totalSaved = updated.reduce((s,c)=>s+c.saved,0);
    if (totalSaved >= 10000) nb = [...new Set([...nb, 'saver'])];
    if (updated.find(c=>c.id===id)?.completed) nb = [...new Set([...nb, 'first_complete'])];
    persist(updated, nb);
  }

  function deleteChallenge(id) { persist(challenges.filter(c=>c.id!==id)); }

  function getStreak(checkIns) {
    if (!checkIns.length) return 0;
    const sorted = [...checkIns].sort().reverse();
    let streak = 0;
    let d = new Date();
    for (const ci of sorted) {
      const diff = Math.floor((d - new Date(ci)) / 86400000);
      if (diff <= 1) { streak++; d = new Date(ci); }
      else break;
    }
    return streak;
  }

  const totalSaved    = challenges.reduce((s,c)=>s+c.saved,0);
  const completedCount = challenges.filter(c=>c.completed).length;
  const activeChallenges = challenges.filter(c=>!c.completed);
  const lvl = userLevel(totalSaved, completedCount);

  const displayed = activeTab === 'active'
    ? challenges.filter(c=>!c.completed)
    : activeTab === 'completed'
      ? challenges.filter(c=>c.completed)
      : challenges;

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <Topbar title="Savings Challenges" subtitle="Build better financial habits with fun, gamified challenges"/>

      <div style={{ padding:'24px 28px 40px', flex:1, overflow:'auto' }}>

        {/* ── Level Banner ── */}
        <div style={{ background:`linear-gradient(135deg, ${lvl.color}22, ${lvl.color}10)`, borderRadius:18, padding:'20px 24px', border:`1px solid ${lvl.color}33`, marginBottom:22, display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
          <div style={{ fontSize:44, flexShrink:0 }}>{lvl.emoji}</div>
          <div style={{ flex:1, minWidth:160 }}>
            <div style={{ fontSize:11, fontWeight:700, color:lvl.color, textTransform:'uppercase', letterSpacing:'.06em' }}>Level {lvl.level}</div>
            <div style={{ fontSize:20, fontWeight:900, color:'var(--text)', marginBottom:4 }}>{lvl.title}</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>{activeChallenges.length} active · {completedCount} completed · {badges.length} badges</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:2 }}>Total Saved</div>
            <div style={{ fontSize:24, fontWeight:900, color:lvl.color, fontFamily:'Space Grotesk,sans-serif' }}>{fmt(totalSaved,{noDecimals:true})}</div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { icon:<Flame size={22} color="#EC4899"/>, iconBg:'rgba(236,72,153,.14)', label:'Active',    value:`${activeChallenges.length}` },
            { icon:<Trophy size={22} color="#F59E0B"/>, iconBg:'rgba(245,158,11,.14)', label:'Completed', value:`${completedCount}` },
            { icon:<Star size={22} color="#8B5CF6"/>  , iconBg:'rgba(139,92,246,.14)', label:'Badges',    value:`${badges.length} / ${BADGES.length}` },
            { icon:<TrendingUp size={22} color="#22C55E"/>, iconBg:'rgba(34,197,94,.14)', label:'Streak', value:`${getStreak(challenges.flatMap(c=>c.checkIns))}d 🔥` },
          ].map(({ icon, iconBg, label, value })=>(
            <div key={label} style={{ background:'var(--surface)', borderRadius:16, padding:'16px 18px', border:'1px solid var(--border-light)', boxShadow:'0 2px 12px rgba(0,0,0,.05)', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
              <div>
                <div style={{ fontSize:11.5, color:'var(--text3)', fontWeight:500 }}>{label}</div>
                <div style={{ fontSize:20, fontWeight:900, color:'var(--text)', fontFamily:'Space Grotesk,sans-serif' }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs + Add Button ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', gap:8 }}>
            {[{ v:'active', l:'Active' },{ v:'completed', l:'Completed' },{ v:'all', l:'All' }].map(({ v, l })=>(
              <button key={v} onClick={()=>setActiveTab(v)}
                style={{ padding:'7px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', border: activeTab===v?'1.5px solid var(--accent)':'1.5px solid var(--border)', background: activeTab===v?'var(--accent-light)':'var(--surface)', color: activeTab===v?'var(--accent)':'var(--text3)', transition:'all .15s' }}>
                {l}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" style={{ display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#8B5CF6,#3B82F6)', border:'none' }} onClick={()=>setShowAdd(true)}>
            <Plus size={13}/> New Challenge
          </button>
        </div>

        {/* ── Challenge Cards ── */}
        {displayed.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text3)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎯</div>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--text)', marginBottom:6 }}>No challenges yet</div>
            <div style={{ fontSize:13, marginBottom:20 }}>Start a savings challenge to build better financial habits!</div>
            <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>Start a Challenge</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
            {displayed.map(c=>{
              const pct = progressPct(c);
              const streak = getStreak(c.checkIns);
              const today = new Date().toISOString().split('T')[0];
              const checkedToday = c.checkIns.includes(today);
              const nextMilestone = c.milestones?.find(m => pct < m.at);
              const [checkAmt, setCheckAmt] = useState('');
              return (
                <div key={c.id} style={{ background:'var(--surface)', borderRadius:20, padding:'20px 22px', border:`1.5px solid ${c.completed?'rgba(34,197,94,.3)':'var(--border-light)'}`, boxShadow:'0 2px 16px rgba(0,0,0,.06)', position:'relative', overflow:'hidden' }}>
                  {/* Delete */}
                  <button onClick={()=>deleteChallenge(c.id)}
                    style={{ position:'absolute', top:14, right:14, background:'var(--surface2)', border:'none', borderRadius:8, padding:'4px 6px', cursor:'pointer', color:'var(--text3)' }}>
                    <X size={12}/>
                  </button>

                  {/* Header */}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
                    <div style={{ width:46, height:46, borderRadius:14, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{c.emoji}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:24 }}>{c.title}</div>
                      <div style={{ display:'flex', gap:8, marginTop:4 }}>
                        {streak > 0 && <span style={{ fontSize:11, fontWeight:700, color:'#EC4899', background:'rgba(236,72,153,.1)', borderRadius:7, padding:'2px 8px' }}>🔥 {streak}d streak</span>}
                        {c.completed && <span style={{ fontSize:11, fontWeight:700, color:'#22C55E', background:'rgba(34,197,94,.12)', borderRadius:7, padding:'2px 8px' }}>✓ Completed</span>}
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:12, color:'var(--text3)' }}>{fmt(c.saved,{noDecimals:true})} saved</span>
                      <span style={{ fontSize:12, fontWeight:700, color: c.color }}>{pct}%</span>
                    </div>
                    <div style={{ height:9, background:'var(--surface3)', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${c.color},${c.color}bb)`, borderRadius:20, transition:'width .6s ease' }}/>
                    </div>
                    {c.target > 0 && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>Target: {fmt(c.target,{noDecimals:true})}</div>}
                  </div>

                  {/* Next Milestone */}
                  {nextMilestone && (
                    <div style={{ background:'var(--surface2)', borderRadius:11, padding:'8px 12px', marginBottom:12, fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:6 }}>
                      <Target size={12} color="var(--accent)"/>
                      <span>Next: {nextMilestone.label} at {nextMilestone.at}%</span>
                    </div>
                  )}

                  {/* Check In */}
                  {!c.completed && (
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {c.target > 0 && (
                        <input type="number" value={checkAmt} onChange={e=>setCheckAmt(e.target.value)} placeholder="₹ amount"
                          style={{ flex:1, padding:'8px 12px', borderRadius:10, border:'1.5px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:13, outline:'none' }}/>
                      )}
                      <button
                        onClick={()=>{ checkIn(c.id, c.target > 0 ? checkAmt : 0); setCheckAmt(''); }}
                        disabled={checkedToday}
                        style={{ padding:'8px 16px', borderRadius:10, fontSize:12.5, fontWeight:700, cursor: checkedToday?'default':'pointer', border:'none', background: checkedToday?'var(--surface3)':c.color, color: checkedToday?'var(--text3)':'#fff', whiteSpace:'nowrap', opacity: checkedToday ? 0.7 : 1 }}>
                        {checkedToday ? '✓ Done today' : '+ Check In'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Badges ── */}
        <div style={{ marginTop:32 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:14 }}>🏅 Achievement Badges</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
            {BADGES.map(b=>{
              const earned = badges.includes(b.id);
              return (
                <div key={b.id} style={{ background: earned?'var(--surface)':'var(--surface2)', borderRadius:14, padding:'14px 14px', border:`1.5px solid ${earned?'rgba(139,92,246,.25)':'var(--border-light)'}`, textAlign:'center', opacity: earned?1:0.5, transition:'all .2s' }}>
                  <div style={{ fontSize:28, marginBottom:6, filter: earned?'none':'grayscale(1)' }}>{b.emoji}</div>
                  <div style={{ fontSize:12, fontWeight:700, color: earned?'var(--text)':'var(--text3)' }}>{b.label}</div>
                  <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:3, lineHeight:1.3 }}>{b.desc}</div>
                  {earned && <div style={{ fontSize:10, fontWeight:700, color:'#22C55E', marginTop:6 }}>✓ Earned</div>}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Add Challenge Modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div className="modal-title" style={{ margin:0 }}>Choose a Challenge</div>
              <button onClick={()=>{setShowAdd(false);setSelectedTemplate(null);}} style={{ background:'none', border:'none', fontSize:22, color:'var(--text3)', cursor:'pointer' }}>×</button>
            </div>
            {!selectedTemplate ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {TEMPLATES.map(t=>(
                  <div key={t.id} onClick={()=>setSelectedTemplate(t)}
                    style={{ background:t.bg, borderRadius:14, padding:'16px', border:`1.5px solid ${t.color}33`, cursor:'pointer', transition:'all .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                    <div style={{ fontSize:26, marginBottom:8 }}>{t.emoji}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{t.title}</div>
                    <div style={{ fontSize:11.5, color:'var(--text3)', lineHeight:1.4 }}>{t.desc}</div>
                    {t.target > 0 && !t.customTarget && (
                      <div style={{ fontSize:12, fontWeight:700, color:t.color, marginTop:8 }}>Goal: ₹{t.target.toLocaleString('en-IN')}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <button onClick={()=>setSelectedTemplate(null)} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, fontWeight:600, marginBottom:16, padding:0 }}>← Back</button>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, padding:'14px', background:selectedTemplate.bg, borderRadius:14 }}>
                  <span style={{ fontSize:32 }}>{selectedTemplate.emoji}</span>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>{selectedTemplate.title}</div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{selectedTemplate.desc}</div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {selectedTemplate.customTitle && (
                    <div>
                      <label className="form-label">Challenge Name</label>
                      <input className="form-input" value={customForm.title} onChange={e=>setCustomForm(f=>({...f,title:e.target.value}))} placeholder="My savings challenge"/>
                    </div>
                  )}
                  {selectedTemplate.customTarget && (
                    <div>
                      <label className="form-label">Target Amount (₹)</label>
                      <input className="form-input" type="number" value={customForm.target} onChange={e=>setCustomForm(f=>({...f,target:e.target.value}))} placeholder="e.g. 50000"/>
                    </div>
                  )}
                  <div>
                    <label className="form-label">Duration ({selectedTemplate.unit})</label>
                    <input className="form-input" type="number" value={customForm.duration} onChange={e=>setCustomForm(f=>({...f,duration:e.target.value}))} placeholder={String(selectedTemplate.duration)}/>
                  </div>
                  <div style={{ display:'flex', gap:10, marginTop:8 }}>
                    <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setSelectedTemplate(null)}>Back</button>
                    <button className="btn btn-primary" style={{ flex:1, background:`linear-gradient(135deg,${selectedTemplate.color},${selectedTemplate.color}cc)`, border:'none' }}
                      onClick={()=>startChallenge(selectedTemplate)}>
                      Start Challenge 🚀
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Celebration Modal ── */}
      {celebrate && (
        <div className="modal-overlay" onClick={()=>setCelebrate(null)}>
          <div className="modal" style={{ maxWidth:380, textAlign:'center' }}>
            <div style={{ fontSize:64, marginBottom:12 }}>🏆</div>
            <div style={{ fontSize:24, fontWeight:900, color:'var(--text)', marginBottom:8 }}>Challenge Complete!</div>
            <div style={{ fontSize:14, color:'var(--text3)', marginBottom:20 }}>You completed <strong>{celebrate}</strong>! Amazing work! 🎉</div>
            <button className="btn btn-primary" onClick={()=>setCelebrate(null)}>Celebrate! 🎊</button>
          </div>
        </div>
      )}
    </div>
  );
}
