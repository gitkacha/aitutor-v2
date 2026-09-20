import { describe, it, expect, vi, afterEach } from 'vitest';
import { chatCompletion } from './ai.service';

// W-144: no OpenAI call may hang forever. A briefed reasoning-model batch legitimately takes
// ~1-2 min, but a genuinely hung socket must fail fast (via AbortSignal.timeout) so the batch
// retry path can recover instead of the whole generation stalling indefinitely.
const provider = {
  model: 'gpt-5-mini',
  baseUrl: 'https://example.com/v1',
  apiKey: 'test-key',
  tokensParam: 'max_completion_tokens',
} as any;

afterEach(() => vi.restoreAllMocks());

describe('chatCompletion request timeout', () => {
  it('passes an AbortSignal to fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await chatCompletion(provider, 'hi', 100);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const opts = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(opts.signal, 'fetch must receive an abort signal').toBeInstanceOf(AbortSignal);
  });
});
