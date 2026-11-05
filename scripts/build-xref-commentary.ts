#!/usr/bin/env bun
/**
 * 注疏→軌號 crosswalk：把 data/align/*.json 的每句對齊片段，映射到 track range。
 * 這是 commentary 層的 xref；page/char 座標留作回溯。
 *
 *   bun run scripts/build-xref-commentary.ts
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const tracks = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const th = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n')[0].split('\t');
const tix = Object.fromEntries(th.map((h, i) => [h, i]));
const byDisplay = new Map(tracks.map((r) => [r[tix.display_sid], r[tix.track_id]]));

const map = readFileSync(join(ROOT, 'build', 'sentence-split-map.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const newStart = new Int32Array(4000);
const newEnd = new Int32Array(4000);
for (const m of map) { newStart[+m[0].slice(1)] = +m[1].slice(1); newEnd[+m[0].slice(1)] = +m[2].slice(1); }

const head = ['work_id', 'source_node', 'track_start', 'track_end', 'display_start', 'display_end', 'char_start', 'char_end', 'page_first', 'page_last', 'frag_count', 'kind'];
const out = [head.join('\t')];
const files = readdirSync(join(DATA, 'align')).filter((f) => f.endsWith('.json'));
const perWork: Record<string, number> = {};
let missing = 0;
for (const f of files) {
  const j = JSON.parse(readFileSync(join(DATA, 'align', f), 'utf8'));
  const work = j.id || f.replace(/\.json$/, '');
  perWork[work] = 0;
  for (const x of j.sentences || []) {
    const frags = Array.isArray(x.frags) ? x.frags : [];
    if (!frags.length) continue;
    const ds = newStart[x.s], de = newEnd[x.s];
    if (ds == null || de == null) continue;
    const ts = byDisplay.get('S' + String(ds).padStart(4, '0'));
    const te = byDisplay.get('S' + String(de).padStart(4, '0'));
    if (!ts || !te) { missing++; continue; }
    const starts = frags.map((z: any) => +z.start).filter((n: number) => Number.isFinite(n));
    const ends = frags.map((z: any) => +z.end).filter((n: number) => Number.isFinite(n));
    out.push([work, String(x.s), ts, te, 'S' + String(ds).padStart(4, '0'), 'S' + String(de).padStart(4, '0'),
      starts.length ? String(Math.min(...starts)) : '', ends.length ? String(Math.max(...ends)) : '',
      frags[0]?.page || '', frags[frags.length - 1]?.page || '', String(frags.length), 'commentary'].join('\t'));
    perWork[work]++;
  }
}
writeFileSync(join(DATA, 'xref-commentary.tsv'), out.join('\n') + '\n');
console.log('rows', out.length - 1, 'works', files.length, 'missing', missing);
console.log(perWork);
console.log(out.slice(0, 4).join('\n'));
