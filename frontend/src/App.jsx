import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PageLoader } from './components/ui';
import ErrorBoundary from './components/ErrorBoundary';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import queryClient from './lib/queryClient';
import { pageView, setUserContext, clearUserContext } from './lib/analytics';

// Auth pages load eagerly (tiny, needed first)
import { Login, Register, OAuthCallback, ForgotPassword, ResetPassword } from './pages/Auth';

/* After a redeploy, an already-open session references old chunk file names
   that no longer exist on the server, so navigating to a not-yet-loaded page
   throws a dynamic-import error and the Suspense loader hangs forever. Catch
   that once and force a single full reload to pick up the fresh index. */
const lazyWithReload = (factory) => lazy(() =>
  factory().catch((err) => {
    const KEY = 'chunk-reload-at';
    const last = parseInt(sessionStorage.getItem(KEY) || '0', 10);
    // Only auto-reload once per 10s to avoid an infinite reload loop
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
      return new Promise(() => {}); // keep suspended until the reload happens
    }
    throw err;
  })
);

// Everything else is code-split → only downloaded when first visited
const AppLayout    = lazyWithReload(() => import('./components/layout/AppLayout'));
const Dashboard    = lazyWithReload(() => import('./pages/Dashboard'));
const Transactions = lazyWithReload(() => import('./pages/Transactions'));
const Budget       = lazyWithReload(() => import('./pages/Budget'));
const Goals        = lazyWithReload(() => import('./pages/Goals'));
const Categories   = lazyWithReload(() => import('./pages/Categories'));
const Debts        = lazyWithReload(() => import('./pages/Debts'));
const Import       = lazyWithReload(() => import('./pages/Import'));
const Recurring    = lazyWithReload(() => import('./pages/Recurring'));
const Forecast     = lazyWithReload(() => import('./pages/Forecast'));
const Family       = lazyWithReload(() => import('./pages/Family'));
const Admin        = lazyWithReload(() => import('./pages/Admin'));
// OtherPages exports several — wrap each in its own lazy chunk
const Wallet       = lazyWithReload(() => import('./pages/Accounts'));
const Settings     = lazyWithReload(() => import('./pages/OtherPages').then(m => ({ default: m.Settings })));
const Insights      = lazyWithReload(() => import('./pages/Insights'));

// Retire browser-only data from the removed Challenges/Investments pages — notably
// the Dhan broker access token, which must not linger in localStorage.
try {
  ['tracksy_challenges', 'tracksy_badges', 'tracksy_investments', 'tracksy_dhan_creds'].forEach((k) => window.localStorage.removeItem(k));
} catch { /* storage unavailable */ }

// Persist the query cache to localStorage → on app open, last data shows
// instantly (no spinner), then refreshes quietly in the background.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'tracksy-cache',
});

/* Analytics: one page_view per route change (public pages included) and the pseudonymous user context.
   Only the id/currency/language/theme are passed on, never the whole user object. */
function PageViewTracker() {
  const { pathname, search } = useLocation();
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const hadUser = useRef(false);

  useEffect(() => { pageView(pathname, search); }, [pathname, search]);

  useEffect(() => {
    if (user?.id) {
      hadUser.current = true;
      setUserContext({ id: user.id, currency: user.currency, language: user.language, theme });
    } else if (hadUser.current) {
      hadUser.current = false;
      clearUserContext();
    }
  }, [user?.id, user?.currency, user?.language, theme]);

  return null;
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60_000, buster: 'v2' }}
    >
      <BrowserRouter>
        <PageViewTracker />
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

            {/* Protected */}
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="goals" element={<Goals />} />
              <Route path="budget" element={<Budget />} />
              <Route path="categories" element={<Categories />} />
              <Route path="debts" element={<Debts />} />
              <Route path="insights" element={<Insights />} />
              <Route path="forecast" element={<Forecast />} />
              <Route path="analytics" element={<Navigate to="/insights" replace />} />
              <Route path="debt-reduction" element={<Navigate to="/debts?tab=payoff" replace />} />
              <Route path="import" element={<Import />} />
              <Route path="recurring" element={<Recurring />} />
              <Route path="family" element={<Family />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}
