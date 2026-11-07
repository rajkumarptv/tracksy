import { NavLink, useNavigate } from 'react-router-dom';
import { Gear, Moon, Sun, SignOut } from '@phosphor-icons/react';
import Sheet from '../ui/Sheet';
import InstallPWA from '../InstallPWA';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import { track } from '../../lib/analytics';
import { NAV_GROUPS } from './nav';
import styles from './MoreSheet.module.css';

/** Mobile "More" sheet: every screen, plus settings, theme and sign out. Replaces the old slide-out drawer. */
export default function MoreSheet({ open, onClose }) {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  const signOut = () => { track('logout'); logout(); navigate('/login'); };

  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <div className={styles.profile}>
        <div className={styles.avatar}>{initials}</div>
        <div style={{ minWidth: 0 }}>
          <div className={styles.name}>{user?.first_name} {user?.last_name}</div>
          <div className={styles.email}>{user?.email}</div>
        </div>
      </div>

      {NAV_GROUPS.filter(g => g.label).map(g => (
        <div key={g.label} className={styles.group}>
          <div className={styles.groupLabel}>{g.label}</div>
          <div className={styles.grid}>
            {g.items.map(({ path, label, Icon, soon }) => (
              <NavLink key={path} to={path} onClick={onClose} className={styles.tile}>
                <Icon size={22} color="var(--accent)" aria-hidden="true" />
                <span>{label}</span>
                {soon && <em className={styles.soon}>Soon</em>}
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      <div className={styles.group}>
        <div className={styles.groupLabel}>Preferences</div>
        <NavLink to="/settings" onClick={onClose} className={styles.row}><Gear size={20} aria-hidden="true" />Settings</NavLink>
        <button type="button" className={styles.row} onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
        <InstallPWA onClick={onClose} />
        <button type="button" className={`${styles.row} ${styles.danger}`} onClick={signOut}><SignOut size={20} aria-hidden="true" />Log out</button>
      </div>
    </Sheet>
  );
}
