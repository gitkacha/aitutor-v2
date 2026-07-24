import { randomUUID } from 'crypto';

// In-memory pending confirmable actions (M3b Task 6): action tools the chat model wants to
// run (generate/save/assign a worksheet, create an intervention) are NOT auto-executed —
// they are parked here, workspace-scoped, until the admin confirms them (the confirm route,
// Task 9, runs executeActionTool then deletes the pending action). Mirrors generation-jobs.ts:
// an in-memory Map keyed by randomUUID with a TTL sweep. Lost on process restart — acceptable
// for a local single-process app (an unconfirmed action just needs re-proposing).

export interface PendingAction {
  id: string;
  workspaceId: number;
  toolName: string;
  args: any;
  createdAt: number;
}

const actions = new Map<string, PendingAction>();
const TTL_MS = 30 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [id, action] of actions) {
    if (now - action.createdAt > TTL_MS) actions.delete(id);
  }
}

export function createPendingAction(workspaceId: number, toolName: string, args: any): PendingAction {
  sweep();
  const action: PendingAction = { id: randomUUID(), workspaceId, toolName, args, createdAt: Date.now() };
  actions.set(action.id, action);
  return action;
}

// Returns the pending action only if it belongs to the given workspace (else undefined → 404).
export function getPendingAction(id: string, workspaceId: number): PendingAction | undefined {
  const action = actions.get(id);
  return action && action.workspaceId === workspaceId ? action : undefined;
}

export function deletePendingAction(id: string): void {
  actions.delete(id);
}
