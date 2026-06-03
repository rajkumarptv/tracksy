import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
const Wallet     = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Wallet })));
const Analytics  = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Analytics })));
const Settings   = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Settings })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,      // 5 min — fewer refetches = less mobile data/sync
      gcTime: 30 * 60_000,        // keep cache 30 min
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
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
    <QueryClientProvider client={queryClient}>
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
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
