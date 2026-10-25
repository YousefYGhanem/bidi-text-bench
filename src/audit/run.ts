// The audit runner (docs/AUDIT_PROTOCOL.md §3, CHECKER_SPEC §7): every fixture through one target's
// adapter, probed and checked, one JSON line per rule result.
import { appendFileSync, mkdirSync } from 'node:fs';
import type { Browser } from '@playwright/test';
import type { Adapter } from '../adapters/adapter.ts';
import type { Fixture } from '../corpus/validate.ts';
import { probe } from '../probe/probe.ts';
import { type RuleResult, runRules } from '../rules/rules.ts';

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;

export interface ResultLine extends Omit<RuleResult, 'status' | 'rule'> {
  target: string;
  surface: 'message';
  browser: string;
  viewport: ViewportName;
  rule: RuleResult['rule'] | null;
  /** `error`: the adapter or probe threw, so no rule ran (evidence.detail says why). */
  status: RuleResult['status'] | 'error';
  evidence: RuleResult['evidence'] & { screenshot?: string };
}

export interface AuditOptions {
  adapter: Adapter;
  /** Connected or launched browsers, by engine name. */
  browsers: Record<string, Browser>;
  viewports: ViewportName[];
  fixtures: Fixture[];
  /** The run directory: results.jsonl, evidence/ and raw/ go here. */
  out: string;
  log?: (line: string) => void;
}

export async function runAudit(o: AuditOptions): Promise<ResultLine[]> {
  const send = o.adapter.send;
  if (!send) throw new Error(`${o.adapter.id} has no send(): only auto-chat targets are supported`);
  mkdirSync(`${o.out}/evidence`, { recursive: true });
  mkdirSync(`${o.out}/raw`, { recursive: true });
  const all: ResultLine[] = [];

  for (const [browserName, browser] of Object.entries(o.browsers)) {
    for (const viewport of o.viewports) {
      for (const fx of o.fixtures) {
        const base = {
          fixture: fx.id,
          target: o.adapter.id,
          surface: 'message' as const,
          browser: browserName,
          viewport,
          severity: fx.severity,
        };
        // A fresh context per fixture: no chat history or stored state leaks between fixtures.
        const context = await browser.newContext({
          viewport: VIEWPORTS[viewport],
          locale: 'en-US',
          timezoneId: 'UTC',
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        let lines: ResultLine[];
        try {
          await o.adapter.open(page);
          const reply = await send(page, fx);
          const results = runRules(fx, await probe(reply, { exclude: o.adapter.exclude }));
          lines = results.map((r) => ({ ...base, ...r }));
          if (results.some((r) => r.status === 'fail')) {
            const name = `${fx.id}-${browserName}-${viewport}.png`;
            await reply.screenshot({ path: `${o.out}/evidence/${name}` });
            await page.screenshot({ path: `${o.out}/raw/${name}`, fullPage: true });
            for (const l of lines)
              if (l.status === 'fail')
                l.evidence = { ...l.evidence, screenshot: `evidence/${name}` };
          }
        } catch (e) {
          const detail = e instanceof Error ? e.message.split('\n')[0] : String(e);
          lines = [{ ...base, rule: null, status: 'error', evidence: { detail: detail ?? '' } }];
        } finally {
          await context.close();
        }
        appendFileSync(
          `${o.out}/results.jsonl`,
          lines.map((l) => `${JSON.stringify(l)}\n`).join(''),
        );
        all.push(...lines);
        const fails = lines.filter((l) => l.status !== 'pass' && l.status !== 'na');
        o.log?.(
          `${browserName} ${viewport} ${fx.id} ${fails.map((l) => `${l.rule ?? 'ERROR'}:${l.status}`).join(' ') || 'ok'}`,
        );
      }
    }
  }
  return all;
}

/** Counts per rule: pass, fail, na and error. */
export function summarize(lines: ResultLine[]): string {
  const rows = new Map<string, Record<string, number>>();
  for (const l of lines) {
    const row = rows.get(l.rule ?? 'ERROR') ?? { pass: 0, fail: 0, na: 0, error: 0 };
    row[l.status] = (row[l.status] ?? 0) + 1;
    rows.set(l.rule ?? 'ERROR', row);
  }
  const out = ['rule    pass  fail    na  error'];
  for (const [rule, r] of rows)
    out.push(
      `${rule.padEnd(6)} ${[r.pass, r.fail, r.na, r.error].map((n) => String(n).padStart(5)).join(' ')}`,
    );
  return out.join('\n');
}
