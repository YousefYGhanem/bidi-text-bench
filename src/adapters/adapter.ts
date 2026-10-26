// Adapters (docs/CHECKER_SPEC.md §5): how the audit drives one target UI.
import type { Locator, Page } from '@playwright/test';
import type { Fixture } from '../corpus/validate.ts';

export interface Adapter {
  /** = the audit/targets.yaml id */
  id: string;
  mode: 'auto-chat' | 'auto-page';
  /** The page open() loads. The audit waits until it answers before starting. */
  url: () => string;
  /** Navigate and wait until ready. Never log in to real accounts. */
  open(page: Page): Promise<void>;
  /** auto-chat: send "#fx:<id>" and return the finished reply's container. */
  send?(page: Page, fx: Fixture): Promise<Locator>;
  /** The compose box, for the input surface. */
  input?(page: Page): Promise<Locator>;
  /** auto-page: locate an already-rendered fixture. */
  find?(page: Page, fx: Fixture): Promise<Locator>;
  /** Selectors the probe ignores (copy buttons, gutters). */
  exclude?: string[];
}

/** Resolves once the locator's text has not changed for `quietMs`: the stream has finished. */
export async function settled(reply: Locator, quietMs = 800, timeoutMs = 30_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  let last = await reply.textContent();
  let since = Date.now();
  while (Date.now() - since < quietMs) {
    if (Date.now() > end) throw new Error('reply did not settle');
    await reply.page().waitForTimeout(100);
    const now = await reply.textContent();
    if (now !== last) [last, since] = [now, Date.now()];
  }
}
