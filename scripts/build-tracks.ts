#!/usr/bin/env bun
/**
 * 由 sentences.tsv + sentence-split-map.tsv 產生穩定的漢文軌號。
 * track_id = <舊 sutra.json 句號>.<part>（例 S0000.1），display_sid 才是目前的 dense 號。
 *
 *   bun run scripts/build-tracks.ts
 *
 * 寫 data/tracks-zh.tsv、data/witnesses.tsv、data/align.tsv（若不存在才建空表）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const rows = readFileSync(join(DATA, 'sentences.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const map = readFileSync(join(ROOT, 'build', 'sentence-split-map.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const head = readFileSync(join(DATA, 'sentences.tsv'), 'utf8').trim().split('\n')[0].split('\t');
const ix = Object.fromEntries(head.map((h, i) => [h, i]));

const out = ['track_id\tbase_sid\tpart\tdisplay_sid\taddr\tjuan\tpage\ttext\than\tsource'];
for (const m of map) {
  const old = m[0];
  const first = +m[1].slice(1);
  const last = +m[2].slice(1);
  for (let i = first; i <= last; i++) {
    const r = rows[i];
    const part = i - first + 1;
    out.push([
      `${old}.${part}`, old, String(part), r[ix.sid], r[ix.addr], r[ix.juan], r[ix.page],
      r[ix.text].replace(/[\t\r\n]+/g, ' '), r[ix.han], 'T945',
    ].join('\t'));
  }
}
writeFileSync(join(DATA, 'tracks-zh.tsv'), out.join('\n') + '\n');

const witnesses = [
  ['witness_id', 'lang', 'source', 'recension', 'derivation', 'note'],
  ['T945', 'zh', 'T945', '般剌蜜帝本', 'base', '楞嚴經漢譯；目前唯一 base'],
  ['H259', 'bo', 'rkts.org H259', '譯自漢文', 'translation', '藏譯，譯跋明說 rGya las bsgyur'],
  ['LUK', 'en', 'Luk 英譯', '譯自漢文', 'translation', '咒段省略'],
  ['KU-PDF', 'sa', 'Luminous PDF', '不空本（房山石經）', 'parallel', '咒的別本，不是 T945 的 base'],
];
writeFileSync(join(DATA, 'witnesses.tsv'), witnesses.map((r) => r.join('\t')).join('\n') + '\n');

if (!existsSync(join(DATA, 'align.tsv'))) writeFileSync(join(DATA, 'align.tsv'), 'track_a\ttrack_b\trelation\tconfidence\tnote\n');
console.log(`tracks-zh.tsv ${out.length - 1} 軌；witnesses ${witnesses.length - 1}；align 空表`);
console.log(out.slice(0, 5).join('\n'));


