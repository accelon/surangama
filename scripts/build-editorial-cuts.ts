#!/usr/bin/env bun
/**
 * 咒語 editorial cuts：兩個長咒語段每 25 個 phrase 切一刀，避免 hierarchy 出現 400+ 句的段。
 * 這些不是注疏切點，標 kind=editorial。
 *
 *   bun run scripts/build-editorial-cuts.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const map = readFileSync(join(ROOT, 'build', 'sentence-split-map.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const ranges = [];
for (const m of map) {
  const old = +m[0].slice(1);
  if (old === 2434 || old === 2587) ranges.push({ old, a: +m[1].slice(1), b: +m[2].slice(1) });
}

const rows = ['cut_id\tafter_sid\tkind\treason\tsource'];
let n = 0;
for (const r of ranges) {
  for (let s = r.a + 25; s <= r.b; s += 25) {
    n++;
    rows.push([`E${String(n).padStart(4, '0')}`, 'S' + String(s).padStart(4, '0'), 'editorial', `mantra-block-25 (old S${r.old})`, 'mantra'].join('\t'));
  }
}
writeFileSync(join(DATA, 'cuts-editorial.tsv'), rows.join('\n') + '\n');
console.log(`editorial cuts ${n}; ranges`, ranges);
console.log(rows.slice(0, 4).join('\n'));
