import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { ADAPTERS } from '../../src/adapters/index.ts';

const targets = parse(readFileSync('audit/targets.yaml', 'utf8')) as { id: string; mode: string }[];

it('every adapter is a listed target with the same mode, and auto-chat ones have a compose file', () => {
  for (const [id, a] of Object.entries(ADAPTERS)) {
    expect(a.id).toBe(id);
    expect(targets.find((t) => t.id === id)?.mode, id).toBe(a.mode);
    if (a.mode === 'auto-chat') {
      expect(existsSync(`audit/targets/${id}/compose.yaml`), id).toBe(true);
      expect(a.send && a.input, id).toBeTruthy();
    }
  }
});

it('compose files pin an image tag and publish on localhost only', () => {
  for (const id of Object.keys(ADAPTERS)) {
    const compose = readFileSync(`audit/targets/${id}/compose.yaml`, 'utf8');
    for (const image of compose.match(/image: \S+/g) ?? []) expect(image).toMatch(/:v?\d[\w.-]*$/);
    const ports = compose.match(/- [\d.:]+:\d+\r?$/gm) ?? [];
    expect(ports.length, id).toBeGreaterThan(0);
    for (const port of ports) expect(port).toMatch(/^- 127\.0\.0\.1:/);
  }
});
