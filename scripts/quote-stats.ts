#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
const h = readFileSync('build/quote-scan-pilot.tsv', 'utf8').trim().split('\n');
const head = h[0].split('\t'); const rows = h.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [head[i], v])));
const p = readFileSync('build/quote-profile-pilot.tsv', 'utf8').trim().split('\n');
const ph = p[0].split('\t'); const prof = p.slice(1).map((l) => Object.fromEntries(l.split('\t').map((v, i) => [ph[i], v])));
const byBook = new Map<string, number>(); const byAdb = new Map<string, number>(); const byTrack = new Map<string, number>();
for (const r of rows) { byBook.set(r.book, (byBook.get(r.book) || 0) + 1); byAdb.set(r.adb, (byAdb.get(r.adb) || 0) + 1); byTrack.set(r.track_id, (byTrack.get(r.track_id) || 0) + 1); }
const withHits = prof.filter((x) => +x.ext_hits > 0).length;
const partial = prof.filter((x) => +x.ext_hits > 0 && (+x.start === 0 || +x.end === 0 || +x.mid === 0)).length;
const topBooks = [...byBook.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
const summary = { hits: rows.length, tracks_scanned: prof.length, tracks_with_hits: withHits, partial_tracks: partial, distinct_books: byBook.size, by_adb: Object.fromEntries(byAdb), top_books: topBooks };
writeFileSync('build/quote-summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(summary);
