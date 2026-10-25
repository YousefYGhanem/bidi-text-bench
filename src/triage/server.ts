// npm run triage: the local triage view over one or more run folders.
import { resolve } from 'node:path';
import type { Fixture } from '../corpus/validate.ts';
import { type LocalServer, startLocalServer } from '../local/server.ts';
import { renderFixture } from '../render/reference.ts';
import { triagePage } from './page.ts';
import { CAUSES, LABELS, recordDecision, SEVERITIES, triageItems } from './triage.ts';

export function startTriageServer(o: {
  runs: string[];
  fixtures: Fixture[];
  port: number;
  now?: () => string;
}): Promise<LocalServer> {
  const now = o.now ?? (() => new Date().toISOString());
  const byId = new Map(o.fixtures.map((f) => [f.id, f]));
  return startLocalServer({
    port: o.port,
    page: (token) => triagePage(token),
    // Only evidence screenshots inside the listed runs.
    file: (path) => {
      const run = o.runs.find((r) => path.startsWith(`${r}/evidence/`));
      return run && path.endsWith('.png') && !path.includes('..') ? resolve(path) : null;
    },
    api: {
      items: () => ({
        labels: LABELS,
        causes: CAUSES,
        severities: SEVERITIES,
        items: o.runs.flatMap(triageItems).map((item) => {
          const fx = byId.get(item.fixture);
          return {
            ...item,
            text: fx?.text,
            notes: fx?.expected_notes,
            html: fx ? renderFixture(fx) : '',
          };
        }),
      }),
      decide: (body) => {
        const run = o.runs.find((r) => r === body.run);
        if (!run) throw new Error('unknown run');
        return recordDecision(run, body, now());
      },
    },
  });
}
