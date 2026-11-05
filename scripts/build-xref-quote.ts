#!/usr/bin/env bun
/**
 * 把 quote-hits.tsv 正規化成 xref-quote.tsv（work_id / source_node / track_id）。
 *
 *   bun run scripts/build-xref-quote.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const lines = readFileSync('data/quote-hits.tsv', 'utf8').trim().split('\n');
const head = lines[0].split('\t');
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const out = ['work_id\tsource_node\ttrack_id\tdisplay_sid\tmatched\tkind\tconfidence'];
let n = 0;
for (const l of lines.slice(1)) {
  const r = l.split('\t');
  const work = r[ix.book] || '';
  const page = r[ix.page] || '';
  const va = r[ix.va] || '';
  const track = r[ix.track_id] || '';
  const display = r[ix.display_sid] || '';
  const matched = (r[ix.matched] || '').replace(/[\t\r\n]+/g, ' ');
  const conf = r[ix.cls] === 'ref' ? 'A' : 'C';
  out.push([work, `${page}:${va}`, track, display, matched, 'quote', conf].join('\t'));
  n++;
}
writeFileSync('data/xref-quote.tsv', out.join('\n') + '\n');
console.log(`xref-quote ${n} rows`);
