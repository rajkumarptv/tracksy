import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House, ArrowsLeftRight, Wallet, Target, ChartPie, Users,
  CreditCard, ArrowsClockwise, TrendUp, UploadSimple, ChartLineUp,
  Gear, Moon, Sun, SignOut, X,
} from '@phosphor-icons/react';
import useAuthStore from '../../store/authStore';
import { track } from '../../lib/analytics';
import useThemeStore from '../../store/themeStore';
import { useT } from '../../i18n';
import InstallPWA from '../InstallPWA';
import styles from './Sidebar.module.css';

const NAV_GROUPS = [
  { label: null, items: [
    { path: '/',             tKey: 'nav_dashboard',    Icon: House           },
  ] },
  { label: 'Money', items: [
    { path: '/transactions', tKey: 'nav_transactions', Icon: ArrowsLeftRight },
    { path: '/wallet',       tKey: 'nav_accounts',     Icon: Wallet          },
    { path: '/recurring',    tKey: 'nav_recurring',    Icon: ArrowsClockwise },
    { path: '/import',       tKey: 'nav_import',       Icon: UploadSimple    },
  ] },
  { label: 'Plan & analyze', items: [
    { path: '/budget',       tKey: 'nav_budget',       Icon: ChartPie        },
    { path: '/goals',        tKey: 'nav_goals',        Icon: Target          },
    { path: '/debts',        tKey: 'nav_debts',        Icon: CreditCard      },
    { path: '/forecast',     label: 'Forecast',        Icon: ChartLineUp     },
    { path: '/insights',     label: 'Insights',        Icon: TrendUp         },
  ] },
  { label: 'Household', items: [
    { path: '/family',       label: 'Family',          Icon: Users           },
  ] },
];

function AnimatedNavItem({ path, tKey, label, Icon, t, onClose }) {
  return (
    <NavLink
      key={path}
      to={path}
      end={path === '/'}
      onClick={onClose}
      className={({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`}
    >
      {({ isActive }) => (
        <>
          <span className={styles.navIconWrap}>
            <Icon size={18} weight={isActive ? 'fill' : 'regular'} color={isActive ? 'var(--accent)' : 'var(--text3)'} />
          </span>
          <span className={styles.navLabel}>{label || t(tKey)}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const t = useT();

  const handleLogout = () => { track('logout'); logout(); navigate('/login'); };
  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <AnimatePresence>
      <motion.aside
        className={`${styles.sidebar}${isOpen ? ' ' + styles.open : ''}`}
        initial={false}
      >
        {/* ── Logo ── */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <img src="/icons/icon.svg" alt="" width="32" height="32"
              onError={e => { e.target.style.display='none'; e.target.parentElement.textContent='T'; }} />
          </div>
          <span className={styles.logoName}>Tracksy</span>
          <button onClick={onClose} className={`${styles.closeBtn} show-mobile-only`} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* ── Main nav ── */}
        <nav className={styles.nav}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {group.label && <div className={styles.navSection} style={gi ? { marginTop: 10 } : undefined}>{group.label}</div>}
              {group.items.map((item) => (
                <AnimatedNavItem key={item.path} {...item} t={t} onClose={onClose} />
              ))}
            </div>
          ))}

          <div className={styles.navSection} style={{ marginTop: 8 }}>{t('nav_preferences')}</div>

          <NavLink to="/settings" onClick={onClose}
            className={({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`}>
            {({ isActive }) => (
              <>
                <span className={styles.navIconWrap}>
                  <Gear size={18} weight={isActive ? 'fill' : 'regular'} color={isActive ? 'var(--accent)' : 'var(--text3)'} />
                </span>
                <span className={styles.navLabel}>{t('nav_settings')}</span>
              </>
            )}
          </NavLink>

          <button className={styles.navItem} onClick={toggleTheme}>
            <span className={styles.navIconWrap}>
              {theme === 'light'
                ? <Moon size={18} color="var(--text3)" />
                : <Sun size={18} color="var(--orange)" weight="fill" />}
            </span>
            <span className={styles.navLabel}>
              {theme === 'light' ? t('nav_darkmode') : t('nav_lightmode')}
            </span>
          </button>

        </nav>

        {/* ── Bottom ── */}
        <div className={styles.navBottom}>
          <InstallPWA onClick={onClose} />
          <button className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleLogout}>
            <span className={styles.navIconWrap}>
              <SignOut size={18} color="var(--red-text)" />
            </span>
            <span className={styles.navLabel}>{t('nav_logout')}</span>
          </button>

          <div className={styles.avatarRow}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.avatarInfo}>
              <div className={styles.avatarName}>{user?.first_name} {user?.last_name}</div>
              <div className={styles.avatarEmail}>{user?.email}</div>
            </div>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
