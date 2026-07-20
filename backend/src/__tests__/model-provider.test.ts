import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { providerFor, chatCompletion } from '../services/ai.service';

// W-21: per-role model providers. providerFor resolves {model, baseUrl, apiKey} from
// role-specific env with a shared-OpenAI fallback; chatCompletion routes to that provider.

const ENV_KEYS = [
  'OPENAI_API_KEY', 'OPENAI_BASE_URL',
  'GENERATION_MODEL', 'GENERATION_BASE_URL', 'GENERATION_API_KEY',
  'VERIFICATION_MODEL', 'VERIFICATION_BASE_URL', 'VERIFICATION_API_KEY',
  'ANALYSIS_MODEL', 'ANALYSIS_BASE_URL', 'ANALYSIS_API_KEY',
];

describe('providerFor (W-21)', () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    process.env.OPENAI_API_KEY = 'shared-key';
  });
  afterEach(() => {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  it('uses the per-role default models', () => {
    expect(providerFor('generation').model).toBe('gpt-5-mini');
    expect(providerFor('verification').model).toBe('o4-mini');
    expect(providerFor('analysis').model).toBe('gpt-4o-mini');
  });

  it('defaults baseUrl to the OpenAI endpoint, then OPENAI_BASE_URL, then the role override', () => {
    expect(providerFor('verification').baseUrl).toBe('https://api.openai.com/v1');
    process.env.OPENAI_BASE_URL = 'http://shared.local/v1';
    expect(providerFor('verification').baseUrl).toBe('http://shared.local/v1');
    process.env.VERIFICATION_BASE_URL = 'http://deepseek.local/v1';
    expect(providerFor('verification').baseUrl).toBe('http://deepseek.local/v1');
    // Other roles are unaffected by the verification override.
    expect(providerFor('generation').baseUrl).toBe('http://shared.local/v1');
  });

  it('lets a single role move to another provider (model + key + url)', () => {
    process.env.VERIFICATION_MODEL = 'deepseek-reasoner';
    process.env.VERIFICATION_API_KEY = 'ds-key';
    process.env.VERIFICATION_BASE_URL = 'http://deepseek.local/v1';
    const v = providerFor('verification');
    expect(v).toEqual({ model: 'deepseek-reasoner', apiKey: 'ds-key', baseUrl: 'http://deepseek.local/v1' });
    // Generation still on the shared OpenAI key.
    expect(providerFor('generation').apiKey).toBe('shared-key');
  });
});

describe('chatCompletion routing (W-21)', () => {
  it('posts to the provider baseUrl with its apiKey and model', async () => {
    const captured: { url?: string; auth?: string; model?: string } = {};
    const server = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          captured.url = req.url;
          captured.auth = req.headers.authorization;
          captured.model = JSON.parse(body).model;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
        });
      });
      s.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address() as import('net').AddressInfo;
    try {
      const out = await chatCompletion(
        { model: 'deepseek-reasoner', baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'ds-key' },
        'hi', 100
      );
      expect(out).toBe('ok');
      expect(captured.url).toBe('/v1/chat/completions');
      expect(captured.auth).toBe('Bearer ds-key');
      expect(captured.model).toBe('deepseek-reasoner');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
