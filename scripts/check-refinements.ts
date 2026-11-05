#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
const t = readFileSync('data/track-refinements.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const c = readFileSync('data/tracks-suggested.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const qh = readFileSync('data/quote-hits.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const qp = readFileSync('data/quote-profile.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const rf = readFileSync('data/tracks-refined.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const xq = readFileSync('data/xref-quote.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const sup = readFileSync('data/track-superseded.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const j = readFileSync('data/join-groups.tsv', 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const tracks = new Map(readFileSync('data/tracks-zh.tsv', 'utf8').trim().split('\n').slice(1).map((l) => { const r = l.split('\t'); return [r[0], r]; }));
const fails: string[] = [];
const ok = (x: boolean, m: string) => { if (!x) fails.push(m); };
ok(t.length === 79, `refinements ${t.length}`);
ok(c.length === 37, `children ${c.length}`);
ok(j.length === 61, `join groups ${j.length}`);
ok(sup.length === 18, `superseded ${sup.length}`);
ok(qh.length === 5020, `quote hits ${qh.length}`);
ok(qp.length === 291, `quote profile ${qp.length}`);
for (const r of qh) { ok(tracks.has(r[1]), `quote missing track ${r[1]}`); ok(!!r[7], `quote empty page ${r[0]}/${r[1]}`); }
ok(new Set(j.map((r) => r[0])).size === j.length, 'join_id not unique');
for (const r of c) {
  ok(tracks.has(r[1]), `missing parent ${r[1]}`);
  ok(!tracks.has(r[0]), `child id collides ${r[0]}`);
  ok(+r[9] > 0, `empty child ${r[0]}`);
}
for (const r of j) for (const id of r[1].split(';')) ok(tracks.has(id), `join missing ${id}`);
console.log(fails.length ? 'FAIL\n' + fails.slice(0, 20).join('\n') : 'PASS');
console.log({ refinements: t.length, children: c.length, joins: j.length, superseded: sup.length, quote_hits: qh.length, quote_profile: qp.length, refined: rf.length, xref_quote: xq.length, fails: fails.length });





