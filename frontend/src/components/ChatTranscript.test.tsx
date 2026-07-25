import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatTranscript } from './ChatTranscript';
import type { ChatMessage } from '@/lib/api';

// M3b-2 Task 3 (W-53): the transcript renderer turns persisted ChatMessages into the right UI —
// hiding plumbing tool-call turns, rendering analytics tool results as data cards, and treating
// (system) action-outcome turns as status lines rather than user bubbles.

function msg(over: Partial<ChatMessage>): ChatMessage {
  return { id: 1, sessionId: 1, role: 'user', content: '', createdAt: '2026-07-25T00:00:00.000Z', ...over };
}

const fixture: ChatMessage[] = [
  msg({ id: 1, role: 'user', content: 'how is Maya?' }),
  msg({ id: 2, role: 'assistant', content: JSON.stringify({ __assistantToolCalls: [{ id: 'c1', name: 'get_student_skill_report', arguments: '{}' }] }) }),
  msg({ id: 3, role: 'tool', content: JSON.stringify({ toolName: 'get_student_skill_report', args: {}, result: { skills: [{ slug: 'decimal-division', name: 'Decimal Division', accuracy: 0.4, attempted: 10, sufficientEvidence: true }] }, toolCallId: 'c1' }) }),
  msg({ id: 4, role: 'assistant', content: 'She is strongest at ordering decimals.' }),
  msg({ id: 5, role: 'user', content: '(system) The admin approved the "create_intervention" action. It completed. Result: {"id":1,"studentId":2,"diagnosisSnapshot":"{\\"capturedAt\\":\\"x\\"}"}' }),
];

describe('ChatTranscript', () => {
  it('hides the __assistantToolCalls plumbing turn', () => {
    const { container } = render(<ChatTranscript messages={fixture} />);
    expect(container.innerHTML).not.toContain('__assistantToolCalls');
  });

  it('renders a get_student_skill_report tool result as a data card with skill + accuracy', () => {
    render(<ChatTranscript messages={fixture} />);
    expect(screen.getByText('Decimal Division')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
  });

  it('renders a plain assistant message as text', () => {
    render(<ChatTranscript messages={fixture} />);
    expect(screen.getByText('She is strongest at ordering decimals.')).toBeTruthy();
  });

  it('renders a (system) user turn as a status line, not a user bubble', () => {
    render(<ChatTranscript messages={fixture} />);
    const el = screen.getByText(/The admin approved/);
    expect(el.getAttribute('data-role')).toBe('status');
  });

  it('strips the raw "Result: {…}" JSON tail from a (system) status line', () => {
    const { container } = render(<ChatTranscript messages={fixture} />);
    expect(container.innerHTML).not.toContain('diagnosisSnapshot');
    expect(container.innerHTML).not.toContain('"studentId"');
    expect(screen.getByText(/The admin approved.*It completed\./)).toBeTruthy();
  });
});
