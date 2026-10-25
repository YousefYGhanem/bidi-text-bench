import type { Adapter } from './adapter.ts';
import { nextchat } from './nextchat.ts';
import { openWebui } from './open-webui.ts';

/** Every adapter, by its audit/targets.yaml id. */
export const ADAPTERS: Record<string, Adapter> = Object.fromEntries(
  [openWebui, nextchat].map((a) => [a.id, a]),
);
