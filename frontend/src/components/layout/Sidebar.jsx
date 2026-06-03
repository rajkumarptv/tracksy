import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, PieChart,
  Target, Tag, TrendingUp, Settings,
  HelpCircle, LogOut, Moon, Sun, Crown, CreditCard, Upload, Repeat, Users,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import usePremiumStore from '../../store/premiumStore';
import { useT } from '../../i18n';
import styles from './Sidebar.module.css';

function NavItems({ onClose }) {
  const t = useT();

  const NAV_ITEMS = [
    { path: '/',             key: 'nav_dashboard',    Icon: LayoutDashboard },
    { path: '/transactions', key: 'nav_transactions', Icon: ArrowLeftRight },
    { path: '/wallet',       key: 'nav_accounts',     Icon: Wallet },
    { path: '/goals',        key: 'nav_goals',        Icon: Target },
    { path: '/budget',       key: 'nav_budget',       Icon: PieChart },
    { path: '/family',       label: 'Family',         Icon: Users },
    { path: '/categories',   key: 'nav_categories',   Icon: Tag },
    { path: '/debts',        key: 'nav_debts',        Icon: CreditCard },
    { path: '/recurring',    key: 'nav_recurring',    Icon: Repeat },
    { path: '/analytics',   key: 'nav_analytics',    Icon: TrendingUp },
    { path: '/import',      key: 'nav_import',       Icon: Upload },
  ];

  return (
    <>
      {NAV_ITEMS.map(({ path, key, label, Icon }) => (
        <NavLink key={path} to={path} end={path === '/'} onClick={onClose}
          className={({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`}>
          <span className={styles.navIcon}><Icon size={17} /></span>
          {label || t(key)}
        </NavLink>
      ))}
    </>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { openPremium } = usePremiumStore();
  const navigate = useNavigate();
  const t = useT();

  const handleLogout = () => { logout(); navigate('/login'); };
  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'AL';

  return (
    <aside className={`${styles.sidebar}${isOpen ? ' ' + styles.open : ''}`}>

      {/* ── Logo ── */}
      <div className={styles.logo}>
        <img src="/icons/logo.png" alt="Tracksy" style={{ width:46, height:46, borderRadius:12, objectFit:'cover', flexShrink:0 }} />
        <span className={styles.logoName}>Tracksy</span>
        <button onClick={onClose} className={`${styles.closeBtn} show-mobile-only`} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Main nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>{t('nav_menu')}</div>
        <NavItems onClose={onClose} />

        <div className={styles.navSection} style={{ marginTop: 8 }}>{t('nav_preferences')}</div>

        <NavLink to="/settings" onClick={onClose}
          className={({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`}>
          <span className={styles.navIcon}><Settings size={17} /></span>
          {t('nav_settings')}
        </NavLink>

        <button className={styles.navItem} onClick={toggleTheme}>
          <span className={styles.navIcon}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </span>
          {theme === 'light' ? t('nav_darkmode') : t('nav_lightmode')}
        </button>

        <NavLink to="/help" onClick={onClose}
          className={({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`}>
          <span className={styles.navIcon}><HelpCircle size={17} /></span>
          {t('nav_help')}
        </NavLink>
      </nav>

      {/* ── Upgrade banner (hidden for premium users) ── */}
      {!user?.is_premium && (
        <div className={styles.upgradeBanner} onClick={openPremium}>
          <span className={styles.upgradeIcon}><Crown size={22} color="#fff" /></span>
          <div className={styles.upgradeTitle}>{t('sidebar_upgrade_title')}</div>
          <div className={styles.upgradeDesc}>{t('sidebar_upgrade_desc')}</div>
          <button className={styles.upgradeBtn} onClick={e => { e.stopPropagation(); openPremium(); }}>{t('sidebar_upgrade_btn')}</button>
        </div>
      )}

      {/* ── Bottom ── */}
      <div className={styles.navBottom}>
        <button className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleLogout}>
          <span className={styles.navIcon}><LogOut size={17} /></span>
          {t('nav_logout')}
        </button>
        <div className={styles.avatarRow}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.avatarInfo}>
            <div className={styles.avatarName}>{user?.first_name} {user?.last_name}</div>
            <div className={styles.avatarEmail}>{user?.email}</div>
          </div>
        </div>
      </div>

    </aside>
  );
}
