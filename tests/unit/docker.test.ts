import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('the Docker base image matches the @playwright/test version', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const tag = readFileSync('Dockerfile', 'utf8').match(/playwright:v([\d.]+)-noble/)?.[1];
  expect(tag).toBe(pkg.devDependencies['@playwright/test']);
});
