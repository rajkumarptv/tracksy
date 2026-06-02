import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
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
    // Always fetch fresh user data on load so is_premium / is_admin are current
    api.get('/auth/me').then(r => {
      if (r.data?.user) updateUser(r.data.user);
    }).catch(() => {});
  }, []);

  return (
    <div className={styles.layout}>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={styles.main}>
        {/* Mobile top bar */}
        <div className={styles.mobileBar}>
          <button className={styles.hamburger} onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className={styles.mobileLogo}>Tracksy</span>
        </div>

        <Outlet />
      </main>

      {premiumOpen && <PremiumModal onClose={closePremium}/>}
    </div>
  );
}
