import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

// First-run setup: creates the first workspace and its admin. The backend refuses this
// once any user exists, so the page bounces to /login on an already-set-up install.
export default function Setup() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.setupStatus()
      .then((s) => {
        if (!s.needsSetup) navigate('/login', { replace: true });
      })
      .catch(() => {});
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.setup({ workspaceName, name, email, password });
      // Setup signs the session in server-side; refresh the context and enter the app.
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Setup failed');
      setBusy(false);
    }
  };

  const field =
    'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/50';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-[10px] bg-brand-amber grid place-items-center">
            <Zap size={18} className="text-rail" fill="currentColor" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 leading-tight">Selective Coach</h2>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-gray-400">
              NSW Selective Prep
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Welcome — let's set up</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create your workspace and the first admin account. Students are added from the
              Admin page afterwards.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="setup-workspace" className="block text-sm font-medium text-gray-700 mb-1">
              Workspace name
            </label>
            <input id="setup-workspace" required value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="setup-name" className="block text-sm font-medium text-gray-700 mb-1">
              Your name
            </label>
            <input id="setup-name" required value={name}
              onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="setup-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input id="setup-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="setup-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input id="setup-password" type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} className={field} />
            <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Creating workspace…' : 'Create workspace'}
          </Button>
        </form>
      </div>
    </div>
  );
}
