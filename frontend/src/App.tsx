import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import PracticeHome from './pages/PracticeHome';
import TimedPractice from './pages/TimedPractice';
import ScoreHistory from './components/ScoreHistory';
import AttemptDetail from './pages/AttemptDetail';
import Admin from './pages/Admin';
import MathPracticeHome from './pages/MathPracticeHome';
import MathTimedPractice from './pages/MathTimedPractice';
import MathAttemptReview from './pages/MathAttemptReview';

export default function App() {
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
          <Route path="/math/:topicSlug" element={<MathPracticeHome />} />
          <Route path="/math/:topicSlug/start" element={<MathTimedPractice />} />
          <Route path="/math-history/:topicSlug" element={<ScoreHistory subject="math" />} />
          <Route path="/math-attempt/:id" element={<MathAttemptReview />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}