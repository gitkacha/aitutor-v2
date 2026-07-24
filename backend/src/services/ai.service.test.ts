import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chatWithTools, ChatTurn, ChatToolSchema, ModelProvider } from './ai.service';

// M3b Task 4: chatWithTools OpenAI function-calling primitive. Mocks global.fetch and
// asserts both the parsed response and the exact request wire shape (tools + messages).

const provider: ModelProvider = {
  model: 'gpt-5-mini',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  tokensParam: 'max_completion_tokens',
};

const tools: ChatToolSchema[] = [
  {
    name: 'get_x',
    description: 'Get X for a value',
    parameters: { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] },
  },
];

function mockFetchOnce(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('chatWithTools (M3b Task 4)', () => {
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
    vi.restoreAllMocks();
  });

  it('maps a tool_calls response (null content) to ToolCall[] with content ""', async () => {
    mockFetchOnce({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'c1', type: 'function', function: { name: 'get_x', arguments: '{"a":1}' } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const messages: ChatTurn[] = [{ role: 'user', content: 'call get_x with 1' }];
    const result = await chatWithTools(provider, messages, tools, 500);

    expect(result.content).toBe('');
    expect(result.toolCalls).toEqual([{ id: 'c1', name: 'get_x', arguments: '{"a":1}' }]);
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it('maps a plain content response to content string with no tool calls', async () => {
    mockFetchOnce({
      choices: [{ message: { content: 'hello', tool_calls: undefined } }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    });

    const messages: ChatTurn[] = [{ role: 'user', content: 'say hello' }];
    const result = await chatWithTools(provider, messages, tools, 500);

    expect(result.content).toBe('hello');
    expect(result.toolCalls).toEqual([]);
  });

  it('sends mapped tools and correctly-shaped messages in the request body', async () => {
    const fetchMock = mockFetchOnce({
      choices: [{ message: { content: 'done' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const messages: ChatTurn[] = [
      { role: 'system', content: 'you are a bot' },
      { role: 'user', content: 'do the thing' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', name: 'get_x', arguments: '{"a":1}' }],
      },
      { role: 'tool', content: '{"result":42}', toolCallId: 'c1' },
    ];

    await chatWithTools(provider, messages, tools, 500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const sent = JSON.parse((init as { body: string }).body);

    // tools mapped to OpenAI function shape
    expect(sent.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_x',
          description: 'Get X for a value',
          parameters: { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] },
        },
      },
    ]);
    expect(sent.tool_choice).toBe('auto');

    // token param honoured, no temperature for reasoning model
    expect(sent.max_completion_tokens).toBe(500);
    expect(sent.temperature).toBeUndefined();

    // messages wire shape
    expect(sent.messages[0]).toEqual({ role: 'system', content: 'you are a bot' });
    expect(sent.messages[1]).toEqual({ role: 'user', content: 'do the thing' });
    expect(sent.messages[2]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'get_x', arguments: '{"a":1}' } },
      ],
    });
    expect(sent.messages[3]).toEqual({
      role: 'tool',
      tool_call_id: 'c1',
      content: '{"result":42}',
    });
  });

  it('omits tools and tool_choice when no tools are given', async () => {
    const fetchMock = mockFetchOnce({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    await chatWithTools(provider, [{ role: 'user', content: 'hi' }], [], 100);

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(sent.tools).toBeUndefined();
    expect(sent.tool_choice).toBeUndefined();
  });
});
