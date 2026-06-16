import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PageLoader } from './components/ui';
import useAuthStore from './store/authStore';

// Auth pages load eagerly (tiny, needed first)
import { Login, Register, OAuthCallback, ForgotPassword, ResetPassword } from './pages/Auth';

// Everything else is code-split → only downloaded when first visited
const AppLayout    = lazy(() => import('./components/layout/AppLayout'));
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Budget       = lazy(() => import('./pages/Budget'));
const Goals        = lazy(() => import('./pages/Goals'));
const Categories   = lazy(() => import('./pages/Categories'));
const Debts        = lazy(() => import('./pages/Debts'));
const Import       = lazy(() => import('./pages/Import'));
const Recurring    = lazy(() => import('./pages/Recurring'));
const Family       = lazy(() => import('./pages/Family'));
const Admin        = lazy(() => import('./pages/Admin'));
// OtherPages exports several — wrap each in its own lazy chunk
const Wallet       = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Wallet })));
const Analytics    = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Analytics })));
const Settings     = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Settings })));
const Investments  = lazy(() => import('./pages/Investments'));
const DebtReduction= lazy(() => import('./pages/DebtReduction'));
const Challenges   = lazy(() => import('./pages/Challenges'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,      // 5 min — fewer refetches = less mobile data/sync
      gcTime: 24 * 60 * 60_000,   // keep cache 24h for persistence
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
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
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}
