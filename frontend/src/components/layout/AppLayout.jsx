import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { List } from '@phosphor-icons/react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import useThemeStore from '../../store/themeStore';
import usePremiumStore from '../../store/premiumStore';
import useAuthStore from '../../store/authStore';
import { PremiumModal } from '../../pages/OtherPages';
import api from '../../services/api';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  const { initTheme } = useThemeStore();
  const { open: premiumOpen, closePremium } = usePremiumStore();
  const { updateUser } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    initTheme();
    api.get('/auth/me').then(r => {
      if (r.data?.user) updateUser(r.data.user);
    }).catch(() => {});
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

        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />

      {premiumOpen && <PremiumModal onClose={closePremium} />}
    </div>
  );
}
