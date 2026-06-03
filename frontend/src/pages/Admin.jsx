import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';

// ── API helpers ────────────────────────────────────────────────────────────────
const adminAPI = {
  getStats: ()                      => api.get('/admin/stats'),
  getUsers: (params)                => api.get('/admin/users', { params }),
  togglePremium: (userId)           => api.patch(`/admin/users/${userId}/premium`),
  listFamilies: ()                  => api.get('/admin/families'),
};

// ── Tiny stat card ─────────────────────────────────────────────────────────────
function StatBox({ label, value, sub, color = '#6C63FF', bg = 'rgba(108,99,255,.1)', icon }) {
  return (
    <div style={{
      background: 'var(--surface, #1a1a2e)', borderRadius: 18, padding: '18px 20px',
      border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ width: 46, height: 46, borderRadius: 13, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Mini bar chart (no recharts needed) ───────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data?.length) return <div style={{ color: '#555', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No data yet</div>;
  const max = Math.max(...data.map(d => parseInt(d.count)), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.date}: ${d.count} signups`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default' }}>
          <div style={{
            width: '100%', borderRadius: '3px 3px 0 0',
            height: `${Math.max(4, (parseInt(d.count) / max) * 64)}px`,
            background: 'linear-gradient(180deg,#6C63FF,#5B8CFF)',
            transition: 'height .3s ease',
          }}/>
        </div>
      ))}
    </div>
  );
}

// ── Main admin page ────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [authChecked, setAuthChecked] = useState(false);

  // Refresh user from server on mount so is_admin is always current
  useEffect(() => {
    if (!isAuthenticated) { setAuthChecked(true); return; }
    api.get('/auth/me').then(r => {
      if (r.data?.user) updateUser(r.data.user);
    }).catch(() => {}).finally(() => setAuthChecked(true));
  }, []);

  // All hooks must be called before any conditional returns
  const isAdmin = authChecked && !!user?.is_admin;

  const { data: statsData } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminAPI.getStats().then(r => r.data.data),
    refetchInterval: 60_000,
    enabled: isAdmin,
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminAPI.getUsers({ page, limit: 15, search }).then(r => r.data),
    enabled: isAdmin,
  });

  const premiumMutation = useMutation({
    mutationFn: (userId) => adminAPI.togglePremium(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  // ── Family oversight (read-only) ──
  const { data: families = [] } = useQuery({
    queryKey: ['admin-families'],
    queryFn: () => adminAPI.listFamilies().then(r => r.data.data),
    enabled: isAdmin,
  });

  const s = statsData;
  const users = usersData?.data || [];
  const pagination = usersData?.pagination;

  // ── Conditional renders (after all hooks) ──
  if (!isAuthenticated) { navigate('/login'); return null; }
  if (!authChecked) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a' }}>
      <div style={{ color: '#6C63FF', fontSize: 15, fontWeight: 600 }}>Verifying access…</div>
    </div>;
  }
  if (!user?.is_admin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Access Denied</div>
        <div style={{ fontSize: 14, color: '#888' }}>You need admin privileges to view this page.</div>
        <button onClick={() => navigate('/')} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 12, background: '#6C63FF', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#e0e0e0', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg,#1a1033 0%,#0f0f1a 100%)', borderBottom: '1px solid rgba(108,99,255,.2)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6C63FF,#a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.4 }}>Tracksy Admin</div>
          <div style={{ fontSize: 11, color: '#888' }}>Internal dashboard — {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button onClick={() => qc.invalidateQueries()}
            style={{ padding: '7px 16px', borderRadius: 10, background: 'rgba(108,99,255,.15)', border: '1px solid rgba(108,99,255,.3)', color: '#a29bfe', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
          <button onClick={() => navigate('/')}
            style={{ padding: '7px 16px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ← App
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 32px 48px', maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Top KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          <StatBox label="Total Users"      value={s?.users.total    ?? '—'} icon="👥" color="#a29bfe" bg="rgba(162,155,254,.12)" sub="All registered" />
          <StatBox label="Premium Users"    value={s?.users.premium  ?? '—'} icon="✨" color="#FFB84D" bg="rgba(255,184,77,.12)"  sub={`₹${(s?.revenue.monthly_estimate ?? 0).toLocaleString()}/mo est.`} />
          <StatBox label="Active (7d)"      value={s?.users.active_week  ?? '—'} icon="🟢" color="#37D67A" bg="rgba(55,214,122,.12)" sub="Logged in last week" />
          <StatBox label="Active (30d)"     value={s?.users.active_month ?? '—'} icon="📅" color="#5B8CFF" bg="rgba(91,140,255,.12)" sub="Logged in last month" />
          <StatBox label="New Today"        value={s?.users.new_today ?? '—'} icon="🆕" color="#FF79A8" bg="rgba(255,121,168,.12)" sub={`${s?.users.new_week ?? 0} this week`} />
          <StatBox label="Transactions"     value={s?.content.transactions?.toLocaleString() ?? '—'} icon="💸" color="#6C63FF" bg="rgba(108,99,255,.12)" sub="All time" />
        </div>

        {/* ── Charts row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 28 }}>

          {/* Signups chart */}
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 18, padding: '20px 22px', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4 }}>New Signups — Last 30 Days</div>
            <div style={{ fontSize: 11.5, color: '#666', marginBottom: 16 }}>Daily new user registrations</div>
            <MiniBarChart data={s?.daily_signups}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, color: '#555' }}>
              <span>30 days ago</span><span>Today</span>
            </div>
          </div>

          {/* Plan split */}
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 18, padding: '20px 22px', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4 }}>Plan Distribution</div>
            <div style={{ fontSize: 11.5, color: '#666', marginBottom: 20 }}>Free vs Premium</div>
            {s && (() => {
              const total = s.users.total || 1;
              const freePct = Math.round((s.users.free / total) * 100);
              const premPct = 100 - freePct;
              return (
                <>
                  <div style={{ height: 10, borderRadius: 20, overflow: 'hidden', background: 'rgba(255,255,255,.06)', marginBottom: 16 }}>
                    <div style={{ height: '100%', width: `${premPct}%`, background: 'linear-gradient(90deg,#FFB84D,#FF79A8)', transition: 'width .6s ease' }}/>
                  </div>
                  {[
                    { label: 'Premium', count: s.users.premium, pct: premPct, color: '#FFB84D' },
                    { label: 'Free',    count: s.users.free,    pct: freePct, color: '#6C63FF' },
                  ].map(({ label, count, pct, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}/>
                      <span style={{ flex: 1, fontSize: 13, color: '#ccc' }}>{label}</span>
                      <span style={{ fontWeight: 800, color, fontSize: 15 }}>{count}</span>
                      <span style={{ fontSize: 11, color: '#666' }}>{pct}%</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,184,77,.08)', border: '1px solid rgba(255,184,77,.2)' }}>
                    <div style={{ fontSize: 11, color: '#888' }}>Est. Monthly Revenue</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#FFB84D', marginTop: 2 }}>
                      ₹{(s.revenue.monthly_estimate).toLocaleString('en-IN')}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Recent signups ── */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,.05)', fontWeight: 700, fontSize: 14, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            🆕 Recent Sign-ups
            <span style={{ fontSize: 11, fontWeight: 600, color: '#888', background: 'rgba(255,255,255,.05)', borderRadius: 20, padding: '2px 8px' }}>
              last 10
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                  {['Name', 'Email', 'Plan', 'Signed Up', 'Last Login'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(s?.recent_users || []).map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>
                      {u.first_name} {u.last_name}
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12.5, color: '#888' }}>{u.email}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: u.is_premium ? 'rgba(255,184,77,.15)' : 'rgba(108,99,255,.12)', color: u.is_premium ? '#FFB84D' : '#a29bfe' }}>
                        {u.is_premium ? '✨ Premium' : 'Free'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#666' }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 18px', fontSize: 12, color: '#666' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── User management ── */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', flex: 1 }}>👤 User Management</div>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email…"
              style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#e0e0e0', fontSize: 12.5, outline: 'none', width: 240 }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                  {['User', 'Email', 'Plan', 'Transactions', 'Wallets', 'Joined', 'Last Login', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,.04)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6C63FF,#a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                          {(u.first_name?.[0] || '') + (u.last_name?.[0] || '')}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', whiteSpace: 'nowrap' }}>{u.first_name} {u.last_name}</div>
                          {u.is_admin && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#FF79A8', background: 'rgba(255,121,168,.12)', borderRadius: 6, padding: '1px 5px' }}>ADMIN</span>}
                          {u.oauth_provider && <span style={{ fontSize: 9.5, fontWeight: 600, color: '#74b9ff', background: 'rgba(116,185,255,.1)', borderRadius: 6, padding: '1px 5px', marginLeft: 3 }}>{u.oauth_provider}</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: u.is_premium ? 'rgba(255,184,77,.15)' : 'rgba(255,255,255,.06)', color: u.is_premium ? '#FFB84D' : '#666' }}>
                        {u.is_premium ? '✨ Premium' : 'Free'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#a29bfe', textAlign: 'center' }}>{u.tx_count}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#74b9ff', textAlign: 'center' }}>{u.wallet_count}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        disabled={premiumMutation.isPending}
                        onClick={() => premiumMutation.mutate(u.id)}
                        style={{
                          fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                          background: u.is_premium ? 'rgba(255,91,91,.12)' : 'rgba(255,184,77,.12)',
                          border: `1px solid ${u.is_premium ? 'rgba(255,91,91,.3)' : 'rgba(255,184,77,.3)'}`,
                          color: u.is_premium ? '#FF5B5B' : '#FFB84D',
                          transition: 'all .15s',
                        }}>
                        {u.is_premium ? 'Revoke Premium' : 'Grant Premium'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#555', fontSize: 13 }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,.05)', justifyContent: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: page === 1 ? '#444' : '#e0e0e0', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
                ← Prev
              </button>
              <span style={{ fontSize: 12, color: '#666', padding: '0 8px' }}>Page {page} of {pagination.pages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: page === pagination.pages ? '#444' : '#e0e0e0', cursor: page === pagination.pages ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
                Next →
              </button>
            </div>
          )}
        </div>

        {/* ══ FAMILY OVERSIGHT (read-only) ══ */}
        <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', overflow: 'hidden', marginTop: 28 }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,.05)', fontWeight: 700, fontSize: 14, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            👨‍👩‍👧 Families
            <span style={{ fontSize: 11, fontWeight: 600, color: '#888', background: 'rgba(255,255,255,.05)', borderRadius: 20, padding: '2px 8px' }}>{families.length} total · members join via code</span>
          </div>

          <div style={{ padding: '8px 22px 22px' }}>
            {families.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: 13 }}>No families yet. Premium users create them from the Family page.</div>
            )}
            {families.map(fam => (
              <div key={fam.id} style={{ marginTop: 16, padding: '16px 18px', borderRadius: 14, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap:'wrap' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{fam.name}</div>
                  <span style={{ fontSize: 11, fontWeight:700, color: '#a29bfe', background: 'rgba(108,99,255,.12)', borderRadius: 20, padding: '2px 9px', fontFamily:'monospace', letterSpacing:1 }}>{fam.family_code}</span>
                  <span style={{ fontSize: 11, color: '#888', background: 'rgba(255,255,255,.05)', borderRadius: 20, padding: '2px 9px' }}>{fam.member_count} members</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fam.members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 9, background: 'rgba(255,255,255,.03)' }}>
                      <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: m.family_role === 'primary' ? 'rgba(255,184,77,.15)' : 'rgba(108,99,255,.15)', color: m.family_role === 'primary' ? '#FFB84D' : '#a29bfe' }}>
                        {m.family_role === 'primary' ? '👑 Head' : 'Member'}
                      </span>
                      <span style={{ fontSize: 11.5, color: '#666', flex: 1 }}>{m.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
