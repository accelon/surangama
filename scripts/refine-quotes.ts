#!/usr/bin/env bun
/**
 * 對 quote-profile 中「部分命中」的軌，做 2 字步長的細掃，找引用起訖，
 * 產生 suggested split points 與子軌號。
 *
 *   bun run scripts/refine-quotes.ts
 *
 * 讀 build/quote-profile-pilot.tsv、data/tracks-zh.tsv
 * 寫 data/track-refinements.tsv、build/quote-offsets.tsv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AdbReader, SyncIO } from '../../adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from '../../adb-converter/ts/src/accelon26/search.ts';
import { VaPaMapper } from '../../adb-converter/ts/src/accelon26/vapa.ts';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const BUILD = join(ROOT, 'build');
const isHan = (c: string) => { const cp = c.codePointAt(0) ?? 0; return (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x2fa1f); };
const hanOnly = (s: string) => Array.from(s).filter(isHan).join('');

const tracks = readFileSync(join(DATA, 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [track_id, base_sid, part, display_sid, addr, juan, page, text, han] = l.split('\t');
  return { track_id, base_sid, part: +part, display_sid, addr, juan: +juan, page, text, han: +han };
});
const byId = new Map(tracks.map((t) => [t.track_id, t]));
const profile = readFileSync(join(BUILD, 'quote-profile-pilot.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [track_id, base_sid, display_sid, windows, start, mid, end, ext_hits, books, pages, text] = l.split('\t');
  return { track_id, base_sid, display_sid, windows: +windows, start: +start, mid: +mid, end: +end, ext_hits: +ext_hits, books, pages, text };
});

type Ctx = { id: string; session: SearchSession; mapper: VaPaMapper; pageVa: Int32Array; pageIds: string[]; bookVa: Int32Array; bookNames: string[]; at: (a: Int32Array, v: number) => number };
async function open(id: string): Promise<Ctx> {
  const reader = await AdbReader.open(new SyncIO(`D:/accelon3/${id}.adb`));
  const session = new SearchSession(reader); await session.init();
  const mapper = new VaPaMapper(reader); await mapper.init();
  const tagVa = async (tag: string) => { const c = reader.containers.get('tags')!; const at = c.names.indexOf(tag); return at >= 0 ? Int32Array.from(await reader.decodeBlockList('tags', at)) : new Int32Array(); };
  const pageVa = await tagVa('頁');
  const pageIds = (await reader.attributeValues('頁.id'))?.values ?? [];
  const bookVa = await tagVa('書');
  let bookNames = (await reader.cachedStrings('書')) ?? [];
  if (!bookNames.length) bookNames = (await reader.attributeValues('書.n'))?.values ?? [];
  const at = (arr: Int32Array, va: number) => { let lo = 0, hi = arr.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= va) { k = m; lo = m + 1; } else hi = m - 1; } return k; };
  return { id, session, mapper, pageVa, pageIds, bookVa, bookNames, at };
}
const adbs = [await open('taisho'), await open('wxzj')];
const SELF = '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經';
const isRef = (book: string) => /楞嚴|首楞嚴|宗鏡錄/.test(book);

const offsetRows = ['track_id\twindow_offset\twindow\tadb\tbook\tpage\tmatched'];
const refinements = ['track_id\taction\tsplit_offsets\tsuggested_track_ids\tboundary_text\tevidence\tconfidence\tnote\treview'];
let splitCount = 0;
for (const p of profile) {
  const t = byId.get(p.track_id);
  if (!t || p.ext_hits === 0) continue;
  // 只細掃部分命中：start=0 或 end=0，或 mid=0 但兩端有
  if (p.start && p.mid && p.end) continue;
  const h = hanOnly(t.text);
  if (h.length < 10) continue;
  const hitsAt: { off: number; adb: string; book: string; page: string; matched: string }[] = [];
  for (let off = 0; off + 10 <= h.length; off += 2) {
    const q = h.slice(off, off + 10);
    for (const a of adbs) {
      let res; try { res = await a.session.searchPhrase(q, 40); } catch { continue; }
      for (const hit of res.hits) {
        const bi = a.at(a.bookVa, hit.va), pi = a.at(a.pageVa, hit.va);
        const book = a.bookNames[bi] || '', page = a.pageIds[pi] || '';
        if (a.id === 'taisho' && book === SELF) continue;
        if (!isRef(book)) continue;
        let matched = ''; try { matched = await a.mapper.textOfVaSpan(hit.va, hit.units); } catch { /* */ }
        const mh = hanOnly(matched);
        let common = 0; for (let k = 0; k < Math.min(mh.length, q.length); k++) if (mh[k] === q[k]) common++;
        if (common < 6) continue;
        hitsAt.push({ off, adb: a.id, book, page, matched: matched.replace(/[\t\r\n]+/g, ' ') });
        offsetRows.push([t.track_id, String(off), q, a.id, book, page, matched.replace(/[\t\r\n]+/g, ' ')].join('\t'));
      }
    }
  }
  if (!hitsAt.length) continue;
  const offs = [...new Set(hitsAt.map((x) => x.off))].sort((a, b) => a - b);
  const first = offs[0], last = offs[offs.length - 1];
  const splits: number[] = [];
  if (first > 0) splits.push(first);
  if (last + 10 < h.length) splits.push(last + 10);
  if (!splits.length) continue;
  const bounds = splits.map((s) => `${h.slice(Math.max(0, s - 6), s)}｜${h.slice(s, s + 6)}`).join(' / ');
  const child = splits.length === 1 ? [`${t.track_id}.1`, `${t.track_id}.2`] : [`${t.track_id}.1`, `${t.track_id}.2`, `${t.track_id}.3`];
  const books = [...new Set(hitsAt.map((x) => x.book))].filter(Boolean);
  const segs = [0, ...splits, h.length];
  const minChild = Math.min(...segs.slice(1).map((x, i) => x - segs[i]));
  const conf = minChild < 4 ? 'C' : books.length >= 2 ? 'A' : 'B';
  const review = minChild < 4 ? '1' : '0';
  refinements.push([t.track_id, 'split', splits.join(','), child.join(';'), bounds, books.slice(0, 6).join(';'), conf, `partial quote: first=${first}, last=${last}, han=${h.length}; min_child=${minChild}`, review].join('\t'));
  splitCount++;
}
writeFileSync(join(BUILD, 'quote-offsets.tsv'), offsetRows.join('\n') + '\n');
writeFileSync(join(DATA, 'track-refinements.tsv'), refinements.join('\n') + '\n');
console.log(`split suggestions ${splitCount}; offset rows ${offsetRows.length - 1} → data/track-refinements.tsv`);


