#!/usr/bin/env bun
/**
 * 以 T945 軌號為單位，到 taisho.adb／wxzj.adb 掃引用。
 * Pilot：每軌取 start/mid/end 三個 10 字窗，SearchSession 片語搜尋，
 * 排除 T945 自身，記錄書名/頁碼/VA/命中文字。
 *
 *   bun run scripts/scan-quotes.ts --limit 120 --windows 3
 *
 * 寫 build/quote-scan-pilot.tsv、build/quote-profile-pilot.tsv
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AdbReader, SyncIO } from '../../adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from '../../adb-converter/ts/src/accelon26/search.ts';
import { VaPaMapper } from '../../adb-converter/ts/src/accelon26/vapa.ts';

const ROOT = join(import.meta.dir, '..');
const BUILD = join(ROOT, 'build');
mkdirSync(BUILD, { recursive: true });
const args = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const LIMIT = +opt('limit', '120');
const WINDOWS = +opt('windows', '3');
const ADBS = opt('adb', 'taisho,wxzj').split(',').map((s) => s.trim());
const FROM = opt('from', '');
const TO = opt('to', '');
console.log('args', args, 'FROM', FROM, 'TO', TO);

const isHan = (c: string) => {
  const cp = c.codePointAt(0) ?? 0;
  return (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff)
    || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x2fa1f);
};
const hanOnly = (s: string) => Array.from(s).filter(isHan).join('');
const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ').trim();

const tracks = readFileSync(join(ROOT, 'data', 'tracks-zh.tsv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [track_id, base_sid, part, display_sid, addr, juan, page, text, han] = l.split('\t');
  return { track_id, base_sid, part: +part, display_sid, addr, juan: +juan, page, text, han: +han };
});
// 取樣：跳過咒語與太短/太長的軌，平均分佈
const usable = tracks.filter((t) => t.han >= 10 && t.han <= 80 && t.base_sid !== 'S2434' && t.base_sid !== 'S2587');
const step = Math.max(1, Math.floor(usable.length / LIMIT));
const sample = FROM && TO
  ? tracks.filter((t) => +t.display_sid.slice(1) >= +FROM.slice(1) && +t.display_sid.slice(1) <= +TO.slice(1))
  : usable.filter((_, i) => i % step === 0).slice(0, LIMIT);
console.log(`tracks ${tracks.length}; usable ${usable.length}; sample ${sample.length}; step ${step}`);

type Hit = { adb: string; track_id: string; base_sid: string; display_sid: string; where: string; window: string; book: string; page: string; va: number; units: number; matched: string };
type AdbCtx = { id: string; reader: AdbReader; session: SearchSession; mapper: VaPaMapper; pageVa: Int32Array; pageIds: string[]; bookVa: Int32Array; bookNames: string[]; at: (arr: Int32Array, va: number) => number };

async function openAdb(id: string): Promise<AdbCtx> {
  const path = `D:/accelon3/${id}.adb`;
  const reader = await AdbReader.open(new SyncIO(path));
  const session = new SearchSession(reader);
  await session.init();
  const mapper = new VaPaMapper(reader);
  await mapper.init();
  const tagVa = async (tag: string) => {
    const c = reader.containers.get('tags')!;
    const at = c.names.indexOf(tag);
    return at >= 0 ? Int32Array.from(await reader.decodeBlockList('tags', at)) : new Int32Array();
  };
  const pageVa = await tagVa('頁');
  const pageIds = (await reader.attributeValues('頁.id'))?.values ?? [];
  const bookVa = await tagVa('書');
  let bookNames = (await reader.cachedStrings('書')) ?? [];
  if (!bookNames.length) bookNames = (await reader.attributeValues('書.n'))?.values ?? [];
  const at = (arr: Int32Array, va: number) => {
    let lo = 0, hi = arr.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= va) { k = m; lo = m + 1; } else hi = m - 1; }
    return k;
  };
  console.log(`${id}: pages ${pageVa.length}, books ${bookVa.length}, bookNames ${bookNames.length}`);
  return { id, reader, session, mapper, pageVa, pageIds, bookVa, bookNames, at };
}

const adbCtx = [];
for (const id of ADBS) adbCtx.push(await openAdb(id));

const SELF = '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經';
const hits: Hit[] = [];
const profile: any[] = [];
for (let i = 0; i < sample.length; i++) {
  const t = sample[i];
  const h = hanOnly(t.text);
  const rec: any = { track_id: t.track_id, base_sid: t.base_sid, display_sid: t.display_sid, text: t.text, windows: 0, start: 0, mid: 0, end: 0, ext_hits: 0, books: new Set<string>(), pages: new Set<string>() };
  if (h.length < 10) { profile.push(rec); continue; }
  const W = 10;
  const positions = WINDOWS === 1 ? [0] : WINDOWS === 2 ? [0, h.length - W] : [0, Math.floor((h.length - W) / 2), h.length - W];
  const windows = [...new Set(positions.map((p) => h.slice(Math.max(0, p), Math.max(0, p) + W)))].filter((x) => x.length >= 10);
  rec.windows = windows.length;
  for (let wi = 0; wi < windows.length; wi++) {
    const q = windows[wi];
    for (const a of adbCtx) {
      let res;
      try { res = await a.session.searchPhrase(q, 80); } catch { continue; }
      if (!res.hits.length) continue;
      for (const hit of res.hits) {
        const bi = a.at(a.bookVa, hit.va);
        const pi = a.at(a.pageVa, hit.va);
        const book = a.bookNames[bi] || '';
        const page = a.pageIds[pi] || '';
        if (a.id === 'taisho' && book === SELF) continue;
        let matched = '';
        try { matched = await a.mapper.textOfVaSpan(hit.va, hit.units); } catch { /* ignore */ }
        // 至少 6 個漢字重疊，降低短窗誤中
        const mh = hanOnly(matched);
        let common = 0;
        for (let k = 0; k < Math.min(mh.length, q.length); k++) if (mh[k] === q[k]) common++;
        if (common < Math.min(6, q.length)) continue;
        hits.push({ adb: a.id, track_id: t.track_id, base_sid: t.base_sid, display_sid: t.display_sid, where: ['start', 'mid', 'end'][wi] || String(wi), window: q, book, page, va: hit.va, units: hit.units, matched: clean(matched) });
        rec.ext_hits++;
        rec[['start', 'mid', 'end'][wi] || 'mid'] = 1;
        if (book) rec.books.add(book);
        if (page) rec.pages.add(page);
      }
    }
  }
  rec.books = [...rec.books].slice(0, 8).join(';');
  rec.pages = [...rec.pages].slice(0, 8).join(';');
  profile.push(rec);
  if ((i + 1) % 10 === 0) console.log(`... ${i + 1}/${sample.length} hits ${hits.length}`);
}

writeFileSync(join(BUILD, 'quote-scan-pilot.tsv'), ['adb\ttrack_id\tbase_sid\tdisplay_sid\twhere\twindow\tbook\tpage\tva\tunits\tmatched']
  .concat(hits.map((x) => [x.adb, x.track_id, x.base_sid, x.display_sid, x.where, x.window, x.book, x.page, x.va, x.units, x.matched].join('\t'))).join('\n') + '\n');
writeFileSync(join(BUILD, 'quote-profile-pilot.tsv'), ['track_id\tbase_sid\tdisplay_sid\twindows\tstart\tmid\tend\text_hits\tbooks\tpages\ttext']
  .concat(profile.map((x) => [x.track_id, x.base_sid, x.display_sid, x.windows, x.start, x.mid, x.end, x.ext_hits, x.books, x.pages, clean(x.text)].join('\t'))).join('\n') + '\n');
console.log(`hits ${hits.length}; tracks ${profile.length} → build/quote-scan-pilot.tsv, build/quote-profile-pilot.tsv`);




