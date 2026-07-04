import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <div className="text-center py-20">
                <h1 className="text-2xl font-semibold text-gray-700">Progress Dashboard</h1>
                <p className="text-gray-500 mt-2">No attempts yet. Start practising to see your progress.</p>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}