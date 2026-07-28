import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PageLoader } from './components/ui';
import useAuthStore from './store/authStore';

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
const Family       = lazyWithReload(() => import('./pages/Family'));
const Admin        = lazyWithReload(() => import('./pages/Admin'));
// OtherPages exports several — wrap each in its own lazy chunk
const Wallet       = lazyWithReload(() => import('./pages/Accounts'));
const Analytics    = lazyWithReload(() => import('./pages/OtherPages').then(m => ({ default: m.Analytics })));
const Settings     = lazyWithReload(() => import('./pages/OtherPages').then(m => ({ default: m.Settings })));
const Investments   = lazyWithReload(() => import('./pages/Investments'));
const DebtReduction = lazyWithReload(() => import('./pages/DebtReduction'));
const Challenges    = lazyWithReload(() => import('./pages/Challenges'));
const SmartInsights = lazyWithReload(() => import('./pages/SmartInsights'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Short staleTime: cached data still paints instantly (no spinner), but a
      // background refresh starts right away so edits/deletes appear immediately.
      staleTime: 15_000,
      gcTime: 24 * 60 * 60_000,   // keep cache 24h for offline-first paint
      // Re-sync when the user returns to the tab / regains connectivity —
      // cheap (only stale queries refetch) and keeps screens truthful.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Always revalidate on navigation; cached data shows first, so it's
      // still instant — just never wrong.
      refetchOnMount: 'always',
    },
  },
});

// Persist the query cache to localStorage → on app open, last data shows
// instantly (no spinner), then refreshes quietly in the background.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'tracksy-cache',
});

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
      persistOptions={{ persister, maxAge: 24 * 60 * 60_000 }}
    >
      <BrowserRouter>
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
              <Route path="analytics" element={<Analytics />} />
              <Route path="import" element={<Import />} />
              <Route path="recurring" element={<Recurring />} />
              <Route path="family" element={<Family />} />
              <Route path="settings" element={<Settings />} />
              <Route path="investments" element={<Investments />} />
              <Route path="debt-reduction" element={<DebtReduction />} />
              <Route path="challenges" element={<Challenges />} />
              <Route path="insights" element={<SmartInsights />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}
