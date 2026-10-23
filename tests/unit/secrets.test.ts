import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guards CLAUDE.md rule 4: keys live in .env, which git must never track.
describe('secrets hygiene', () => {
  const ignored = (path: string) => {
    try {
      execFileSync('git', ['check-ignore', '-q', path]);
      return true;
    } catch {
      return false;
    }
  };

  it('git ignores .env files but tracks .env.example', () => {
    expect(ignored('.env')).toBe(true);
    expect(ignored('.env.local')).toBe(true);
    expect(ignored('.env.example')).toBe(false);
  });

  it('.env.example holds variable names only', () => {
    const lines = readFileSync('.env.example', 'utf8').split(/\r?\n/);
    const filled = lines.filter((l) => /^\w*(KEY|TOKEN|SECRET|PASSWORD)\w*=./.test(l));
    expect(filled).toEqual([]);
  });
});
