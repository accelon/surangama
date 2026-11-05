#!/usr/bin/env bun
/**
 * 行級頁對映（骨架版）：把 adb 的《大佛頂首楞嚴經講義》逐行對到掃描本頁碼。
 *
 * 做法（抓大放小）：
 *   1. OCR 分頁全文（ocr-pages.txt）→ 正規化成一條字流，記每頁起始位移。
 *   2. adb 逐行（≥6 漢字）取開頭 24/20/16/12/8 字當錨，從上次位置往前 1000 字內找；
 *      找到就記「這一頁」，找不到就沿用上一頁。
 *   3. 因為兩本同版（8 字窗覆蓋 98%+），錨點幾乎都找得到，頁碼天然單調。
 *
 *   bun run scripts/page-map.ts
 *
 * 寫出：
 *   build/yuanying-page-map.tsv   行號、卷、頁、錨長、行首
 *   build/yuanying-page-map.json  統計 + 卷→頁範圍
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAdbText } from 'D:\\2026\\adb-converter\\ts\\src\\adbtext';
import { norm } from './lib/ngram';

const ROOT = join(import.meta.dir, '..');
const LIB = 'D:\\accelon3\\accelon3_fg\\Library.adb';
const OCR_PAGES = join(ROOT, 'vendor', 'yuanying', 'ocr-pages.txt');

// ---- 1. OCR：分頁 → 字流 + 頁起點
const ocrRaw = readFileSync(OCR_PAGES, 'utf8');
const pageStarts: number[] = [];
const pageNums: number[] = [];
let ocrNorm = '';
for (const m of ocrRaw.matchAll(/^=== p\.(\d+) ===$/gm)) {
  const start = m.index! + m[0].length;
  const end = ocrRaw.indexOf('\n=== p.', start);
  const text = ocrRaw.slice(start, end < 0 ? ocrRaw.length : end);
  pageNums.push(Number(m[1]));
  pageStarts.push(ocrNorm.length);
  ocrNorm += norm(text);
}
const pageAt = (pos: number): number => {
  let lo = 0, hi = pageStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pageStarts[mid] <= pos) lo = mid; else hi = mid - 1;
  }
  return pageNums[lo];
};
console.log(`OCR：${pageNums.length} 頁、${ocrNorm.length} 漢字（p.${pageNums[0]}–p.${pageNums[pageNums.length - 1]}）`);

// ---- 2. adb：取講義整段，逐行
const db = readAdbText(LIB);
const i = db.lines.findIndex((l) => l.includes('>大佛頂首楞嚴經講義</'));
let j = db.lines.findIndex((l, k) => k > i && /<書[^>]*>/.test(l));
if (j < 0) j = db.lines.length;
const seg = db.lines.slice(i, j);
db.close();

interface Row {
  no: number; vol: string; page: number; anchor: number; text: string;
  small: boolean; ke: boolean;
}
const rows: Row[] = [];
let vol = '卷首';
let cursor = 0;
let lastPage = pageNums[0];
let anchored = 0;

seg.forEach((line, idx) => {
  const v = /^<卷[^>]*>([^<]*)<\/卷>$/.exec(line.trim());
  if (v) { vol = v[1].replace(/^.*講義/, '').replace(/^第/, '第'); return; }
  const small = /<小字>|<偏右字>/.test(line);
  const ke = /<方>|<篇>/.test(line);
  const s = norm(line.replace(/<[^>]+>/g, ''));
  if (s.length < 6) { rows.push({ no: idx, vol, page: lastPage, anchor: 0, text: s, small, ke }); return; }

  let page = -1, anchor = 0;
  for (const len of [24, 20, 16, 12, 8]) {
    if (s.length < len) continue;
    const needle = s.slice(0, len);
    const from = Math.max(0, cursor - 1000);
    // 只在游標附近找（往前 1000、往後 2000 字），避免撞到後面的同詞把游標帶走
    const pos = ocrNorm.indexOf(needle, from);
    if (pos >= 0 && pos <= cursor + 2000) { page = pageAt(pos); anchor = len; cursor = pos + len; break; }
  }
  if (page < 0) page = lastPage; else anchored++;
  lastPage = page;
  rows.push({ no: idx, vol, page, anchor, text: s, small, ke });
});

// ---- 3. 統計
let drops = 0;
for (let k = 1; k < rows.length; k++) if (rows[k].page < rows[k - 1].page) drops++;
const byVol = new Map<string, { from: number; to: number; lines: number; small: number; ke: number }>();
for (const r of rows) {
  const b = byVol.get(r.vol) ?? { from: r.page, to: r.page, lines: 0, small: 0, ke: 0 };
  b.from = Math.min(b.from, r.page); b.to = Math.max(b.to, r.page);
  b.lines++; if (r.small) b.small++; if (r.ke) b.ke++;
  byVol.set(r.vol, b);
}

const tsv = ['line\tvol\tpage\tanchor\tclass\ttext']
  .concat(rows.map((r) => [r.no, r.vol, r.page, r.anchor, r.small ? '小字' : r.ke ? '科文' : '', r.text.slice(0, 40)].join('\t')))
  .join('\n') + '\n';
writeFileSync(join(ROOT, 'build', 'yuanying-page-map.tsv'), tsv);

writeFileSync(join(ROOT, 'build', 'yuanying-page-map.json'), JSON.stringify({
  schema: 1,
  source: { adb: LIB, ocrPages: OCR_PAGES },
  pages: pageNums.length,
  lines: rows.length,
  anchored,
  anchorRate: +(anchored / rows.filter((r) => r.text.length >= 6).length).toFixed(3),
  pageDrops: drops,
  vols: [...byVol].map(([v, b]) => ({ vol: v, ...b })),
}, null, 1) + '\n');

console.log(`行 ${rows.length}、有錨 ${anchored}（${((anchored / rows.length) * 100).toFixed(1)}%）、頁碼倒退 ${drops} 次`);
console.log('卷\t頁範圍\t行數\t小字行\t科文行');
for (const [v, b] of byVol) console.log(`${v}\tp.${b.from}–${b.to}\t${b.lines}\t${b.small}\t${b.ke}`);
console.log('→ build/yuanying-page-map.{tsv,json}');
