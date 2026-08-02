import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House, ArrowsLeftRight, Wallet, Target, ChartPie,
  Users, Tag, CreditCard, ArrowsClockwise, TrendUp,
  UploadSimple, Gear, Moon, Sun, Crown, SignOut, X,
  Question, ChartLineUp, Scales, Trophy, Lightbulb
} from '@phosphor-icons/react';
import useAuthStore from '../../store/authStore';
import useThemeStore from '../../store/themeStore';
import usePremiumStore from '../../store/premiumStore';
import { useT } from '../../i18n';
import InstallPWA from '../InstallPWA';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { path: '/',             tKey: 'nav_dashboard',    Icon: House,           color: '#22C55E', bg: 'rgba(34,197,94,.12)'   },
  { path: '/transactions', tKey: 'nav_transactions', Icon: ArrowsLeftRight, color: '#EC4899', bg: 'rgba(236,72,153,.12)'  },
  { path: '/wallet',       tKey: 'nav_accounts',     Icon: Wallet,          color: '#3B82F6', bg: 'rgba(59,130,246,.12)'  },
  { path: '/goals',        tKey: 'nav_goals',        Icon: Target,          color: '#F59E0B', bg: 'rgba(245,158,11,.12)'  },
  { path: '/budget',       tKey: 'nav_budget',       Icon: ChartPie,        color: '#8B5CF6', bg: 'rgba(139,92,246,.12)'  },
  { path: '/family',       label: 'Family',          Icon: Users,           color: '#EC4899', bg: 'rgba(236,72,153,.12)'  },
  { path: '/investments',   label: 'Investments',     Icon: ChartLineUp,     color: '#22C55E', bg: 'rgba(34,197,94,.12)'   },
  { path: '/debts',        tKey: 'nav_debts',        Icon: CreditCard,      color: '#EC4899', bg: 'rgba(236,72,153,.12)'  },
  { path: '/debt-reduction',label:'Debt Reduction',  Icon: Scales,          color: '#F59E0B', bg: 'rgba(245,158,11,.12)'  },
  { path: '/challenges',   label: 'Challenges',      Icon: Trophy,          color: '#8B5CF6', bg: 'rgba(139,92,246,.12)'  },
  { path: '/recurring',    tKey: 'nav_recurring',    Icon: ArrowsClockwise, color: '#00CEC9', bg: 'rgba(0,206,201,.12)'   },
  { path: '/insights',     label: 'Smart Insights',  Icon: Lightbulb,       color: '#F59E0B', bg: 'rgba(245,158,11,.12)'  },
  { path: '/analytics',    tKey: 'nav_analytics',    Icon: TrendUp,         color: '#3B82F6', bg: 'rgba(59,130,246,.12)'  },
  { path: '/import',       tKey: 'nav_import',       Icon: UploadSimple,    color: '#A78BFA', bg: 'rgba(167,139,250,.12)' },
];

function AnimatedNavItem({ path, tKey, label, Icon, color, bg, t, onClose }) {
  return (
    <NavLink
      key={path}
      to={path}
      end={path === '/'}
      onClick={onClose}
      className={({ isActive }) => `${styles.navItem}${isActive ? ' ' + styles.active : ''}`}
      style={({ isActive }) => isActive ? { background: bg, color } : undefined}
    >
      {({ isActive }) => (
        <>
          <motion.span
            className={styles.navIconWrap}
            style={{ background: 'transparent', '--icon-color': color }}
            whileHover={{ scale: 1.12, y: -1 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Icon
              size={18}
              weight={isActive ? 'fill' : 'regular'}
              color={isActive ? color : 'var(--text3)'}
            />
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
                  style={{ background: isActive ? 'rgba(139,92,246,.12)' : 'transparent' }}
                  whileHover={{ scale: 1.12, y: -1 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Gear size={18} weight={isActive ? 'fill' : 'regular'} color={isActive ? '#8B5CF6' : 'var(--text3)'} />
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
                  style={{ background: isActive ? 'rgba(139,92,246,.12)' : 'transparent' }}
                  whileHover={{ scale: 1.12, y: -1 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Question size={18} weight={isActive ? 'fill' : 'regular'} color={isActive ? '#8B5CF6' : 'var(--text3)'} />
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
