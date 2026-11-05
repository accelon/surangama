#!/usr/bin/env bun
/**
 * 漢字梵音轉換表 pilot：用 data/mantra-syllables.tsv 對 T945 咒語做貪婪匹配。
 * 只做示範；未收錄的字以 ? 標記，不硬猜。
 *
 *   bun run scripts/mantra-translit.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const rows = readFileSync(join(ROOT, 'data', 'mantra-syllables.tsv'), 'utf8')
  .trim().split('\n').slice(1)
  .map((l) => l.split('\t'))
  .map(([zh, sa, conf, example, note]) => ({ zh, sa, conf, example, note }))
  .sort((a, b) => b.zh.length - a.zh.length || a.zh.localeCompare(b.zh));

function convert(zh: string): { out: string; unknown: string[] } {
  let i = 0;
  const parts: string[] = [];
  const unknown: string[] = [];
  while (i < zh.length) {
    const hit = rows.find((r) => zh.startsWith(r.zh, i));
    if (hit) {
      parts.push(hit.sa);
      i += hit.zh.length;
    } else {
      parts.push('?');
      unknown.push(zh[i]);
      i += 1;
    }
  }
  return { out: parts.join(' '), unknown };
}

const pilot = readFileSync(join(ROOT, 'data', 'mantra-pilot.tsv'), 'utf8')
  .trim().split('\n').slice(1)
  .map((l) => l.split('\t'));

console.log('T945 phrase\tgreedy output\tunknown');
for (const [sid, zh, sa] of pilot) {
  const { out, unknown } = convert(zh);
  console.log(`${sid}\t${zh}\t${out}\t${unknown.join('') || '-'}`);
}
console.log('\n表單元數', rows.length);
