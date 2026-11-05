#!/usr/bin/env bun
/**
 * 比對圓瑛《大佛頂首楞嚴經講義》的兩個電子本：
 *   A. Library.adb（近代大師全集書畾）——有科文
 *   B. 詩詞匯 zh-tw 全文（明暘校對本）——沒有科文
 *
 *   bun run scripts/compare-yuanying.ts
 *
 * 輸出：build/yuanying-compare.json + stdout 摘要。
 * 只讀語料，不改 vendor/ 以外任何東西。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readAdbText } from 'D:\\2026\\adb-converter\\ts\\src\\adbtext';
import { buildIndex, coverageOf, norm } from './lib/ngram';

const ROOT = join(import.meta.dir, '..');
const BUILD = join(ROOT, 'build');
mkdirSync(BUILD, { recursive: true });

const LIB = 'D:\\accelon3\\accelon3_fg\\Library.adb';
const SHICI = join(ROOT, 'vendor', 'yuanying', 'shicihui-full.txt');

// ---- A：adb 取「大佛頂首楞嚴經講義」整段
const db = readAdbText(LIB);
const i = db.lines.findIndex((l) => l.includes('>大佛頂首楞嚴經講義</'));
if (i < 0) throw new Error('adb 找不到圓瑛講義');
let j = db.lines.findIndex((l, k) => k > i && /<書[^>]*>/.test(l));
if (j < 0) j = db.lines.length;
const seg = db.lines.slice(i, j);
db.close();

/** 依 <卷> 切段（第一卷…第二十四卷）；卷前的是卷首。 */
const vols: { title: string; lines: string[] }[] = [{ title: '卷首', lines: [] }];
for (const line of seg) {
  const m = /^<卷[^>]*>([^<]*)<\/卷>$/.exec(line.trim());
  if (m) { vols.push({ title: m[1], lines: [] }); continue; }
  vols[vols.length - 1].lines.push(line);
}
const adbText = (ls: string[]) => norm(ls.join('\n').replace(/<[^>]+>/g, ''));

// ---- B：詩詞匯全文
const shiciRaw = readFileSync(SHICI, 'utf8');
const shiciSections: { title: string; text: string }[] = [];
let cur: { title: string; lines: string[] } | null = null;
for (const line of shiciRaw.split(/\r?\n/)) {
  const m = /^# (.+)$/.exec(line);
  if (m) {
    if (cur) shiciSections.push({ title: cur.title, text: cur.lines.join('\n') });
    cur = { title: m[1], lines: [] };
  } else if (cur) cur.lines.push(line);
}
if (cur) shiciSections.push({ title: cur.title, text: cur.lines.join('\n') });

const han = (s: string) => (s.match(/[\u3400-\u9fff]/g) ?? []).length;

// 對卷：卷首（4 篇序＋自序）合併；第N卷逐一對
const shiciFront = shiciSections.filter((s) => !/^第.+卷$/.test(s.title));
const shiciVols = new Map<string, string>(); // 原文，比對時才 norm
for (const s of shiciSections) {
  const m = /^第(.+?)卷$/.exec(s.title);
  if (m) shiciVols.set(m[1], s.text);
}
/** adb 的卷標題是「…講義第一卷」，取「一」這種數字當 key */
const volKey = (t: string) => /第(.+?)卷$/.exec(t)?.[1] ?? t;
const frontRaw = shiciFront.map((s) => s.text).join('\n');
const frontText = norm(frontRaw);

interface Row {
  vol: string;
  adbHan: number; shiciHan: number; diff: number;
  shiciInAdb: number; adbInShici: number;
  adbLines: number; unmatched: number;
}

const rows: Row[] = [];
const unmatchedSamples: string[] = [];

