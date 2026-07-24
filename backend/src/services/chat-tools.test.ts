import { describe, it, expect } from 'vitest';
import { READ_TOOL_SCHEMAS, ACTION_TOOL_SCHEMAS, isActionTool } from './chat-tools';

// M3b Task 5: chat read-tool schemas + isActionTool. Purely structural — dispatchReadTool's
// DB behaviour is integration-tested by the Task 7/9 chat e2e, not unit-mocked here.

describe('READ_TOOL_SCHEMAS', () => {
  const expectedNames = [
    'list_students',
    'get_student_skill_report',
    'get_opportunity_areas',
    'get_attempt_details',
    'get_intervention_history',
  ];

  it('contains exactly the 5 expected read tool names', () => {
    expect(READ_TOOL_SCHEMAS.map((t) => t.name).sort()).toEqual([...expectedNames].sort());
  });

  it('each schema has a non-empty description and object-typed parameters', () => {
    for (const tool of READ_TOOL_SCHEMAS) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.parameters).toMatchObject({ type: 'object' });
    }
  });
});

describe('ACTION_TOOL_SCHEMAS', () => {
  it('contains exactly generate_worksheet, save_and_assign_worksheet, create_intervention', () => {
    expect(ACTION_TOOL_SCHEMAS.map((t) => t.name)).toEqual([
      'generate_worksheet',
      'save_and_assign_worksheet',
      'create_intervention',
    ]);
  });

  it('each schema has a non-empty description and object-typed parameters', () => {
    for (const tool of ACTION_TOOL_SCHEMAS) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.parameters).toMatchObject({ type: 'object' });
    }
  });
});

describe('isActionTool', () => {
  it('returns false for read tools', () => {
    expect(isActionTool('get_student_skill_report')).toBe(false);
    expect(isActionTool('list_students')).toBe(false);
  });

  it('returns true for action tools', () => {
    expect(isActionTool('create_intervention')).toBe(true);
    expect(isActionTool('generate_worksheet')).toBe(true);
    expect(isActionTool('save_and_assign_worksheet')).toBe(true);
  });

  it('returns false for unknown names', () => {
    expect(isActionTool('does_not_exist')).toBe(false);
  });
});
