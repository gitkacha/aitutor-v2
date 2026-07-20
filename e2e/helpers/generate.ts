import { APIRequestContext, expect } from '@playwright/test';

// W-19: math worksheet generation is now an async job. This drives the POST → poll flow
// and returns the same { topics, questions } shape the endpoint used to return synchronously.
export async function generateMath(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ topics: any[]; questions: any[] }> {
  const start = await request.post('/api/math/worksheets/generate', { data });
  expect(start.status(), 'generation starts a job (202)').toBe(202);
  const { jobId } = await start.json();

  const deadline = Date.now() + 60_000;
  for (;;) {
    const res = await request.get(`/api/math/worksheets/jobs/${jobId}`);
    const body = await res.json();
    if (body.status === 'done') return body.result;
    if (body.status === 'error') throw new Error(body.error || 'generation error');
    if (Date.now() > deadline) throw new Error('generation timed out');
    await new Promise((r) => setTimeout(r, 250));
  }
}
