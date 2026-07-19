import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesAPI } from '../services/api';
import { Topbar, EmptyState, PageLoader } from '../components/ui';
import { Plus, Tag } from 'lucide-react';
import useAuthStore from '../store/authStore';
import usePremiumStore from '../store/premiumStore';

const FREE_CATEGORY_LIMIT = 5;

const TYPE_OPTS = [
  { value:'income',  label:'Income',  color:'#22C55E', bg:'rgba(34,197,94,.12)'  },
  { value:'expense', label:'Expense', color:'#EC4899', bg:'rgba(236,72,153,.12)'   },
  { value:'both',    label:'Both',    color:'#8B5CF6', bg:'rgba(139,92,246,.12)'  },
];

const PRESET_COLORS = [
  '#8B5CF6','#3B82F6','#A29BFE','#22C55E','#00C896',
  '#F59E0B','#EC4899','#FF79A8','#74b9ff','#00CEC9',
  '#E17055','#FDCB6E','#6AB04C','#636E72','#2D3436',
];

export default function Categories() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { openPremium } = usePremiumStore();
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [filterType, setFilterType] = useState('all');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesAPI.getAll().then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => categoriesAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  if (isLoading) return <PageLoader />;

  const filtered  = (categories||[]).filter(c => filterType === 'all' ? true : c.type === filterType);
  const custom    = filtered.filter(c => !c.is_default);
  const defaults  = filtered.filter(c => c.is_default);
  // Count all custom categories regardless of filter for the limit check
  const customAll = (categories||[]).filter(c => !c.is_default);
  const atCatLimit = !user?.is_premium && customAll.length >= FREE_CATEGORY_LIMIT;
  const openAddCat = () => atCatLimit ? openPremium() : (setEditCat(null), setShowModal(true));

  const totalIncome  = (categories||[]).filter(c=>c.type==='income'||c.type==='both').length;
  const totalExpense = (categories||[]).filter(c=>c.type==='expense'||c.type==='both').length;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>

      {/* Mobile header */}
      <div className="mob-header">
        <div>
          <div className="mob-header-title">Categories</div>
          <div className="mob-header-sub">Manage your spending categories</div>
        </div>
      </div>

      {/* Desktop topbar */}
      <div className="mob-hide">
        <Topbar title="Categories" subtitle="Organise your income & expense categories">
          <button className="btn btn-primary btn-sm"
            style={{ display:'flex', alignItems:'center', gap:6, background: atCatLimit ? 'linear-gradient(135deg,#F59E0B,#FF79A8)' : 'linear-gradient(135deg,#8B5CF6,#3B82F6)', border:'none', boxShadow:'0 4px 14px rgba(139,92,246,.35)' }}
            onClick={openAddCat}>
            {atCatLimit ? '👑 Upgrade' : <><Plus size={13}/> New Category</>}
          </button>
        </Topbar>
      </div>

      <div className="mob-content" style={{ padding:'28px 32px 40px', flex:1, overflow:'auto' }}>

        {/* Summary */}
        <div className="mob-summary-scroll" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
          {[
            { label:'Total Categories', value:(categories||[]).length, icon:<Tag size={22} color="#8B5CF6"/>,      bg:'rgba(139,92,246,.1)' },
            { label:'Income Types',     value:totalIncome,             icon:<span style={{fontSize:22}}>📥</span>, bg:'rgba(34,197,94,.1)' },
            { label:'Expense Types',    value:totalExpense,            icon:<span style={{fontSize:22}}>📤</span>, bg:'rgba(236,72,153,.1)' },
          ].map(({ label, value, icon, bg }) => (
            <div key={label} style={{
              background:'var(--surface)', borderRadius:20, padding:'16px 14px',
              boxShadow:'0 4px 24px rgba(139,92,246,.08)', border:'1px solid var(--border-light)',
              display:'flex', alignItems:'center', gap:12,
            }}>
              <div style={{ width:44, height:44, borderRadius:13, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {icon}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:'var(--text)' }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="mob-chips" style={{ display:'flex', gap:8, marginBottom:22 }}>
          {[{v:'all',l:'All Types'}, {v:'income',l:'Income'}, {v:'expense',l:'Expense'}, {v:'both',l:'Both'}].map(({ v, l }) => (
            <button key={v} onClick={() => setFilterType(v)}
              style={{
                padding:'7px 16px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer',
                border: filterType===v ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                background: filterType===v ? 'var(--accent-light)' : 'var(--surface)',
                color: filterType===v ? 'var(--accent)' : 'var(--text3)',
                transition:'all .15s', whiteSpace:'nowrap',
              }}>
              {l}
            </button>
          ))}
        </div>

        {/* Custom categories */}
        <div style={{ marginBottom:32 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em' }}>
              Your Custom Categories
            </div>
            <span style={{ background: atCatLimit ? 'rgba(245,158,11,.15)' : 'var(--accent-light)', color: atCatLimit ? '#F59E0B' : 'var(--accent)', fontSize:11, fontWeight:700, borderRadius:20, padding:'2px 8px' }}>
              {customAll.length}{!user?.is_premium ? ` / ${FREE_CATEGORY_LIMIT}` : ''}
            </span>
          </div>

          {/* Free-tier limit banner */}
          {!user?.is_premium && (
            <div style={{
              display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderRadius:14, marginBottom:14,
              background: atCatLimit ? 'rgba(245,158,11,.1)' : 'rgba(139,92,246,.06)',
              border: atCatLimit ? '1px solid rgba(245,158,11,.35)' : '1px solid rgba(139,92,246,.15)',
            }}>
              <span style={{ fontSize:18 }}>{atCatLimit ? '🔒' : '🏷️'}</span>
              <span style={{ fontSize:13, color:'var(--text2)', flex:1 }}>
                {atCatLimit
                  ? <><strong style={{color:'#F59E0B'}}>Limit reached</strong> — Free plan allows {FREE_CATEGORY_LIMIT} custom categories.</>
                  : <>{customAll.length} / {FREE_CATEGORY_LIMIT} custom categories used on free plan.</>}
              </span>
              {atCatLimit && (
                <button onClick={openPremium}
                  style={{ fontSize:12, fontWeight:700, padding:'5px 14px', borderRadius:20, background:'linear-gradient(135deg,#F59E0B,#FF79A8)', border:'none', color:'#fff', cursor:'pointer', whiteSpace:'nowrap' }}>
                  Upgrade →
                </button>
              )}
            </div>
          )}

          {custom.length === 0 ? (
            <div style={{ background:'var(--surface)', borderRadius:20, boxShadow:'0 4px 24px rgba(139,92,246,.08)', border:'1px solid var(--border-light)' }}>
              <EmptyState icon="🏷️" title="No custom categories yet"
                description="Create categories tailored to your spending habits"
                action={<button className="btn btn-primary" onClick={openAddCat}
                  style={{ background:'linear-gradient(135deg,#8B5CF6,#3B82F6)', border:'none' }}>
                  Add First Category
                </button>}/>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
              {custom.map(cat => (
                <CategoryCard key={cat.id} cat={cat}
                  onEdit={() => { setEditCat(cat); setShowModal(true); }}
                  onDelete={() => { if(confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id); }}/>
              ))}
            </div>
          )}
        </div>

        {/* Default categories */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em' }}>
              Default Categories
            </div>
            <span style={{ background:'var(--surface3)', color:'var(--text3)', fontSize:11, fontWeight:700, borderRadius:20, padding:'2px 8px' }}>
              {defaults.length}
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
            {defaults.map(cat => <CategoryCard key={cat.id} cat={cat} readOnly/>)}
          </div>
        </div>
      </div>

      {showModal && (
        <CategoryModal
          cat={editCat}
          onClose={() => { setShowModal(false); setEditCat(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey:['categories'] }); setShowModal(false); setEditCat(null); }}
        />
      )}

      {/* Mobile FAB */}
      <button className="mob-fab" onClick={openAddCat}>
        <Plus size={26} color="#fff"/>
      </button>
    </div>
  );
}

function CategoryCard({ cat, onEdit, onDelete, readOnly }) {
  const typeMap = {
    income:  { label:'Income',  bg:'rgba(34,197,94,.12)',  color:'#22C55E' },
    expense: { label:'Expense', bg:'rgba(236,72,153,.12)',   color:'#EC4899' },
    both:    { label:'Both',    bg:'rgba(139,92,246,.12)',  color:'var(--accent)' },
  };
  const tmap = typeMap[cat.type] || typeMap.both;

  return (
    <div style={{
      background:'var(--surface)', borderRadius:18, padding:'16px 18px',
      boxShadow:'0 4px 20px rgba(139,92,246,.07)', border:'1px solid var(--border-light)',
      display:'flex', alignItems:'center', gap:12,
      opacity: readOnly ? 0.8 : 1,
      position:'relative', overflow:'hidden',
      transition:'all .2s ease',
    }}
    onMouseEnter={e => !readOnly && (e.currentTarget.style.transform='translateY(-2px)')}
    onMouseLeave={e => (e.currentTarget.style.transform='')}>

      <div style={{
        width:42, height:42, borderRadius:13,
        background:(cat.color||'#8B5CF6')+'20',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:20, flexShrink:0,
      }}>
        {cat.emoji}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:13.5, color:'var(--text)', marginBottom:4, lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {cat.name}
        </div>
        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:tmap.bg, color:tmap.color, fontWeight:700 }}>
          {tmap.label}
        </span>
      </div>

      {!readOnly ? (
        <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
          <button onClick={onEdit} title="Edit"
            style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', padding:'4px 6px', fontSize:11 }}>✏️</button>
          <button onClick={onDelete} title="Delete"
            style={{ background:'var(--red-light)', border:'1px solid rgba(236,72,153,.2)', borderRadius:7, cursor:'pointer', padding:'4px 6px', fontSize:11 }}>🗑️</button>
        </div>
      ) : (
        <span style={{ fontSize:10, color:'var(--text3)', background:'var(--surface2)', borderRadius:8, padding:'3px 8px', flexShrink:0, fontWeight:600 }}>
          default
        </span>
      )}
    </div>
  );
}

function CategoryModal({ cat, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:  cat?.name  || '',
    type:  cat?.type  || 'expense',
    emoji: cat?.emoji || '📌',
    color: cat?.color || '#8B5CF6',
  });
  const [error, setError] = useState('');

  const { openPremium: openCatPremium } = usePremiumStore();
  const mutation = useMutation({
    mutationFn: (data) => cat ? categoriesAPI.update(cat.id,data) : categoriesAPI.create(data),
    onSuccess: onSaved,
    onError: (e) => {
      if (e.response?.status === 403) { onClose(); openCatPremium(); return; }
      setError(e.response?.data?.message || 'Error saving category');
    },
  });

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:440 }}>
        <div className="modal-title">{cat ? 'Edit' : 'New'} Category</div>
        {error && <div style={{ background:'var(--red-light)', color:'var(--red)', padding:'8px 12px', borderRadius:10, marginBottom:14, fontSize:13 }}>{error}</div>}

        <div className="form-group">
          <label className="form-label">Category Name</label>
          <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
            placeholder="e.g. Gym, Petrol, Freelance..." autoFocus/>
        </div>

        {/* Type selector */}
        <div className="form-group">
          <label className="form-label">Type</label>
          <div style={{ display:'flex', gap:8 }}>
            {TYPE_OPTS.map(t => (
              <button key={t.value} onClick={() => setForm(f=>({...f,type:t.value}))}
                style={{
                  flex:1, padding:'9px', borderRadius:10, fontSize:13, fontWeight:600,
                  border: form.type===t.value ? `1.5px solid ${t.color}` : '1.5px solid var(--border)',
                  background: form.type===t.value ? t.bg : 'var(--surface)',
                  color: form.type===t.value ? t.color : 'var(--text3)',
                  cursor:'pointer', transition:'all .15s',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group">
            <label className="form-label">Emoji</label>
            <input className="form-input" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))}
              placeholder="📌" style={{ fontSize:24, textAlign:'center' }}/>
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {PRESET_COLORS.slice(0,10).map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  style={{ width:24, height:24, borderRadius:6, background:c, border: form.color===c ? '3px solid var(--text)' : '2px solid transparent', cursor:'pointer', outline:'none' }}/>
              ))}
              <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                style={{ width:26, height:26, borderRadius:6, cursor:'pointer', border:'1px solid var(--border)', padding:1 }}/>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div style={{ background:'var(--surface2)', borderRadius:14, padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:13, background:form.color+'20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
            {form.emoji}
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{form.name || 'Category Preview'}</div>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: TYPE_OPTS.find(t=>t.value===form.type)?.bg, color: TYPE_OPTS.find(t=>t.value===form.type)?.color, fontWeight:700 }}>
              {TYPE_OPTS.find(t=>t.value===form.type)?.label}
            </span>
          </div>
          <div style={{ marginLeft:'auto', width:14, height:14, borderRadius:'50%', background:form.color, boxShadow:`0 0 8px ${form.color}66` }}/>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={mutation.isPending||!form.name.trim()} onClick={()=>mutation.mutate(form)}
            style={{ background:'linear-gradient(135deg,#8B5CF6,#3B82F6)', border:'none', boxShadow:'0 4px 14px rgba(139,92,246,.35)' }}>
            {mutation.isPending ? 'Saving…' : cat ? 'Update Category' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  );
}
