#!/usr/bin/env bun
/**
 * 把圓瑛《大佛頂首楞嚴經講義》掃描本的 OCR 文字依「印刷頁碼」切頁。
 *
 * 來源：vendor/yuanying/大佛頂首楞嚴經講義_圓瑛法師_djvu.txt
 *       （archive.org 掃描本的文字層；頁碼是獨立一行的全形數字，1–1,576 連續）
 *
 *   bun run scripts/ocr-pages.ts
 *
 * 寫出：
 *   vendor/yuanying/ocr-pages.tsv     頁碼、漢字數、該頁第一行
 *   vendor/yuanying/ocr-pages.txt     分頁全文（=== p.N === 標記）
 *   build/yuanying-pages.json          卷 → 起始頁 對照
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SRC = join(ROOT, 'vendor', 'yuanying', '大佛頂首楞嚴經講義_圓瑛法師_djvu.txt');
const OUT = join(ROOT, 'vendor', 'yuanying');
mkdirSync(join(ROOT, 'build'), { recursive: true });

const lines = readFileSync(SRC, 'utf8').split(/\r?\n/).map((l) => l.trim());

const isPageNo = (s: string) => {
  if (!s) return false;
  // 全形數字（１..９、０）或半形數字
  return /^[\uFF10-\uFF19]+$/.test(s) || /^\d{1,4}$/.test(s);
};
const toInt = (s: string) => Number(s.replace(/[\uFF10-\uFF19]/g, (c) => String(c.charCodeAt(0) - 0xff10)));

const pages: { page: number; lines: string[] }[] = [];
let cur: { page: number; lines: string[] } | null = null;
const skippedBefore: string[] = [];
for (const line of lines) {
  if (isPageNo(line)) {
    const n = toInt(line);
    // 只認遞增的頁碼（避免把經文裡的數字當頁碼）
    if (!cur || n === cur.page + 1) {
      cur = { page: n, lines: [] };
      pages.push(cur);
      continue;
    }
  }
  if (cur) cur.lines.push(line);
  else if (line) skippedBefore.push(line);
}

const han = (s: string) => (s.match(/[\u3400-\u9fff]/g) ?? []).length;

const tsv = ['page\than\tfirst'];
const txt: string[] = [];
const volStarts: { vol: string; page: number }[] = [];
for (const p of pages) {
  const text = p.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const first = (p.lines.find((l) => l) ?? '').slice(0, 40);
  tsv.push(`${p.page}\t${han(text)}\t${first}`);
  txt.push(`=== p.${p.page} ===\n${text}`);
  // 卷標題是頁眉式全行：「大佛頂…講義第一卷」；同一卷每頁都會重複，取第一次出現
  for (const l of p.lines) {
    const m = /講義\s*第([一二三四五六七八九十]+)卷/.exec(l);
    if (m) { if (!volStarts.some((v) => v.vol === `第${m[1]}卷`)) volStarts.push({ vol: `第${m[1]}卷`, page: p.page }); break; }
  }
}
writeFileSync(join(OUT, 'ocr-pages.tsv'), tsv.join('\n') + '\n');
writeFileSync(join(OUT, 'ocr-pages.txt'), txt.join('\n\n') + '\n');

// 沒有頁碼的前導行（封面、書名頁）
if (skippedBefore.length) console.log(`頁碼前的 ${skippedBefore.length} 行：${skippedBefore.slice(0, 4).join(' / ')}`);

console.log(`切出 ${pages.length} 頁（p.${pages[0]?.page}–p.${pages[pages.length - 1]?.page}），漢字 ${pages.reduce((a, p) => a + han(p.lines.join('')), 0)}`);
console.log('卷 → 起始頁：');
for (const v of volStarts) console.log(`  ${v.vol}\tp.${v.page}`);

writeFileSync(join(ROOT, 'build', 'yuanying-pages.json'), JSON.stringify({
  schema: 1,
  source: SRC,
  pages: pages.length,
  firstPage: pages[0]?.page,
  lastPage: pages[pages.length - 1]?.page,
  volStarts,
}, null, 1) + '\n');
console.log('→ vendor/yuanying/ocr-pages.{tsv,txt}、build/yuanying-pages.json');
