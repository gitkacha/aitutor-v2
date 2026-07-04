import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import PracticeHome from './pages/PracticeHome';
import TimedPractice from './pages/TimedPractice';
import ScoreHistory from './components/ScoreHistory';
import AttemptDetail from './pages/AttemptDetail';

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/practice/:typeSlug" element={<PracticeHome />} />
          <Route path="/practice/:typeSlug/start" element={<TimedPractice />} />
          <Route path="/history/:typeSlug" element={<ScoreHistory />} />
          <Route path="/attempt/:id" element={<AttemptDetail />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}