for (const v of vols) {
  const a = adbText(v.lines);
  const key = volKey(v.title);
  // adb 把卷首四篇序放在第一卷裡；詩詞匯把它們獨立成篇，比對時併回去
  const b = v.title === '卷首' ? frontText
    : norm(key === '一' ? `${shiciVols.get('一') ?? ''}\n${frontRaw}` : shiciVols.get(key) ?? '');
  if (!a.length) continue;
  const idxA = buildIndex(a, 8);
  const idxB = buildIndex(b, 8);
  const covB = b ? coverageOf(idxA, a, b).cov : 0;   // B 的窗有多少在 A
  const covA = b ? coverageOf(idxB, b, a).cov : 0;   // A 的窗有多少在 B
  // adb 的每一行（≥6 漢字）是否原樣出現在 B
  const lines = v.lines.map((l) => norm(l.replace(/<[^>]+>/g, ''))).filter((l) => l.length >= 6);
  let unmatched = 0;
  for (const l of lines) {
    if (b && b.includes(l)) continue;
    unmatched++;
    if (unmatchedSamples.length < 40) unmatchedSamples.push(`${v.title}\t${l}`);
  }
  rows.push({
    vol: v.title,
    adbHan: han(a), shiciHan: han(b), diff: han(a) - han(b),
    shiciInAdb: +covB.toFixed(4), adbInShici: +covA.toFixed(4),
    adbLines: lines.length, unmatched,
  });
}

const pct = (v: number) => (v * 100).toFixed(1);
console.log('卷\tadb漢字\tshicihui漢字\t差\tB在A\tA在B\tadb行\t未對上');
for (const r of rows) {
  console.log(`${r.vol}\t${r.adbHan}\t${r.shiciHan}\t${r.diff}\t${pct(r.shiciInAdb)}%\t${pct(r.adbInShici)}%\t${r.adbLines}\t${r.unmatched}`);
}
const sum = rows.filter((r) => r.vol !== '卷首').reduce((o, r) => ({
  a: o.a + r.adbHan, b: o.b + r.shiciHan, lines: o.lines + r.adbLines, miss: o.miss + r.unmatched,
}), { a: 0, b: 0, lines: 0, miss: 0 });
console.log(`合計（卷一–二四）\t${sum.a}\t${sum.b}\t${sum.a - sum.b}\t\t\t${sum.lines}\t${sum.miss}`);

// ---- adb 的標記：科文／小字是「標記」還是「多出的文字」？
const tagCount = new Map<string, number>();
for (const l of seg) for (const m of l.matchAll(/<([^\s\/>]+)[^>]*>/g)) tagCount.set(m[1], (tagCount.get(m[1]) ?? 0) + 1);
const tagTop = [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('\nadb 標記：' + tagTop.map(([k, v]) => `${k}=${v}`).join(' '));

const shiciAll = norm(readFileSync(SHICI, 'utf8').replace(/^#.*$/gm, ''));
const inlineCheck = (tag: string) => {
  const re = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'g');
  const items = [...seg.join('\n').matchAll(re)].map((m) => norm(m[1])).filter((s) => s.length >= 2);
  const found = items.filter((s) => shiciAll.includes(s)).length;
  return { tag, total: items.length, found };
};
for (const c of [inlineCheck('小字'), inlineCheck('偏右字'), inlineCheck('方'), inlineCheck('篇')]) {
  console.log(`${c.tag}：${c.total} 條，其中 ${c.found} 條的內容也出現在詩詞匯本（${c.total ? ((c.found / c.total) * 100).toFixed(1) : '—'}%）`);
}

// ---- 掃描本 OCR 與詩詞匯本的文字一致度
const OCR = join(ROOT, 'vendor', 'yuanying', '大佛頂首楞嚴經講義_圓瑛法師_djvu.txt');
let ocrCov: number | null = null;
try {
  const ocr = norm(readFileSync(OCR, 'utf8'));
  const idx = buildIndex(shiciAll, 8);
  ocrCov = coverageOf(idx, shiciAll, ocr).cov;
  console.log(`掃描本 OCR：${ocr.length} 漢字；詩詞匯本的 8 字窗有 ${(ocrCov * 100).toFixed(1)}% 出現在 OCR 裡`);
} catch { console.log('（沒有掃描本 OCR，跳過）'); }

// 未對上的短行（科文候選）
const cand = unmatchedSamples.filter((s) => s.split('\t')[1].length <= 12).slice(0, 25);
console.log('\n未對上的短行（前 25，科文候選）：');
for (const c of cand) console.log(' ', c);

writeFileSync(join(BUILD, 'yuanying-compare.json'), JSON.stringify({
  schema: 1,
  adb: LIB,
  shicihui: SHICI,
  rows,
  totals: sum,
  unmatchedSamples,
}, null, 1) + '\n');
console.log('\n→ build/yuanying-compare.json');
