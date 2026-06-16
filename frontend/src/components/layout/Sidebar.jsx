import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House, ArrowsLeftRight, Wallet, Target, ChartPie,
  Users, Tag, CreditCard, ArrowsClockwise, TrendUp,
  UploadSimple, Gear, Moon, Sun, Crown, SignOut, X,
  Question, ChartLineUp, Scales, Trophy
} from '@phosphor-icons/react';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import usePremiumStore from '../../store/premiumStore';
import { useT } from '../../i18n';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { path: '/',             tKey: 'nav_dashboard',    Icon: House,           color: '#6C63FF', bg: 'rgba(108,99,255,.15)' },
  { path: '/transactions', tKey: 'nav_transactions', Icon: ArrowsLeftRight, color: '#FF5B5B', bg: 'rgba(255,91,91,.15)'  },
  { path: '/wallet',       tKey: 'nav_accounts',     Icon: Wallet,          color: '#00C896', bg: 'rgba(0,200,150,.15)'  },
  { path: '/goals',        tKey: 'nav_goals',        Icon: Target,          color: '#FFB300', bg: 'rgba(255,179,0,.15)'  },
  { path: '/budget',       tKey: 'nav_budget',       Icon: ChartPie,        color: '#5B8CFF', bg: 'rgba(91,140,255,.15)' },
  { path: '/family',       label: 'Family',          Icon: Users,           color: '#FF6EC7', bg: 'rgba(255,110,199,.15)'},
  { path: '/categories',   tKey: 'nav_categories',   Icon: Tag,             color: '#A29BFE', bg: 'rgba(162,155,254,.15)'},
  { path: '/investments',   label: 'Investments',     Icon: ChartLineUp,     color: '#37D67A', bg: 'rgba(55,214,122,.15)' },
  { path: '/debts',        tKey: 'nav_debts',        Icon: CreditCard,      color: '#FF5B5B', bg: 'rgba(255,91,91,.15)'  },
  { path: '/debt-reduction',label:'Debt Reduction',  Icon: Scales,          color: '#FFB84D', bg: 'rgba(255,184,77,.15)' },
  { path: '/challenges',   label: 'Challenges',      Icon: Trophy,          color: '#A29BFE', bg: 'rgba(162,155,254,.15)'},
  { path: '/recurring',    tKey: 'nav_recurring',    Icon: ArrowsClockwise, color: '#00CEC9', bg: 'rgba(0,206,201,.15)'  },
  { path: '/analytics',    tKey: 'nav_analytics',    Icon: TrendUp,         color: '#5B8CFF', bg: 'rgba(91,140,255,.15)' },
  { path: '/import',       tKey: 'nav_import',       Icon: UploadSimple,    color: '#FDCB6E', bg: 'rgba(253,203,110,.15)'},
];

function AnimatedNavItem({ path, tKey, label, Icon, color, bg, t, onClose }) {
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
          <motion.span
            className={styles.navIconWrap}
            style={{ background: isActive ? bg : 'transparent', '--icon-color': color }}
            whileHover={{ scale: 1.12, y: -1 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Icon
              size={18}
              weight={isActive ? 'fill' : 'regular'}
              color={isActive ? color : 'var(--text3)'}
            />
            {isActive && (
              <motion.span
                className={styles.iconGlow}
                style={{ background: color }}
                layoutId="activeGlow"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.span>
          <span className={styles.navLabel}>{label || t(tKey)}</span>
          {isActive && (
            <motion.span
              className={styles.activeBar}
              layoutId="activeBar"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </>
      )}
    </NavLink>
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
          <div className={styles.navSection}>{t('nav_menu')}</div>

          {NAV_ITEMS.map((item) => (
            <AnimatedNavItem key={item.path} {...item} t={t} onClose={onClose} />
          ))}

          <div className={styles.navSection} style={{ marginTop: 8 }}>{t('nav_preferences')}</div>

          <NavLink to="/settings" onClick={onClose}
            className={({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`}>
            {({ isActive }) => (
              <>
                <motion.span
                  className={styles.navIconWrap}
                  style={{ background: isActive ? 'rgba(108,99,255,.15)' : 'transparent' }}
                  whileHover={{ scale: 1.12, y: -1 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Gear size={18} weight={isActive ? 'fill' : 'regular'} color={isActive ? '#6C63FF' : 'var(--text3)'} />
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

          <NavLink to="/help" onClick={onClose}
            className={({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`}>
            {({ isActive }) => (
              <>
                <motion.span
                  className={styles.navIconWrap}
                  style={{ background: isActive ? 'rgba(108,99,255,.15)' : 'transparent' }}
                  whileHover={{ scale: 1.12, y: -1 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Question size={18} weight={isActive ? 'fill' : 'regular'} color={isActive ? '#6C63FF' : 'var(--text3)'} />
                </motion.span>
                <span className={styles.navLabel}>{t('nav_help')}</span>
              </>
            )}
          </NavLink>
        </nav>

        {/* ── Upgrade banner ── */}
        {!user?.is_premium && (
          <motion.div
            className={styles.upgradeBanner}
            onClick={openPremium}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <div className={styles.upgradeBannerGlow} />
            <Crown size={22} color="#FFD700" weight="fill" style={{ marginBottom: 8, position: 'relative', zIndex: 1 }} />
            <div className={styles.upgradeTitle}>{t('sidebar_upgrade_title')}</div>
            <div className={styles.upgradeDesc}>{t('sidebar_upgrade_desc')}</div>
            <button className={styles.upgradeBtn} onClick={e => { e.stopPropagation(); openPremium(); }}>
              {t('sidebar_upgrade_btn')}
            </button>
          </motion.div>
        )}

        {/* ── Bottom ── */}
        <div className={styles.navBottom}>
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
