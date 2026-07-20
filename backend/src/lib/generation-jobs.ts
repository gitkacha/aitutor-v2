import { randomUUID } from 'crypto';

// In-memory worksheet-generation jobs (W-19): generation runs server-side so the admin can
// navigate away and re-attach on return by polling. Jobs are workspace-scoped and cleaned
// up a while after they finish. Lost only if the backend process restarts mid-run — an
// acceptable trade-off for a local single-process app.

export type JobStatus = 'running' | 'done' | 'error';

export interface GenerationJob {
  id: string;
  kind: 'math' | 'writing';
  workspaceId: number;
  status: JobStatus;
  result?: unknown;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, GenerationJob>();
const TTL_MS = 30 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.status !== 'running' && now - job.createdAt > TTL_MS) jobs.delete(id);
  }
}

// Starts `run` in the background and returns the job id immediately.
export function createJob(
  kind: GenerationJob['kind'],
  workspaceId: number,
  run: () => Promise<unknown>
): string {
  sweep();
  const job: GenerationJob = { id: randomUUID(), kind, workspaceId, status: 'running', createdAt: Date.now() };
  jobs.set(job.id, job);
  run()
    .then((result) => { job.status = 'done'; job.result = result; })
    .catch((e) => { job.status = 'error'; job.error = e?.message || 'Generation failed'; });
  return job.id;
}

// Returns the job only if it belongs to the given workspace (else undefined → 404).
export function getJobForWorkspace(id: string, workspaceId: number): GenerationJob | undefined {
  const job = jobs.get(id);
  return job && job.workspaceId === workspaceId ? job : undefined;
}
