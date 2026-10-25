// Mock LLM (docs/CHECKER_SPEC.md §6): an OpenAI-compatible server that answers "#fx:<id>" with
// that fixture's text verbatim, so a chat UI renders known input. Node's http module only.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { allFixtures, loadFixtureFiles } from '../../src/corpus/load.ts';

export const MODEL = 'bidi-text-bench-mock';

export interface MockOptions {
  /** Fixture id → reply text. */
  replies: Map<string, string>;
  /** Graphemes per streamed chunk. */
  chunk: number;
  delayMs: number;
}

type Part = { type?: string; text?: string };
type Message = { role?: string; content?: string | Part[] | null };

/** The reply for the last user message: the fixture's text, or a short note the audit will flag. */
export function replyFor(messages: Message[], replies: Map<string, string>): string {
  const last = messages.findLast((m) => m.role === 'user');
  const content = last?.content;
  // Some UIs send content as an array of parts (the multimodal format).
  const text = Array.isArray(content)
    ? content.map((p) => (p.type === 'text' ? (p.text ?? '') : '')).join('\n')
    : (content ?? '');
  const id = /#fx:([a-z]{2}-[a-z]+-\d{3})/.exec(text)?.[1];
  if (!id) return 'bidi-text-bench mock: no #fx:<id> in the last user message.';
  return replies.get(id) ?? `bidi-text-bench mock: unknown fixture ${id}.`;
}

export const graphemeChunks = (text: string, size: number): string[] => {
  const g = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)];
  const out: string[] = [];
  for (let i = 0; i < g.length; i += size)
    out.push(
      g
        .slice(i, i + size)
        .map((s) => s.segment)
        .join(''),
    );
  return out;
};

async function readJson(req: IncomingMessage): Promise<unknown> {
  let body = '';
  for await (const part of req) body += part;
  return JSON.parse(body);
}

export function createMockLlm(opts: MockOptions): Server {
  return createServer(async (req, res) => {
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    // Accept both /v1/... and bare paths: chat UIs differ in whether the base URL ends in /v1.
    const path = (req.url ?? '/').split('?')[0]?.replace(/^\/v1(?=\/)/, '');
    const created = Math.floor(Date.now() / 1000);

    if (req.method === 'GET' && path === '/models') {
      json(200, {
        object: 'list',
        data: [{ id: MODEL, object: 'model', created, owned_by: 'bidi-text-bench' }],
      });
      return;
    }
    if (req.method !== 'POST' || path !== '/chat/completions') {
      json(404, { error: { message: `no route ${req.method} ${req.url}`, type: 'not_found' } });
      return;
    }

    let body: { messages?: Message[]; model?: string; stream?: boolean };
    try {
      body = (await readJson(req)) as typeof body;
    } catch {
      json(400, { error: { message: 'invalid JSON body', type: 'invalid_request_error' } });
      return;
    }
    if (!Array.isArray(body.messages)) {
      json(400, { error: { message: 'messages must be an array', type: 'invalid_request_error' } });
      return;
    }
    const content = replyFor(body.messages, opts.replies);
    const id = `chatcmpl-mock-${created}`;
    const model = body.model ?? MODEL;

    if (!body.stream) {
      json(200, {
        id,
        object: 'chat.completion',
        created,
        model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
      return;
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const send = (delta: object, finish: string | null) =>
      res.write(
        `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`,
      );
    send({ role: 'assistant', content: '' }, null);
    for (const piece of graphemeChunks(content, opts.chunk)) {
      if (res.destroyed) return;
      send({ content: piece }, null);
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
    send({}, 'stop');
    res.end('data: [DONE]\n\n');
  });
}

/** Every fixture in the corpus, drafts included: the audit picks which ids it sends. */
export const corpusReplies = () =>
  new Map(allFixtures(loadFixtureFiles()).map((fx) => [fx.id, fx.text]));

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const env = process.env;
  const port = Number(env.MOCK_LLM_PORT ?? 11435);
  // shortcut: loopback only; if a container cannot reach host.docker.internal, set MOCK_LLM_HOST=0.0.0.0 (checked in task 3.2).
  const host = env.MOCK_LLM_HOST ?? '127.0.0.1';
  const replies = corpusReplies();
  createMockLlm({
    replies,
    chunk: Number(env.MOCK_CHUNK ?? 3),
    delayMs: Number(env.MOCK_DELAY_MS ?? 30),
  }).listen(port, host, () =>
    console.log(`mock LLM: ${replies.size} fixtures at http://${host}:${port}/v1 (model ${MODEL})`),
  );
}
