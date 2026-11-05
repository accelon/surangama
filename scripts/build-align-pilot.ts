#!/usr/bin/env bun
/**
 * 把 Luminous PDF 的 143 個梵句做成 tracks-sa.tsv，並把 T945 開頭 15 句
 * 對到不空本 M1.01–M1.11，寫入 align.tsv。
 *
 *   bun run scripts/build-align-pilot.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

// 梵本 tracks
const sa = readFileSync(join(ROOT, 'build', 'mantra-tracks-sanskrit.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const saOut = ['track_id\tsection\tseq\ttext\tlang\tsource'];
for (const r of sa) saOut.push([r[0], r[1], r[2], r[3], 'sa', 'KU-PDF'].join('\t'));
writeFileSync(join(DATA, 'tracks-sa.tsv'), saOut.join('\n') + '\n');

// T945 display_sid -> track_id
const zh = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const zhHead = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n')[0].split('\t');
const zix = Object.fromEntries(zhHead.map((h, i) => [h, i]));
const byDisplay = new Map(zh.map((r) => [r[zix.display_sid], r[zix.track_id]]));

// pilot
const pilot = readFileSync(join(DATA, 'mantra-pilot.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const counts = new Map();
for (const p of pilot) counts.set(p[3], (counts.get(p[3]) || 0) + 1);

const rows = [['track_a', 'track_b', 'relation', 'confidence', 'note']];
// 額外開頭 S3304/S3305：PDF 第 1 會沒有對應
for (const sid of ['S3304', 'S3305']) {
  const a = byDisplay.get(sid);
  if (a) rows.push([a, '', 'gap', 'A', `${sid} 額外開頭；PDF 第1會無對應`]);
}
for (const [sid, t945, sanskrit, ref, conf, note] of pilot) {
  const a = byDisplay.get(sid);
  if (!a) continue;
  const rel = (counts.get(ref) || 0) > 1 ? 'n:1' : '1:1';
  rows.push([a, ref, rel, conf, note || `${sid} ↔ ${ref}`]);
}
writeFileSync(join(DATA, 'align.tsv'), rows.map((r) => r.join('\t')).join('\n') + '\n');
console.log(`tracks-sa ${sa.length}; align ${rows.length - 1}`);
console.log(rows.slice(0, 8).map((r) => r.join('\t')).join('\n'));
