import { Search, Bell, Moon, Sun, SlidersHorizontal } from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import useAuthStore from '../../store/authStore';
import { useFmt } from '../../i18n';

/* ─── StatCard ──────────────────────────────────── */
export function StatCard({ label, value, change, changeLabel, prefix, accentColor, icon, isCurrency = true }) {
  const fmt = useFmt();
  const isPositive = parseFloat(change) >= 0;
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '20px 22px' }}>
      <div style={{
        position: 'absolute', top: -24, right: -24,
        width: 88, height: 88,
        background: accentColor || 'var(--accent-light)',
        borderRadius: '50%', opacity: .55,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.07em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {label}
        {icon && <span style={{ fontSize: 18, opacity: .6 }}>{icon}</span>}
      </div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text)', marginBottom: 10 }}>
        {isCurrency && typeof value === 'number'
          ? fmt(value)
          : (prefix || '') + (typeof value === 'number' ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (value ?? '0.00'))}
      </div>
      {change !== undefined && (
        <div style={{
          fontSize: 11.5, fontWeight: 600,
          color: isPositive ? 'var(--green)' : 'var(--red)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
          background: isPositive ? 'var(--green-light)' : 'var(--red-light)',
          borderRadius: 20, padding: '3px 9px',
        }}>
          {isPositive ? '↑' : '↓'} {Math.abs(change)}%
          <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 10.5, marginLeft: 2 }}>{changeLabel || 'vs last month'}</span>
        </div>
      )}
    </div>
  );
}

/* ─── MiniStatCard ──────────────────────────────── */
export function MiniStatCard({ iconBg, iconEl, label, value, sub, onClick }) {
  return (
    <div className="card" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: onClick ? 'pointer' : 'default', transition: 'var(--transition)' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: iconBg || 'var(--accent-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {iconEl}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', letterSpacing: -0.3 }}>{value}</div>
        {sub && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 1, fontWeight: 600, cursor: onClick ? 'pointer' : 'default' }}>
            {sub} {onClick && '›'}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── LoadingSpinner ────────────────────────────── */
export function LoadingSpinner({ size = 24, color = 'var(--accent)' }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity=".2"/>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
    </svg>
  );
}

/* ─── PageLoader ────────────────────────────────── */
export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 14 }}>
      <LoadingSpinner size={40} />
      <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>Loading…</span>
    </div>
  );
}

/* ─── EmptyState ────────────────────────────────── */
export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px' }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{title}</div>
      {description && <div style={{ fontSize: 13.5, color: 'var(--text3)', marginBottom: 22, maxWidth: 320, margin: '0 auto 22px' }}>{description}</div>}
      {action}
    </div>
  );
}

/* ─── ProgressBar ───────────────────────────────── */
export function ProgressBar({ value, color = 'var(--accent)', height = 8 }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  return (
    <div style={{ height, background: 'var(--surface3)', borderRadius: 20, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 20, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
    </div>
  );
}

/* ─── AmountText ────────────────────────────────── */
export function AmountText({ amount, type }) {
  const fmt = useFmt();
  const isIncome = type === 'income';
  return (
    <span className="mono" style={{ fontWeight: 700, fontSize: 13.5, color: isIncome ? 'var(--green)' : 'var(--red)' }}>
      {isIncome ? '+' : '−'}{fmt(Math.abs(amount))}
    </span>
  );
}

/* ─── StatusChip ────────────────────────────────── */
export function StatusChip({ status }) {
  const map = { completed: 'chip-success', pending: 'chip-pending', failed: 'chip-failed' };
  return <span className={`chip ${map[status] || 'chip-success'}`} style={{ textTransform: 'capitalize' }}>{status}</span>;
}

/* ─── TypeBadge ─────────────────────────────────── */
export function TypeBadge({ type }) {
  return <span className={`chip chip-${type}`} style={{ textTransform: 'capitalize' }}>{type}</span>;
}

/* ─── IconButton ────────────────────────────────── */
export function IconButton({ children, onClick, title, variant = 'default' }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', border: '1px solid var(--border)',
      background: variant === 'danger' ? 'var(--red-light)' : 'var(--surface)',
      color: variant === 'danger' ? 'var(--red)' : 'var(--text2)',
      transition: 'var(--transition)',
    }}>
      {children}
    </button>
  );
}

/* ─── Topbar ────────────────────────────────────── */
export function Topbar({ title, subtitle, children }) {
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const initials = user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() : 'AL';

  return (
    <div className="topbar" style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--topbar-bg)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--border-light)',
      padding: '0 28px',
      height: 'var(--topbar-h)',
      display: 'flex', alignItems: 'center', gap: 16,
      flexShrink: 0,
    }}>

      {/* Title section */}
      <div style={{ minWidth: 0, flex: '0 0 auto' }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>{subtitle}</div>}
      </div>

      {/* Search bar — grows to fill space */}
      <div style={{
        flex: 1, maxWidth: 420,
        position: 'relative', display: 'flex', alignItems: 'center',
      }}>
        <Search size={15} color="var(--text3)" style={{ position: 'absolute', left: 13, pointerEvents: 'none' }} />
        <input
          placeholder="Search for anything..."
          style={{
            width: '100%',
            height: 38, paddingLeft: 38, paddingRight: 12,
            border: '1.5px solid var(--border)',
            borderRadius: 10, fontSize: 13,
            background: 'var(--surface)',
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
            transition: 'var(--transition)',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-light)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
        />
        <button style={{
          position: 'absolute', right: 8,
          width: 26, height: 26, borderRadius: 7,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text3)',
        }}>
          <SlidersHorizontal size={13} />
        </button>
      </div>

      {/* Right side actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        {children}

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          style={{
            width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'var(--transition)',
          }}>
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        {/* Notification bell */}
        <button style={{
          width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'var(--transition)', position: 'relative',
        }}>
          <Bell size={15} />
          <span style={{
            position: 'absolute', top: 8, right: 8,
            width: 8, height: 8,
            background: 'var(--red)', borderRadius: '50%',
            border: '1.5px solid var(--surface)',
            fontSize: 8, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>3</span>
        </button>

        {/* User avatar with name */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '5px 12px 5px 5px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 24, cursor: 'pointer',
          transition: 'var(--transition)',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #a29bfe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            Hi, {user?.first_name || 'User'}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
    </div>
  );
}
