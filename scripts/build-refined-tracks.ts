#!/usr/bin/env bun
/**
 * 產生 refined track 預覽：split 的子軌取代原軌；join 不動軌號。
 * 不覆寫 data/tracks-zh.tsv；只是 suggested view。
 *
 *   bun run scripts/build-refined-tracks.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const tracks = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const sup = new Map(readFileSync(join(DATA, 'track-superseded.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const r = l.split('\t'); return [r[0], r];
}));
const children = new Map<string, string[][]>();
for (const l of readFileSync(join(DATA, 'tracks-suggested.tsv'), 'utf8').trim().split('\n').slice(1)) {
  const r = l.split('\t');
  if (!children.has(r[1])) children.set(r[1], []);
  children.get(r[1])!.push(r);
}

const out = ['track_id\tparent_track\tstatus\tbase_sid\tpart\tdisplay_sid\taddr\tjuan\tpage\ttext\than\tsource\tevidence\tconfidence'];
let n = 0;
for (const r of tracks) {
  const [track_id, base_sid, part, display_sid, addr, juan, page, text, han, source] = r;
  const s = sup.get(track_id);
  if (s) {
    const review = s[5] === '1';
    for (const c of children.get(track_id) || []) {
      out.push([c[0], c[1], review ? 'review' : 'active', c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], 'quote-split', c[12] || '', c[13] || ''].join('\t'));
      n++;
    }
  } else {
    out.push([track_id, '', 'active', base_sid, part, display_sid, addr, juan, page, text, han, source, '', ''].join('\t'));
    n++;
  }
}
writeFileSync(join(DATA, 'tracks-refined.tsv'), out.join('\n') + '\n');
console.log(`refined tracks ${n} (original ${tracks.length}, superseded ${sup.size}) → data/tracks-refined.tsv`);
