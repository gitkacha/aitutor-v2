import { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, RequireAuth, useAuth } from './lib/auth';
import { Navigate as Nav } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Setup from './pages/Setup';
import SuperAdmin from './pages/SuperAdmin';
import Dashboard from './pages/Dashboard';
import PracticeHome from './pages/PracticeHome';
import TimedPractice from './pages/TimedPractice';
import ScoreHistory from './components/ScoreHistory';
import AttemptDetail from './pages/AttemptDetail';
import Admin from './pages/Admin';
import MathPracticeHome from './pages/MathPracticeHome';
import MathTimedPractice from './pages/MathTimedPractice';
import MathAttemptReview from './pages/MathAttemptReview';
import Skills from './pages/Skills';

// Super-admin-only route guard (W-15): non-super users are sent to the dashboard.
function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.isSuperAdmin ? <>{children}</> : <Nav to="/dashboard" replace />;
}

// Admin-only route guard (M3a Task 10): mirrors RequireSuperAdmin — students are sent
// to the dashboard rather than seeing a broken/empty admin surface.
function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? <>{children}</> : <Nav to="/dashboard" replace />;
}

// The signed-in application shell — everything behind the auth guard (W-11).
function AppShell() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/practice/:typeSlug" element={<PracticeHome />} />
          <Route path="/practice/:typeSlug/start" element={<TimedPractice />} />
          <Route path="/history/:typeSlug" element={<ScoreHistory />} />
          <Route path="/attempt/:id" element={<AttemptDetail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/skills" element={<RequireAdmin><Skills /></RequireAdmin>} />
          <Route path="/superadmin" element={<RequireSuperAdmin><SuperAdmin /></RequireSuperAdmin>} />
          <Route path="/math/:topicSlug" element={<MathPracticeHome />} />
          <Route path="/math/:topicSlug/start" element={<MathTimedPractice />} />
          {/* ScoreHistory reads :typeSlug for both subjects */}
          <Route path="/math-history/:typeSlug" element={<ScoreHistory subject="math" />} />
          <Route path="/math-attempt/:id" element={<MathAttemptReview />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
