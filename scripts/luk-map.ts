#!/usr/bin/env bun
/**
 * Luk（陸寬昱）英譯：目錄 → 漢文十卷的頁碼骨架。
 *
 *   bun run scripts/luk-map.ts
 *
 * 讀 vendor/english/surangama-yu.pdf（BDEA 書版，352 頁）的目錄頁；
 * 寫 data/luk-toc.json、data/luk-juan.json。
 *
 * 方法（抓大放小）：
 *   1. 目錄的八個大部（I–VIII）是現成錨，頁碼直接取。
 *   2. 部與卷的對應：I=卷一、II=卷四、IV=卷五、V=卷七、VI=卷八、VII=卷九、VIII=卷十。
 *   3. 中間的卷二、卷三、卷六用「主文字數比例」內插——這是骨架，誤差 ±5–10 頁。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normWithMap } from './lib/ngram';

const ROOT = join(import.meta.dir, '..');
const PDF = join(ROOT, 'vendor', 'english', 'surangama-yu.pdf');
const DATA = join(ROOT, 'data');

// ---- 1. 目錄（直接讀 PDF 第 6–14 頁的文字層）
const proc = Bun.spawnSync([
  'C:\\Users\\yapch\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe',
  '-c',
  `import sys, json
from pypdf import PdfReader
r = PdfReader(r"${PDF.replace(/\\/g, '\\\\')}")
out = []
for i in range(5, 15):
    out.append(r.pages[i].extract_text() or "")
print(json.dumps(out, ensure_ascii=False))`,
], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
const pages = JSON.parse(proc.stdout.toString()) as string[];

interface Toc { part?: string; title: string; page: string }
const toc: Toc[] = [];
let part = '';
let pending = '';
for (const pageText of pages) {
  for (const raw of pageText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[IVX]+$/.test(line)) { part = line; continue; }
    const m = /^(.*?)(?:\s*\.\s*){2,}\s*([ivxlcdm]+|\d+)\s*$/i.exec(line);
    if (m) {
      const title = (pending + ' ' + m[1]).replace(/\s+/g, ' ').trim();
      pending = '';
      if (title) toc.push({ part, title, page: m[2] });
    } else if (!/^\d+$/.test(line) && !/^[ivxlcdm]+$/i.test(line)) {
      pending = (pending + ' ' + line).trim();
    }
  }
}
writeFileSync(join(DATA, 'luk-toc.json'), JSON.stringify({ schema: 1, parts: toc.filter((t) => t.part), toc }, null, 1) + '\n');

// ---- 2. 八大部頁碼
const partPage: Record<string, number> = {};
for (const t of toc) if (t.part && !partPage[t.part] && /^\d+$/.test(t.page)) partPage[t.part] = Number(t.page);
// 部標題本身在目錄沒有頁碼，取該部第一條有頁碼的條目
const partFirst: Record<string, { title: string; page: number }> = {};
for (const t of toc) {
  if (!t.part || !/^\d+$/.test(t.page)) continue;
  if (!partFirst[t.part]) partFirst[t.part] = { title: t.title, page: Number(t.page) };
}
console.log('八部起始頁：', Object.entries(partFirst).map(([k, v]) => `${k}=${v.page}`).join(' '));

// ---- 3. 卷 → Luk 頁
const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { juan: number; text: string; start: number; end: number }[];
};
const start = new Map<number, number>();
let total = 0;
for (const s of sutra.sentences) {
  const n = normWithMap(s.text).text.length;
  if (!start.has(s.juan)) start.set(s.juan, total);
  total += n;
}
const frac = (j: number) => (start.get(j) ?? 0) / total;

// 錨：卷 → 頁（由八部推得）
const anchors: [number, number][] = [
  [1, partFirst['I'].page],    // 卷一
  [4, partFirst['II'].page],   // 卷四
  [5, partFirst['IV'].page],   // 卷五
  [7, partFirst['V'].page],    // 卷七
  [8, partFirst['VI'].page],   // 卷八
  [9, partFirst['VII'].page],  // 卷九
  [10, partFirst['VIII'].page],// 卷十
];

const interp = (j: number) => {
  for (let k = 0; k + 1 < anchors.length; k++) {
    const [j0, p0] = anchors[k], [j1, p1] = anchors[k + 1];
    if (j >= j0 && j <= j1) {
      const t = (frac(j) - frac(j0)) / (frac(j1) - frac(j0));
      return Math.round(p0 + t * (p1 - p0));
    }
  }
  return anchors[anchors.length - 1][1];
};

const rows = Array.from({ length: 10 }, (_, i) => i + 1).map((j) => ({ juan: j, page: interp(j) }));
for (let k = 0; k < rows.length - 1; k++) rows[k] = { ...rows[k], end: rows[k + 1].page - 1 } as typeof rows[0];
(rows[rows.length - 1] as typeof rows[0] & { end?: number }).end = 330;

writeFileSync(join(DATA, 'luk-juan.json'), JSON.stringify({
  schema: 1,
  source: 'surangama-yu.pdf',
  method: '八部錨點 + 主文字數內插（骨架，誤差 ±5–10 頁）',
  parts: partFirst,
  juan: rows,
}, null, 1) + '\n');

console.log('卷\tLuk 頁');
for (const r of rows) console.log(`${r.juan}\tp.${r.page}–${(r as { end?: number }).end}`);
