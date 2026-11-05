import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House, ArrowsLeftRight, Wallet, Target, ChartPie, Users,
  CreditCard, ArrowsClockwise, TrendUp, UploadSimple,
  Gear, Moon, Sun, SignOut, X,
} from '@phosphor-icons/react';
import useAuthStore from '../../store/authStore';
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

  const handleLogout = () => { logout(); navigate('/login'); };
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
          <motion.div
            className={styles.logoIcon}
            whileHover={{ scale: 1.08, rotate: -4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <img src="/icons/logo.png" alt="T" style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: 7 }}
              onError={e => { e.target.style.display='none'; e.target.parentElement.textContent='T'; }} />
          </motion.div>
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
                <motion.span
                  className={styles.navIconWrap}
                  style={{ background: isActive ? 'rgba(79,70,229,.12)' : 'transparent' }}
                  whileHover={{ scale: 1.12, y: -1 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Gear size={18} weight={isActive ? 'fill' : 'regular'} color={isActive ? '#4F46E5' : 'var(--text3)'} />
                </motion.span>
                <span className={styles.navLabel}>{t('nav_settings')}</span>
              </>
            )}
          </NavLink>

          <button className={styles.navItem} onClick={toggleTheme}>
            <motion.span
              className={styles.navIconWrap}
              whileHover={{ scale: 1.12, y: -1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {theme === 'light'
                ? <Moon size={18} color="var(--text3)" />
                : <Sun size={18} color="#FFB300" weight="fill" />}
            </motion.span>
            <span className={styles.navLabel}>
              {theme === 'light' ? t('nav_darkmode') : t('nav_lightmode')}
            </span>
          </button>

        </nav>

        {/* ── Bottom ── */}
        <div className={styles.navBottom}>
          <InstallPWA onClick={onClose} />
          <motion.button
            className={`${styles.navItem} ${styles.logoutBtn}`}
            onClick={handleLogout}
            whileHover={{ x: 2 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <motion.span
              className={styles.navIconWrap}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <SignOut size={18} color="var(--red)" />
            </motion.span>
            <span className={styles.navLabel}>{t('nav_logout')}</span>
          </motion.button>

          <div className={styles.avatarRow}>
            <motion.div
              className={styles.avatar}
              whileHover={{ scale: 1.08 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {initials}
            </motion.div>
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
