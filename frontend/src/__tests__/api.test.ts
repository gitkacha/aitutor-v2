import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../lib/api';

// W-5: fetchJSON must only send Content-Type on requests that carry a body —
// a GET with Content-Type: application/json is misleading (there is no content).

describe('fetchJSON headers', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET requests carry no Content-Type header', async () => {
    await api.getTypes();
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('POST requests with a body still send Content-Type: application/json', async () => {
    await api.saveWorksheet('t', [1], ['p']);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
