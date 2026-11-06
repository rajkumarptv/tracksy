import { useEffect, useState, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MagnifyingGlass } from '@phosphor-icons/react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import CommandPalette from './CommandPalette';
import { pageTitle } from './nav';
import { PageLoader } from '../ui';
import useThemeStore from '../../store/themeStore';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  const { initTheme } = useThemeStore();
  const { updateUser, user } = useAuthStore();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  // Cmd/Ctrl+K opens the command palette from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      <Sidebar isOpen={false} onClose={() => {}} />

      <main className={styles.main}>
        {/* Mobile top bar: current screen, search, profile */}
        <div className={styles.mobileBar}>
          <h1 className={styles.mobileTitle}>{pageTitle(location.pathname)}</h1>
          <div className={styles.mobileActions}>
            <button type="button" className={styles.iconBtn} onClick={() => setPaletteOpen(true)} aria-label="Search">
              <MagnifyingGlass size={20} />
            </button>
            <button type="button" className={styles.avatarBtn} onClick={() => navigate('/settings')} aria-label="Settings and profile">
              {`${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U'}
            </button>
          </div>
        </div>

        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
