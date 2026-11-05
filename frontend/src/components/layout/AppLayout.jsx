import { useEffect, useState, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { List } from '@phosphor-icons/react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { PageLoader } from '../ui';
import useThemeStore from '../../store/themeStore';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  const { initTheme } = useThemeStore();
  const { updateUser } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Always close the mobile sidebar drawer (and its blurred overlay) on any
  // route change — otherwise navigating via the bottom nav leaves it stuck.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    initTheme();
    api.get('/auth/me').then(r => {
      if (r.data?.user) updateUser(r.data.user);
    }).catch(() => {});

    // Warm the page chunks the user is most likely to open next, during idle
    // time, so the first tap on a tab doesn't wait ~2s for a network fetch.
    const prefetch = () => {
      import('../../pages/Accounts');
      import('../../pages/Budget');
      import('../../pages/Goals');
      import('../../pages/Transactions');
    };
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const id = idle(prefetch);
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, []);

  return (
    <div className={styles.layout}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sidebar-overlay visible"
            onClick={() => setSidebarOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={styles.main}>
        {/* Mobile top bar */}
        <div className={styles.mobileBar}>
          <motion.button
            className={styles.hamburger}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <List size={22} weight="bold" />
          </motion.button>
          <span className={styles.mobileLogo}>Tracksy</span>
          <div style={{ width: 34 }} />
        </div>

        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
