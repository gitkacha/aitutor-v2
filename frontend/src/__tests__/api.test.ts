import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, chatApi, interventionsApi } from '../lib/api';

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

// M3b-2 Task 1 (W-51): the chat + interventions API client builds the right URL/method/body.
describe('chatApi + interventionsApi', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const call = () => fetchMock.mock.calls[0];

  it('createSession POSTs an empty body to /chat/sessions', async () => {
    await chatApi.createSession();
    const [url, init] = call();
    expect(url).toBe('/api/chat/sessions');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
  });

  it('sendMessage POSTs {content} to the session messages URL', async () => {
    await chatApi.sendMessage(3, 'how is Maya?');
    const [url, init] = call();
    expect(url).toBe('/api/chat/sessions/3/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ content: 'how is Maya?' });
  });

  it('confirm POSTs {actionId, approve} to the confirm URL', async () => {
    await chatApi.confirm(3, 'abc', true);
    const [url, init] = call();
    expect(url).toBe('/api/chat/sessions/3/confirm');
    expect(JSON.parse(init.body)).toEqual({ actionId: 'abc', approve: true });
  });

  it('listSessions and getSession GET the right URLs', async () => {
    await chatApi.listSessions();
    expect(call()[0]).toBe('/api/chat/sessions');
    fetchMock.mockClear();
    await chatApi.getSession(7);
    expect(call()[0]).toBe('/api/chat/sessions/7');
  });

  it('interventionsApi builds list / listActive / outcome URLs', async () => {
    await interventionsApi.list(2);
    expect(call()[0]).toBe('/api/interventions?studentId=2');
    fetchMock.mockClear();
    await interventionsApi.listActive();
    expect(call()[0]).toBe('/api/interventions/active');
    fetchMock.mockClear();
    await interventionsApi.outcome(9);
    expect(call()[0]).toBe('/api/interventions/9/outcome');
  });
});
