import http from 'http';

// A scripted OpenAI-compatible stub for the coach chat (M3b). The e2e backend points every AI
// role at http://127.0.0.1:3106/v1, so this server answers POST /v1/chat/completions. It ignores
// the request entirely and returns the next body from a fixed script keyed by a call counter —
// so a test can drive the tool loop deterministically (tool-call turn, then narration turn).
export const STUB_PORT = 3106;

// The two OpenAI response shapes the chat loop understands:
//  - a tool-call turn (content:null + tool_calls), which the loop auto-executes / gates, and
//  - a final turn (plain content string), which the loop persists as the assistant's answer.
export function toolCall(name: string, args: unknown, id = 'call_1') {
  return {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
        },
      },
    ],
    usage: {},
  };
}

export function narration(content: string) {
  return { choices: [{ message: { content } }], usage: {} };
}

// Start a stub that returns script[0], script[1], … on successive completion calls. Past the end
// it returns a benign final turn so a runaway loop still terminates rather than hanging.
export function startChatStub(script: unknown[]): Promise<http.Server> {
  let calls = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const reply = calls < script.length ? script[calls] : narration('(done)');
      calls++;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}
