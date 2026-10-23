// npm run golden — regenerates zoo/golden.html from the corpus. Commit the result.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GOLDEN_PATH, goldenHtml } from '../render/golden.ts';

mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
writeFileSync(GOLDEN_PATH, goldenHtml());
console.log(`wrote ${GOLDEN_PATH}`);
