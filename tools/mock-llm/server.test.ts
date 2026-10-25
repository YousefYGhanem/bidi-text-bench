// Self-tests for the mock LLM, run with `node --test` (npm run mock-llm:test).
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { corpusReplies, createMockLlm, graphemeChunks, MODEL, replyFor } from './server.ts';

// A combining mark and a lam-alef, so a chunk boundary inside a grapheme would show.
const TEXT = 'שָׁלוֹם world لا 123';
const server = createMockLlm({ replies: new Map([['he-bd-001', TEXT]]), chunk: 2, delayMs: 0 });
let base = '';

before(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
after(() => server.close());

const chat = (body: object) =>
  fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, ...body }),
  });

test('GET /v1/models lists the mock model', async () => {
  const res = await fetch(`${base}/models`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    ((await res.json()) as { data: { id: string }[] }).data.map((m) => m.id),
    [MODEL],
  );
});

test('non-streaming reply is the fixture text verbatim', async () => {
  const res = await chat({
    messages: [
      { role: 'user', content: '#fx:ar-bd-001' },
      { role: 'assistant', content: 'old' },
      { role: 'user', content: 'please show #fx:he-bd-001' },
    ],
  });
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  assert.equal(json.choices[0]?.message.content, TEXT);
});

test('streaming sends grapheme chunks that join to the text, then [DONE]', async () => {
  const res = await chat({ stream: true, messages: [{ role: 'user', content: '#fx:he-bd-001' }] });
  assert.match(res.headers.get('content-type') ?? '', /^text\/event-stream/);
  const events = (await res.text()).split('\n\n').filter(Boolean);
  assert.equal(events.at(-1), 'data: [DONE]');
  const chunks = events.slice(0, -1).map((e) => JSON.parse(e.slice('data: '.length)));
  const pieces = chunks.map((c) => c.choices[0].delta.content ?? '').filter(Boolean);
  assert.equal(pieces.join(''), TEXT);
  assert.deepEqual(pieces, graphemeChunks(TEXT, 2));
  assert.equal(pieces[0], 'שָׁל', 'a chunk holds two whole graphemes');
  assert.equal(chunks.at(-1).choices[0].finish_reason, 'stop');
});

test('content given as parts, and requests without a known fixture', () => {
  const replies = new Map([['he-bd-001', TEXT]]);
  const parts = [{ role: 'user', content: [{ type: 'text', text: '#fx:he-bd-001' }] }];
  assert.equal(replyFor(parts, replies), TEXT);
  assert.match(replyFor([{ role: 'user', content: 'hi' }], replies), /no #fx/);
  assert.match(replyFor([{ role: 'user', content: '#fx:ar-xx-999' }], replies), /unknown fixture/);
  // A title request appends its own prompt after the fixture's message.
  const title = [
    { role: 'user', content: '#fx:he-bd-001' },
    { role: 'assistant', content: TEXT },
    { role: 'user', content: 'Summarize the conversation in a short title.' },
  ];
  assert.equal(replyFor(title, replies), TEXT);
});

test('bad requests get OpenAI-style errors', async () => {
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  const res = await fetch(`${base}/chat/completions`, { method: 'POST', body: '{' });
  assert.equal(res.status, 400);
});

test('the corpus loads every fixture id', () => {
  const replies = corpusReplies();
  assert.ok(replies.size >= 80);
  for (const id of replies.keys()) assert.match(id, /^[a-z]{2}-[a-z]+-\d{3}$/);
});
