import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House, ArrowsLeftRight, ChartPie, Target, X,
  ArrowUp, ArrowDown, ArrowsClockwise
} from '@phosphor-icons/react';
import styles from './BottomNav.module.css';

const LEFT_TABS = [
  { path: '/',             Icon: House,           label: 'Home',         color: '#6C63FF' },
  { path: '/transactions', Icon: ArrowsLeftRight, label: 'Transactions', color: '#FF5B5B' },
];
const RIGHT_TABS = [
  { path: '/budget',       Icon: ChartPie,        label: 'Budget',       color: '#5B8CFF' },
  { path: '/goals',        Icon: Target,          label: 'Goals',        color: '#FFB300' },
];

const ACTION_OPTIONS = [
  { key: 'income',   icon: ArrowUp,          label: 'Income',   color: '#00C896', bg: 'rgba(0,200,150,.13)',  route: '/transactions?add=income'   },
  { key: 'expense',  icon: ArrowDown,        label: 'Expense',  color: '#FF5B5B', bg: 'rgba(255,91,91,.13)',  route: '/transactions?add=expense'  },
  { key: 'transfer', icon: ArrowsClockwise,  label: 'Transfer', color: '#6C63FF', bg: 'rgba(108,99,255,.13)', route: '/transactions?add=transfer' },
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

            <motion.div className={styles.actionSheet}
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}>

              <div className={styles.sheetHandle} />
              <div className={styles.sheetTitle}>Add Transaction</div>

              <div className={styles.actionGrid}>
                {ACTION_OPTIONS.map(({ key, icon: Icon, label, color, bg, route }) => (
                  <motion.button key={key} className={styles.actionCard}
                    style={{ background: bg, borderColor: `${color}35` }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => handleAction(route)}>
                    <div className={styles.actionIconWrap} style={{ background: `${color}22` }}>
                      <Icon size={26} color={color} weight="bold" />
                    </div>
                    <span className={styles.actionLabel} style={{ color }}>{label}</span>
                  </motion.button>
                ))}
              </div>

              <button className={styles.sheetCancel} onClick={() => setOpen(false)}>Cancel</button>
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
