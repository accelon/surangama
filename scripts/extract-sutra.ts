#!/usr/bin/env bun
/**
 * 主文：T945《大佛頂首楞嚴經》→ data/sutra.json
 *
 * 每句：{ i, juan, page, text, start, end }
 *   page  = 大正頁 id（例 19p106a），取該句第一個字所在頁
 *   juan  = 1–10
 *   start/end = 在「正規化字流」中的位移（給對齊用）
 *
 *   bun run scripts/extract-sutra.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normWithMap } from './lib/ngram';

const CORPUS = process.env.SURANGAMA_CORPUS ?? 'D:\\2026\\adb-converter';
const ROOT = join(import.meta.dir, '..');
mkdirSync(join(ROOT, 'data'), { recursive: true });

const all = readFileSync(join(CORPUS, 'build', 'tei-all-2026R2.txt'), 'utf8');
const marks = [...all.matchAll(/<段\/><書 id="n(\d+)">([^<]*)<\/書>/g)];
const ti = marks.findIndex((m) => m[2].includes('首楞嚴經') && m[2].includes('大佛頂'));
if (ti < 0) throw new Error('找不到 T945');
const start = marks[ti].index! + marks[ti][0].length;
const end = ti + 1 < marks.length ? marks[ti + 1].index! : all.length;
const chunk = all.slice(start, end);

/** 依序掃描：頁／卷／序 標記與文字，累積「字 + 頁 + 卷」。 */
interface Ch { ch: string; page: string; juan: number }
const chars: Ch[] = [];
let page = '';
let juan = 0;
const token = /<頁 id="([^"]+)"\/>|<卷>([^<]*)<\/卷>|<[^>]+>|([^<]+)/g;
const firstPage = /<頁 id="([^"]+)"\/>/.exec(chunk)?.[1] ?? '';
let skipped = false; // 第十卷後的「校注」段落是校勘記，不是經文
for (const m of chunk.matchAll(token)) {
  if (m[1]) { page = m[1]; continue; }
  if (m[2]) {
    if (m[2].includes('校注')) { skipped = true; continue; }
    const j = /卷第([一二三四五六七八九十]+)/.exec(m[2]);
    if (j) juan = '一二三四五六七八九十'.indexOf(j[1]) + 1 || juan;
    skipped = false;
    continue;
  }
  if (!m[3] || skipped) continue;
  for (const ch of m[3]) {
    if (ch === '\n' || ch === '\r') continue;
    chars.push({ ch, page: page || firstPage, juan });
  }
}

// 切句：以 。！？； 為界（含標點），句首的頁／卷即該句位置
const SENT_END = /[。！？；]/;
const sentences: { i: number; juan: number; page: string; text: string }[] = [];
let buf: Ch[] = [];
const flush = () => {
  if (!buf.length) return;
  const text = buf.map((c) => c.ch).join('').trim();
  if (text) sentences.push({ i: sentences.length, juan: buf[0].juan, page: buf[0].page, text });
  buf = [];
};
for (const c of chars) {
  buf.push(c);
  if (SENT_END.test(c.ch)) flush();
}
flush();

// 正規化字流 + 每句的 start/end
const joined = chars.map((c) => c.ch).join('');
const { text: ntext, map } = normWithMap(joined);
// 正規化位移 → 原字位移的反查，用於句子邊界
let cursor = 0;
const enriched = sentences.map((s) => {
  // 在 ntext 裡找尋這句的起點：用目前已累積的原文位置換算
  const rawStart = joined.indexOf(s.text, cursor);
  const rawEnd = rawStart < 0 ? -1 : rawStart + s.text.length;
  if (rawStart >= 0) cursor = rawEnd;
  // 原文位置 → 正規化位置（二分搜尋）
  const npos = (raw: number) => {
    let lo = 0, hi = map.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (map[mid] < raw) lo = mid + 1; else hi = mid; }
    return lo;
  };
  return { ...s, start: rawStart < 0 ? -1 : npos(rawStart), end: rawStart < 0 ? -1 : npos(Math.max(rawStart, rawEnd - 1)) + 1 };
});

writeFileSync(join(ROOT, 'data', 'sutra.json'), JSON.stringify({
  schema: 1,
  no: 'T945',
  title: marks[ti][2],
  juanCount: 10,
  normLen: ntext.length,
  sentences: enriched,
}, null, 0) + '\n');

const byJuan = new Map<number, number>();
for (const s of enriched) byJuan.set(s.juan, (byJuan.get(s.juan) ?? 0) + 1);
console.log(`句 ${enriched.length}、正規化 ${ntext.length} 字`);
console.log('卷：' + [...byJuan].sort((a, b) => a[0] - b[0]).map(([j, n]) => `卷${j}=${n}`).join(' '));
console.log('首句：', enriched[0]?.text.slice(0, 30), '｜', enriched[0]?.page);
console.log('末句：', enriched[enriched.length - 1]?.text.slice(-30), '｜', enriched[enriched.length - 1]?.page);
