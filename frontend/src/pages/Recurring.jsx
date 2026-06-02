import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, RefreshCw, Calendar, Repeat } from 'lucide-react';
import { recurringAPI, walletsAPI, categoriesAPI } from '../services/api';
import { Topbar } from '../components/ui';
import { useFmt, useT } from '../i18n';

const FREQ_COLORS = {
  daily:   { bg: 'rgba(91,140,255,.12)',  color: '#5B8CFF' },
  weekly:  { bg: 'rgba(55,214,122,.12)', color: '#37D67A' },
  monthly: { bg: 'rgba(108,99,255,.12)', color: '#6C63FF' },
  yearly:  { bg: 'rgba(255,184,77,.12)', color: '#FFB84D' },
};

const TYPE_CFG = {
  income:  { label: 'Income',  color: '#37D67A', bg: 'rgba(55,214,122,.1)' },
  expense: { label: 'Expense', color: '#FF5B5B', bg: 'rgba(255,91,91,.1)' },
};

function RecurringModal({ item, wallets, categories, onClose, onSave }) {
  const t = useT();
  const [form, setForm] = useState(item || {
    type: 'expense', amount: '', payment_name: '', description: '',
    frequency: 'monthly', start_date: new Date().toISOString().split('T')[0],
    end_date: '', wallet_id: '', category_id: '', is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.payment_name || !form.amount || !form.frequency || !form.start_date) {
      setError('Please fill in all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid var(--border)',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, display: 'block' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {item ? 'Edit Recurring' : 'Add Recurring'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text3)' }}>×</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,91,91,.1)', border: '1px solid rgba(255,91,91,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#FF5B5B', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {['income', 'expense'].map(tp => (
            <button key={tp} onClick={() => set('type', tp)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid',
              borderColor: form.type === tp ? TYPE_CFG[tp].color : 'var(--border)',
              background: form.type === tp ? TYPE_CFG[tp].bg : 'transparent',
              color: form.type === tp ? TYPE_CFG[tp].color : 'var(--text3)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>
              {TYPE_CFG[tp].label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} value={form.payment_name} onChange={e => set('payment_name', e.target.value)} placeholder="e.g. Netflix, Salary..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Amount *</label>
              <input style={inputStyle} type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Frequency *</label>
              <select style={inputStyle} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date *</label>
              <input style={inputStyle} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End Date (optional)</label>
              <input style={inputStyle} type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Account (optional)</label>
            <select style={inputStyle} value={form.wallet_id || ''} onChange={e => set('wallet_id', e.target.value)}>
              <option value="">No account</option>
              {(wallets || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Category (optional)</label>
            <select style={inputStyle} value={form.category_id || ''} onChange={e => set('category_id', e.target.value)}>
              <option value="">No category</option>
              {(categories || []).filter(c => c.type === form.type || c.type === 'both').map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Description (optional)</label>
            <input style={inputStyle} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Notes..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid var(--border)',
            background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,#6C63FF,#5B8CFF)', color: '#fff',
            fontWeight: 700, cursor: 'pointer', opacity: saving ? .7 : 1,
          }}>
            {saving ? 'Saving...' : item ? 'Save Changes' : 'Add Recurring'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Recurring() {
  const fmt = useFmt();
  const t = useT();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [processing, setProcessing] = useState(false);

  const { data: items, isLoading, error } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => recurringAPI.getAll().then(r => r.data.data),
  });
  const { data: wallets } = useQuery({ queryKey: ['wallets'], queryFn: () => walletsAPI.getAll().then(r => r.data.data) });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoriesAPI.getAll().then(r => r.data.data) });

  const createMut = useMutation({
    mutationFn: (data) => recurringAPI.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => recurringAPI.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => recurringAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });

  const handleSave = (form) => {
    if (editItem) {
      return updateMut.mutateAsync({ id: editItem.id, data: form });
    } else {
      return createMut.mutateAsync(form);
    }
  };

  const handleToggle = async (item) => {
    try {
      await updateMut.mutateAsync({ id: item.id, data: { ...item, is_active: !item.is_active } });
    } catch (e) {}
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await recurringAPI.process();
      const cnt = res.data.processed;
      alert(`Processed ${cnt} recurring transaction${cnt !== 1 ? 's' : ''}`);
      qc.invalidateQueries({ queryKey: ['recurring'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    } catch (e) {
      alert('Failed to process');
    } finally {
      setProcessing(false);
    }
  };

  const openEdit = (item) => { setEditItem(item); setShowModal(true); };
  const openAdd = () => { setEditItem(null); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditItem(null); };

  const totalMonthly = (items || []).filter(i => i.is_active).reduce((s, i) => {
    let monthly = parseFloat(i.amount);
    if (i.frequency === 'daily') monthly *= 30;
    else if (i.frequency === 'weekly') monthly *= 4.33;
    else if (i.frequency === 'yearly') monthly /= 12;
    return i.type === 'expense' ? s - monthly : s + monthly;
  }, 0);

  return (
    <div style={{ padding: '0 0 32px' }}>
      <Topbar subtitle="Manage your recurring payments & income">
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleProcess} disabled={processing}
            className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} style={{ animation: processing ? 'spin 1s linear infinite' : 'none' }} />
            {processing ? 'Processing...' : 'Run Now'}
          </button>
          <button onClick={openAdd} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Recurring
          </button>
        </div>
      </Topbar>

      <div style={{ padding: '0 20px' }}>
        {/* Summary card */}
        <div style={{
          background: 'linear-gradient(135deg,#6C63FF,#5B8CFF)', borderRadius: 16, padding: '20px 24px',
          marginBottom: 24, color: '#fff',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: .8, marginBottom: 6 }}>MONTHLY NET RECURRING</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
            {fmt(Math.abs(totalMonthly))}
          </div>
          <div style={{ fontSize: 12, opacity: .75, marginTop: 4 }}>
            {totalMonthly >= 0 ? 'Net income' : 'Net expense'} per month from {(items || []).filter(i => i.is_active).length} active rules
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(255,91,91,.1)', border: '1px solid rgba(255,91,91,.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, color: '#FF5B5B', fontSize: 13 }}>
            Failed to load recurring transactions. Please try again.
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 12, fontSize: 14 }}>Loading...</div>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && !(items || []).length && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No recurring transactions</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
              Set up automatic transactions for bills, subscriptions, or salary
            </div>
            <button onClick={openAdd} className="btn btn-primary">
              <Plus size={14} style={{ marginRight: 6 }} /> Add your first
            </button>
          </div>
        )}

        {/* List */}
        {(items || []).map(item => {
          const freq = FREQ_COLORS[item.frequency] || FREQ_COLORS.monthly;
          const typ = TYPE_CFG[item.type] || TYPE_CFG.expense;
          return (
            <div key={item.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
              padding: '16px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14,
              opacity: item.is_active ? 1 : 0.55,
              transition: 'opacity .2s',
            }}>
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: typ.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>
                {item.category_emoji || (item.type === 'income' ? '💰' : '💸')}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
                  {item.payment_name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: freq.bg, color: freq.color }}>
                    {item.frequency}
                  </span>
                  {item.category_name && (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{item.category_emoji} {item.category_name}</span>
                  )}
                  {item.wallet_name && (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {item.wallet_name}</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    · Next: {item.next_run ? new Date(item.next_run).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>

              {/* Amount */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: typ.color, fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
                  {item.type === 'expense' ? '−' : '+'}{fmt(item.amount)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>per {item.frequency}</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleToggle(item)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: item.is_active ? '#37D67A' : 'var(--text3)', padding: 4,
                }} title={item.is_active ? 'Deactivate' : 'Activate'}>
                  {item.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
                <button onClick={() => openEdit(item)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4,
                }} title="Edit">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => { if (confirm('Delete this recurring rule?')) deleteMut.mutate(item.id); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#FF5B5B', padding: 4,
                }} title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <RecurringModal
          item={editItem}
          wallets={wallets}
          categories={categories}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
