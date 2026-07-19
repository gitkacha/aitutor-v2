import { useEffect, useState } from 'react';
import { superAdminApi, WorkspaceSummary, WorkspaceOversight } from '@/lib/api';
import Heatmap from '@/components/Heatmap';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Users } from 'lucide-react';

// Platform console (W-15): super-admin only (guarded in App.tsx). Lists every workspace,
// creates a workspace + its first admin, and shows read-only per-workspace oversight.
export default function SuperAdmin() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ workspaceName: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [selected, setSelected] = useState<WorkspaceOversight | null>(null);

  const load = () => superAdminApi.listWorkspaces().then((r) => setWorkspaces(r.workspaces)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setMessage(null);
    if (!form.workspaceName || !form.adminName || !form.adminEmail || form.adminPassword.length < 8) {
      setMessage('Error: all fields are required and the password must be at least 8 characters.');
      return;
    }
    try {
      const { workspace } = await superAdminApi.createWorkspace(form);
      setForm({ workspaceName: '', adminName: '', adminEmail: '', adminPassword: '' });
      setShowCreate(false);
      setMessage(`Workspace "${workspace.name}" created with its first admin.`);
      load();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };

  const openOversight = async (id: number) => {
    setSelected(null);
    try {
      setSelected(await superAdminApi.getWorkspace(id));
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };

  const field = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Building2 size={24} className="text-brand-amber" />
        <h1 className="text-2xl font-bold text-gray-900">Platform</h1>
      </div>

      {message && (
        <div className="bg-brand-amber/10 border border-brand-amber/30 rounded-xl p-4 text-sm text-gray-700">{message}</div>
      )}

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Workspaces</h2>
          {!showCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} className="mr-1" /> Create workspace
            </Button>
          )}
        </div>

        {showCreate && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="sm:col-span-2">
              <label htmlFor="ws-name" className="block text-sm font-medium text-gray-700 mb-1">Workspace name</label>
              <input id="ws-name" value={form.workspaceName}
                onChange={(e) => setForm({ ...form, workspaceName: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="ws-admin-name" className="block text-sm font-medium text-gray-700 mb-1">Admin name</label>
              <input id="ws-admin-name" value={form.adminName}
                onChange={(e) => setForm({ ...form, adminName: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="ws-admin-email" className="block text-sm font-medium text-gray-700 mb-1">Admin email</label>
              <input id="ws-admin-email" type="email" value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="ws-admin-password" className="block text-sm font-medium text-gray-700 mb-1">Admin password</label>
              <input id="ws-admin-password" type="password" value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} className={field} />
              <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button size="sm" onClick={handleCreate}>Create workspace</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => openOversight(w.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-brand-blue/50 hover:bg-gray-50 text-left text-sm transition-colors"
            >
              <span className="font-medium text-gray-900">
                {w.name}
                {w.isDemo && <span className="ml-2 text-xs text-gray-400">demo</span>}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Users size={13} /> {w.adminCount} admin{w.adminCount !== 1 ? 's' : ''} · {w.studentCount} student{w.studentCount !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">{selected.workspace.name} — oversight</h2>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Members</h3>
            <div className="space-y-1">
              {selected.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 text-sm">
                  <span><span className="font-medium text-gray-900">{m.name}</span> <span className="text-gray-400">· {m.email}</span></span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.role === 'admin' ? 'bg-brand-amber/15 text-brand-amber' : 'bg-brand-blue/10 text-brand-blue'}`}>
                    {m.role === 'admin' ? 'Admin' : 'Student'}{m.isSuperAdmin ? ' · super' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Writing performance</h3>
            <Heatmap data={selected.writingHeatmap} onSelect={() => {}} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Mathematics performance</h3>
            <Heatmap
              data={selected.mathHeatmap.map((d) => ({
                typeId: d.topicId, typeName: d.topicName, typeSlug: d.topicSlug,
                averageScore: d.averageScore, attemptCount: d.attemptCount,
              }))}
              basePath="math"
              onSelect={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
