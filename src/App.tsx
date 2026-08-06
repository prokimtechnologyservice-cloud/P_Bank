import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AdminProvider, useAdmin } from '@/context/AdminContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { supabase } from '@/lib/supabase';
import AuthScreen from '@/screens/AuthScreen';
import HomeScreen from '@/screens/HomeScreen';
import TransferScreen from '@/screens/TransferScreen';
import MyQrScreen from '@/screens/MyQrScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import SlipScreen from '@/screens/SlipScreen';
import MerchantScreen from '@/screens/MerchantScreen';
import PayScreen from '@/screens/PayScreen';
import PinScreen from '@/screens/PinScreen';
import SetPinScreen from '@/screens/SetPinScreen';
import QrScanScreen from '@/screens/QrScanScreen';
import CurrencyScreen from '@/screens/CurrencyScreen';
import AdminLoginScreen from '@/screens/AdminLoginScreen';
import EmployeeLoginScreen from '@/screens/EmployeeLoginScreen';
import AdminLayout from '@/screens/AdminLayout';
import AdminDashboard from '@/screens/AdminDashboard';
import AdminUsersScreen from '@/screens/AdminUsersScreen';
import AdminTransactionsScreen from '@/screens/AdminTransactionsScreen';
import AdminMerchantsScreen from '@/screens/AdminMerchantsScreen';
import AdminChargesScreen from '@/screens/AdminChargesScreen';
import AdminCreateAccountScreen from '@/screens/AdminCreateAccountScreen';
import AdminEmployeesScreen from '@/screens/AdminEmployeesScreen';
import AdminActivityLogsScreen from '@/screens/AdminActivityLogsScreen';
import { Wallet } from 'lucide-react';

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-pulse text-emerald-500">
        <Wallet className="w-10 h-10" />
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PinProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const [pinStatus, setPinStatus] = useState<'checking' | 'no_pin' | 'has_pin' | 'no_profile'>('checking');

  useEffect(() => {
    async function checkPin() {
      if (!session?.user) {
        setPinStatus('no_profile');
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('pin_hash')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!data) {
        // Stale session — no profile exists. Sign out to break redirect loop.
        sessionStorage.removeItem('pbank_pin_verified');
        await signOut();
        setPinStatus('no_profile');
      } else if (!data.pin_hash) {
        setPinStatus('no_pin');
      } else {
        setPinStatus('has_pin');
      }
    }
    if (loading) return;
    if (!session) {
      setPinStatus('no_profile');
      return;
    }
    checkPin();
  }, [session, loading]);

  if (loading || pinStatus === 'checking') return <FullScreenLoader />;

  if (pinStatus === 'no_profile' || !session) {
    return <Navigate to="/auth" replace />;
  }

  if (pinStatus === 'no_pin') {
    return <Navigate to="/set-pin" replace />;
  }

  const pinVerified = sessionStorage.getItem('pbank_pin_verified') === 'true';
  if (!pinVerified) return <Navigate to="/pin" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (session) return <Navigate to="/pin" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdmin();
  if (loading) return <FullScreenLoader />;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/auth" element={<PublicRoute><AuthScreen /></PublicRoute>} />

      {/* PIN */}
      <Route path="/pin" element={<ProtectedRoute><PinScreen /></ProtectedRoute>} />
      <Route path="/set-pin" element={<ProtectedRoute><SetPinScreen /></ProtectedRoute>} />

      {/* Bank user routes (PIN protected) */}
      <Route path="/" element={<PinProtectedRoute><HomeScreen /></PinProtectedRoute>} />
      <Route path="/transfer" element={<PinProtectedRoute><TransferScreen /></PinProtectedRoute>} />
      <Route path="/my-qr" element={<PinProtectedRoute><MyQrScreen /></PinProtectedRoute>} />
      <Route path="/history" element={<PinProtectedRoute><HistoryScreen /></PinProtectedRoute>} />
      <Route path="/slip/:id" element={<PinProtectedRoute><SlipScreen /></PinProtectedRoute>} />
      <Route path="/merchant" element={<PinProtectedRoute><MerchantScreen /></PinProtectedRoute>} />
      <Route path="/pay/:code" element={<PinProtectedRoute><PayScreen /></PinProtectedRoute>} />
      <Route path="/qr-scan" element={<PinProtectedRoute><QrScanScreen /></PinProtectedRoute>} />
      <Route path="/currency" element={<PinProtectedRoute><CurrencyScreen /></PinProtectedRoute>} />

      {/* Admin routes */}
      <Route path="/admin/login" element={<AdminLoginScreen />} />
      <Route path="/admin/employee-login" element={<EmployeeLoginScreen />} />
      <Route path="/admin" element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminLayout><AdminUsersScreen /></AdminLayout></AdminRoute>} />
      <Route path="/admin/create-account" element={<AdminRoute><AdminLayout><AdminCreateAccountScreen /></AdminLayout></AdminRoute>} />
      <Route path="/admin/transactions" element={<AdminRoute><AdminLayout><AdminTransactionsScreen /></AdminLayout></AdminRoute>} />
      <Route path="/admin/merchants" element={<AdminRoute><AdminLayout><AdminMerchantsScreen /></AdminLayout></AdminRoute>} />
      <Route path="/admin/charges" element={<AdminRoute><AdminLayout><AdminChargesScreen /></AdminLayout></AdminRoute>} />
      <Route path="/admin/employees" element={<AdminRoute><AdminLayout><AdminEmployeesScreen /></AdminLayout></AdminRoute>} />
      <Route path="/admin/activity-logs" element={<AdminRoute><AdminLayout><AdminActivityLogsScreen /></AdminLayout></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AdminProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AdminProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
