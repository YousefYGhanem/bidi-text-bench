import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Fixture, FixtureFile } from './validate.ts';

export const FIXTURE_ROOT = 'corpus/fixtures';

/** Every corpus/fixtures/<lang>/*.yaml, sorted by path, parsed but not validated. */
export function loadFixtureFiles(root = FIXTURE_ROOT): FixtureFile[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => /\.ya?ml$/.test(p))
    .sort()
    .map((p) => ({ path: `${root}/${p}`, fixtures: parse(readFileSync(`${root}/${p}`, 'utf8')) }));
}

/** All fixtures in file order. Call only after validateFixtures() found no errors. */
export const allFixtures = (files: FixtureFile[]): Fixture[] =>
  files.flatMap((f) => (Array.isArray(f.fixtures) ? (f.fixtures as Fixture[]) : []));
