#!/usr/bin/env bun
/**
 * 檢查某個 rev 的檔案 hash 是否仍與 manifest 相符。
 *
 *   bun run scripts/check-rev.ts build/rev/2026-11-05-e
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const dir = process.argv[2] || 'build/rev/2026-11-05-e';
const rev = JSON.parse(readFileSync(join(ROOT, dir, 'rev.json'), 'utf8'));
let bad = 0;
for (const [name, expected] of Object.entries(rev.files as Record<string, string>)) {
  const candidates = [join(ROOT, dir, name), join(ROOT, 'data', name), join(ROOT, 'build', name)];
  const path = candidates.find((p) => existsSync(p));
  if (!path) { console.log('MISSING', name); bad++; continue; }
  const h = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (h !== expected) { console.log('MISMATCH', name, relative(ROOT, path)); bad++; }
}
console.log(bad ? `FAIL ${bad}` : `PASS ${Object.keys(rev.files).length} files`);
