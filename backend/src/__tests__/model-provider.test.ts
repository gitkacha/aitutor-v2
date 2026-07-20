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
    expect(v).toMatchObject({ model: 'deepseek-reasoner', apiKey: 'ds-key', baseUrl: 'http://deepseek.local/v1' });
    // Generation still on the shared OpenAI key.
    expect(providerFor('generation').apiKey).toBe('shared-key');
  });

  it('chooses the token param per provider: OpenAI → max_completion_tokens, others → max_tokens', () => {
    expect(providerFor('verification').tokensParam).toBe('max_completion_tokens'); // default OpenAI
    process.env.VERIFICATION_BASE_URL = 'https://api.deepseek.com/v1';
    expect(providerFor('verification').tokensParam).toBe('max_tokens');
    process.env.VERIFICATION_TOKENS_PARAM = 'max_completion_tokens'; // explicit override wins
    expect(providerFor('verification').tokensParam).toBe('max_completion_tokens');
  });
});

describe('chatCompletion routing + usage + sanitising (W-21/W-22/W-23/W-24)', () => {
  it('routes to the provider, returns usage, and strips control chars from content', async () => {
    const captured: { url?: string; auth?: string; body?: any } = {};
    const server = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          captured.url = req.url;
          captured.auth = req.headers.authorization;
          captured.body = JSON.parse(body);
          res.writeHead(200, { 'content-type': 'application/json' });
          // Content carries a vertical-tab control char (W-24); response reports usage (W-23).
          res.end(JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 },
          }));
        });
      });
      s.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address() as import('net').AddressInfo;
    try {
      const out = await chatCompletion(
        { model: 'deepseek-reasoner', baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'ds-key', tokensParam: 'max_tokens' },
        'hi', 100
      );
      // W-24: the control character is stripped.
      expect(out.content).toBe('ok');
      // W-23: usage is surfaced.
      expect(out.usage).toEqual({ promptTokens: 11, completionTokens: 22, totalTokens: 33 });
      // W-21/W-22 routing still holds.
      expect(captured.url).toBe('/v1/chat/completions');
      expect(captured.auth).toBe('Bearer ds-key');
      expect(captured.body.model).toBe('deepseek-reasoner');
      expect(captured.body.max_tokens).toBe(100);
      expect(captured.body.max_completion_tokens).toBeUndefined();
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('returns null usage when the provider omits it', async () => {
    const server = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'hi' } }] }));
      });
      s.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address() as import('net').AddressInfo;
    try {
      const out = await chatCompletion(
        { model: 'm', baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'k', tokensParam: 'max_tokens' },
        'hi', 100
      );
      expect(out.content).toBe('hi');
      expect(out.usage).toBeNull();
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
