#!/usr/bin/env bun
/**
 * 由 quote-scan 的 (adb, book, page) 交集，找相鄰軌的 suggested join points。
 *
 *   bun run scripts/suggest-joins.ts
 *
 * 讀 build/quote-scan-pilot.tsv、data/tracks-zh.tsv、data/track-refinements.tsv
 * 寫 data/track-joins.tsv，並把 join 列 append 到 data/track-refinements.tsv
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const BUILD = join(ROOT, 'build');

const tracks = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [track_id, base_sid, part, display_sid, addr, juan, page, text, han] = l.split('\t');
  return { track_id, base_sid, part: +part, display_sid, addr, juan: +juan, page, text, han: +han };
});
const byDisplay = new Map(tracks.map((t) => [t.display_sid, t]));

const hits = readFileSync(join(BUILD, 'quote-scan-pilot.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const head = readFileSync(join(BUILD, 'quote-scan-pilot.tsv'), 'utf8').trim().split('\n')[0].split('\t');
const ix = Object.fromEntries(head.map((h, i) => [h, i]));

const isRef = (book: string) => /楞嚴|首楞嚴|宗鏡錄/.test(book);
const perTrack = new Map<string, { keys: Set<string>; books: Set<string>; pages: Set<string>; n: number }>();
for (const r of hits) {
  if (!isRef(r[ix.book])) continue;
  const id = r[ix.track_id];
  const key = `${r[ix.adb]}|${r[ix.book]}|${r[ix.page]}`;
  if (!perTrack.has(id)) perTrack.set(id, { keys: new Set(), books: new Set(), pages: new Set(), n: 0 });
  const x = perTrack.get(id)!;
  x.keys.add(key); x.books.add(r[ix.book]); x.pages.add(r[ix.page]); x.n++;
}

const scanSids = hits.map((r) => +r[ix.display_sid].slice(1)).filter((n) => Number.isFinite(n));
const lo = Math.min(...scanSids), hi = Math.max(...scanSids);
const sids = tracks.map((t) => +t.display_sid.slice(1)).sort((a, b) => a - b);
const inRange = sids.filter((n) => n >= lo && n <= hi);
const joinRows = ['join_id\ttrack_left\ttrack_right\tleft_display\tright_display\tshared_keys\tbooks\tpages\tevidence\tconfidence\tboundary_text'];
const joins: string[] = [];
let jn = 0;
for (let i = 0; i < inRange.length - 1; i++) {
  const a = byDisplay.get('S' + String(inRange[i]).padStart(4, '0'));
  const b = byDisplay.get('S' + String(inRange[i + 1]).padStart(4, '0'));
  if (!a || !b) continue;
  const A = perTrack.get(a.track_id), B = perTrack.get(b.track_id);
  if (!A || !B) continue;
  const shared = [...A.keys].filter((k) => B.keys.has(k));
  if (!shared.length) continue;
  const books = [...new Set(shared.map((k) => k.split('|')[1]))].filter(Boolean);
  const pages = [...new Set(shared.map((k) => k.split('|')[2]))].filter(Boolean);
  const conf = shared.length >= 2 ? 'A' : 'B';
  const boundary = a.text.replace(/[\t\r\n]/g, '').slice(-8) + '｜' + b.text.replace(/[\t\r\n]/g, '').slice(0, 8);
  jn++;
  const id = 'J' + String(jn).padStart(4, '0');
  joins.push([id, a.track_id, b.track_id, a.display_sid, b.display_sid, String(shared.length), books.slice(0, 6).join(';'), pages.slice(0, 6).join(';'), shared.slice(0, 4).join(' ; '), conf, boundary].join('\t'));
}
writeFileSync(join(DATA, 'track-joins.tsv'), joinRows.concat(joins).join('\n') + '\n');

// append joins to refinements (replace previous join rows)
const refPath = join(DATA, 'track-refinements.tsv');
const refLines = existsSync(refPath) ? readFileSync(refPath, 'utf8').trim().split('\n') : ['track_id\taction\tsplit_offsets\tsuggested_track_ids\tboundary_text\tevidence\tconfidence\tnote\treview'];
const keep = refLines.filter((l, i) => i === 0 || !l.startsWith('J') && !l.includes('\tjoin\t'));
const out = [...keep];
for (const line of joins) {
  const [id, left, right, ld, rd, shared, books, pages, evidence, conf, boundary] = line.split('\t');
  out.push([`${left}+${right}`, 'join', '', `${left};${right}`, boundary, `${books} (${shared} keys)`, conf, `join_group ${id}; ${pages}`, ''].join('\t'));
}
writeFileSync(refPath, out.join('\n') + '\n');
console.log(`joins ${joins.length}; → data/track-joins.tsv, appended to data/track-refinements.tsv`);
console.log(joins.slice(0, 5).join('\n'));



