#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
const lines = (p: string) => readFileSync(p, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const words = lines('data/mantra-words.tsv');
const lemmas = lines('data/mantra-lemmas.tsv');
const align = lines('data/mantra-word-align.tsv');
const hints = lines('data/mantra-hints.tsv');
const pairs = lines('data/align.tsv');
const sa = new Set(lines('data/tracks-sa.tsv').map((r) => r[0]));
const zh = new Set(lines('data/tracks-zh.tsv').map((r) => r[0]));
const fails: string[] = [];
const ok = (x: boolean, m: string) => { if (!x) fails.push(m); };
ok(words.length === 454, `words ${words.length}`);
ok(lemmas.length === 446, `lemmas ${lemmas.length}`);
ok(align.length === 42, `align ${align.length}`);
for (const r of align) {
  ok(sa.has(r[0]), `missing sa ${r[0]}`);
  if (r[4]) ok(zh.has(r[4]), `missing zh ${r[4]}`);
  if (r[8] === 'gap') ok(!r[4] || !r[1], `gap both sides ${r[0]}/${r[4]}`);
}
console.log(fails.length ? 'FAIL\n' + fails.slice(0, 20).join('\n') : 'PASS');
console.log({ words: words.length, lemmas: lemmas.length, align: align.length, hints: hints.length, pairs: pairs.length, fails: fails.length });


