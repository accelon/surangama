#!/usr/bin/env bun
/**
 * 查一句話在掃描本的第幾頁（行級頁對映的簡便入口）。
 *
 *   bun run scripts/page-lookup.ts "阿難白佛言世尊"
 *
 * 用正規化後的 8–24 字窗在 OCR 分頁字流裡找；找到就回報頁碼與卷（用頁碼反推）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { norm } from './lib/ngram';

const ROOT = join(import.meta.dir, '..');
const OCR_PAGES = join(ROOT, 'vendor', 'yuanying', 'ocr-pages.txt');
const PAGES_JSON = join(ROOT, 'build', 'yuanying-pages.json');

const query = process.argv.slice(2).join(' ').trim();
if (!query) { console.error('用法：bun run scripts/page-lookup.ts "一段文字"'); process.exit(2); }

const ocrRaw = readFileSync(OCR_PAGES, 'utf8');
const starts: number[] = [];
const nums: number[] = [];
let stream = '';
for (const m of ocrRaw.matchAll(/^=== p\.(\d+) ===$/gm)) {
  const start = m.index! + m[0].length;
  const end = ocrRaw.indexOf('\n=== p.', start);
  nums.push(Number(m[1]));
  starts.push(stream.length);
  stream += norm(ocrRaw.slice(start, end < 0 ? ocrRaw.length : end));
}
const pageAt = (pos: number) => {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
  return nums[lo];
};

const q = norm(query);
const hits: { page: number; len: number; at: number }[] = [];
for (const len of [24, 16, 12, 8]) {
  if (q.length < len) continue;
  const pos = stream.indexOf(q.slice(0, len));
  if (pos >= 0) hits.push({ page: pageAt(pos), len, at: pos });
  if (hits.length) break;
}
if (!hits.length) { console.log(`找不到（正規化後 ${q.length} 字）`); process.exit(1); }

const { page, len } = hits[0];
// 用捲→頁對照反推卷
let vol = '';
try {
  const meta = JSON.parse(readFileSync(PAGES_JSON, 'utf8')) as { volStarts: { vol: string; page: number }[] };
  const cand = meta.volStarts.filter((v) => v.page <= page).pop();
  if (cand) vol = cand.vol;
} catch { /* ignore */ }
console.log(`「${query}」→ ${vol ? vol + '，' : ''}p.${page}（錨 ${len} 字）`);
