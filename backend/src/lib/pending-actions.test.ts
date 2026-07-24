import { describe, it, expect } from 'vitest';
import { createPendingAction, getPendingAction, deletePendingAction } from './pending-actions';

// M3b Task 6: the pending-action store gates confirmable action tools. A tool call the
// admin has not yet confirmed lives here (workspace-scoped) until the confirm route runs
// it. Mirrors generation-jobs.ts (in-memory Map keyed by uuid, workspace-scoped).

describe('pending-actions store', () => {
  it('createPendingAction returns a pending action carrying its inputs', () => {
    const action = createPendingAction(1, 'generate_worksheet', { subject: 'math', questionCount: 10 });
    expect(action.id).toBeTruthy();
    expect(action.workspaceId).toBe(1);
    expect(action.toolName).toBe('generate_worksheet');
    expect(action.args).toEqual({ subject: 'math', questionCount: 10 });
    expect(typeof action.createdAt).toBe('number');
  });

  it('getPendingAction returns the action for a matching workspace', () => {
    const action = createPendingAction(7, 'save_and_assign_worksheet', { title: 'X' });
    expect(getPendingAction(action.id, 7)).toEqual(action);
  });

  it('getPendingAction returns undefined for a different workspace', () => {
    const action = createPendingAction(7, 'generate_worksheet', {});
    expect(getPendingAction(action.id, 99)).toBeUndefined();
  });

  it('getPendingAction returns undefined for an unknown id', () => {
    expect(getPendingAction('does-not-exist', 1)).toBeUndefined();
  });

  it('deletePendingAction removes the action', () => {
    const action = createPendingAction(3, 'generate_worksheet', {});
    expect(getPendingAction(action.id, 3)).toBeDefined();
    deletePendingAction(action.id);
    expect(getPendingAction(action.id, 3)).toBeUndefined();
  });

  it('two creates yield different ids', () => {
    const a = createPendingAction(1, 'generate_worksheet', {});
    const b = createPendingAction(1, 'generate_worksheet', {});
    expect(a.id).not.toBe(b.id);
  });
});
