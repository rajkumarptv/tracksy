import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House, Wallet, ChartPie, Target, X,
  ArrowUp, ArrowDown, ArrowsClockwise
} from '@phosphor-icons/react';
import styles from './BottomNav.module.css';

const LEFT_TABS = [
  { path: '/',       Icon: House,  label: 'Dashboard', color: '#4F46E5' },
  { path: '/wallet', Icon: Wallet, label: 'Accounts',  color: '#4F46E5' },
];
const RIGHT_TABS = [
  { path: '/budget', Icon: ChartPie, label: 'Budget', color: '#4F46E5' },
  { path: '/goals',  Icon: Target,   label: 'Goals',  color: '#4F46E5' },
];

const ACTION_OPTIONS = [
  { key: 'income',   icon: ArrowUp,          label: 'Income',   color: '#059669', bg: 'rgba(5,150,105,.13)',   route: '/transactions?add=income'   },
  { key: 'expense',  icon: ArrowDown,        label: 'Expense',  color: '#DC2626', bg: 'rgba(220,38,38,.13)',  route: '/transactions?add=expense'  },
  { key: 'transfer', icon: ArrowsClockwise,  label: 'Transfer', color: '#4F46E5', bg: 'rgba(79,70,229,.13)',  route: '/transactions?add=transfer' },
];

function Tab({ path, Icon, label, color }) {
  const location = useLocation();
  const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  return (
    <NavLink to={path} className={styles.tabItem} end={path === '/'}>
      <motion.div className={styles.tabContent} whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
        {isActive && (
          <motion.div className={styles.activePill} layoutId="bottomNavPill"
            style={{ background: `${color}20` }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
        )}
        <motion.div className={styles.iconWrap}
          animate={isActive ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
          {isActive && (
            <motion.div className={styles.iconGlow} style={{ background: color }}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }} />
          )}
          <Icon size={22} weight={isActive ? 'fill' : 'regular'} color={isActive ? color : 'var(--text3)'} />
        </motion.div>
        <motion.span className={styles.tabLabel}
          animate={{ color: isActive ? color : 'var(--text3)', fontWeight: isActive ? 700 : 500 }}
          transition={{ duration: 0.15 }}>
          {label}
        </motion.span>
      </motion.div>
    </NavLink>
  );
}

export default function BottomNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Always close the action sheet when the route changes, otherwise the
  // blurred backdrop stays stuck over the new page until a manual refresh.
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);

  // Close on back gesture / escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleAction = (route) => {
    setOpen(false);
    navigate(route);
  };

  return (
    <>
      {/* Action sheet backdrop + cards */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className={styles.backdrop}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)} />

            <motion.div className={styles.actionSheetOuter}
              initial={{ y: 12, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 480, damping: 34 }}>

              <div className={styles.actionSheet}>
                <div className={styles.sheetLabel}>Add Transaction</div>
                <div className={styles.actionRow}>
                  {ACTION_OPTIONS.map(({ key, icon: Icon, label, color, route }, i) => (
                    <motion.button key={key} className={styles.actionItem}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleAction(route)}>
                      <div className={styles.actionIconWrap} style={{ background: `${color}18`, border: `1.5px solid ${color}30` }}>
                        <Icon size={20} color={color} weight="bold" />
                      </div>
                      <span className={styles.actionLabel} style={{ color }}>{label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav className={styles.bottomNav}>
        <div className={styles.navInner}>
          {LEFT_TABS.map(t => <Tab key={t.path} {...t} />)}

          {/* Center FAB */}
          <div className={styles.fabWrap}>
            <motion.button className={styles.fab}
              whileTap={{ scale: 0.88 }}
              animate={open ? { rotate: 45 } : { rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              onClick={() => setOpen(v => !v)}>
              <X size={26} color="#fff" weight="bold"
                style={{ transform: open ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform .2s' }} />
            </motion.button>
            <span className={styles.fabLabel}>Add</span>
          </div>

          {RIGHT_TABS.map(t => <Tab key={t.path} {...t} />)}
        </div>
      </nav>
    </>
  );
}
