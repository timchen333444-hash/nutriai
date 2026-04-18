import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { UnitsProvider } from './context/UnitsContext';
import { AlertsProvider } from './context/AlertsContext';
import { useToast } from './context/ToastContext';
import BottomNav from './components/layout/BottomNav';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import OnboardingWizard from './pages/Onboarding/OnboardingWizard';
import Today from './pages/Today';
import Library from './pages/Library';
import AIPlan from './pages/AIPlan';
import Insights from './pages/Insights';
import Profile from './pages/Profile';
import WeeklyReportModal, { dismissedThisWeek } from './components/ui/WeeklyReportModal';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary-light">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // Show a friendly toast when the global 401 interceptor fires
  useEffect(() => {
    const handler = () => {
      toast.error('Your session has expired. Please sign in again.');
    };
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [toast]);

  // Background auto-sync: trigger Google Fit sync silently on every app load
  const hasSynced = useRef(false);
  useEffect(() => {
    if (!user?.onboardingComplete || hasSynced.current) return;
    hasSynced.current = true;
    axios.get('/api/integrations/status')
      .then(({ data }) => {
        if (data.google_fit?.isConnected) {
          axios.get('/api/integrations/google/sync').catch(() => {});
        }
      })
      .catch(() => {});
  }, [user?.onboardingComplete]);

  // Show weekly report modal on Sundays if enabled and not yet dismissed this week
  useEffect(() => {
    if (!user?.onboardingComplete) return;
    const isSunday = new Date().getDay() === 0;
    if (isSunday && user?.alertSettings?.weeklyReport && !dismissedThisWeek()) {
      setShowWeeklyReport(true);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary-light">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen">
      <div className="w-full max-w-app bg-white min-h-screen relative">
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />
          <Route
            path="/onboarding"
            element={user && !user.onboardingComplete ? <OnboardingWizard /> : <Navigate to="/" replace />}
          />
          <Route path="/" element={<ProtectedRoute><Today /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/ai-plan" element={<ProtectedRoute><AIPlan /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {user && user.onboardingComplete && <BottomNav />}
        {showWeeklyReport && (
          <WeeklyReportModal onClose={() => setShowWeeklyReport(false)} />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <UnitsProvider>
            <AlertsProvider>
              <AppRoutes />
            </AlertsProvider>
          </UnitsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
