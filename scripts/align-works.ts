#!/usr/bin/env bun
/**
 * 對齊：把每部注疏的 8 字窗錨到主文 T945 的句子上（單調貪心，vcpp 的簡化版）。
 *
 *   bun run scripts/align-works.ts
 *
 * 讀 data/sutra.json、data/works/*.json
 * 寫 data/align/{id}.json、data/align-summary.json
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normWithMap } from './lib/ngram';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const OUT = join(DATA, 'align');
mkdirSync(OUT, { recursive: true });

const N = Number(process.env.ALIGN_N ?? 8);
const BASE = 131;
const POW = (() => { let p = 1; for (let i = 0; i < N; i++) p = Math.imul(p, BASE); return p | 0; })();

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  normLen: number;
  sentences: { i: number; juan: number; page: string; text: string; start: number; end: number }[];
};
const sents = sutra.sentences;
const sNorm = sents.map((s) => s.text.replace(/[^\u3400-\u9fff]/g, '')).join(''); // 佔位，下面用真正的字流
void sNorm;

// 主文字流：直接由句子 text 正規化接起來（與 extract-sutra 的 normLen 對齊）
const sText = sents.map((s) => s.text).join('');
const { text: sutraNorm, map: sutraMap } = normWithMap(sText);
void sutraMap;

// 句子在 sutraNorm 的位置：用每句正規化長度累加（與 extract-sutra 的 start/end 一致）
let acc = 0;
const sentStart: number[] = [];
const sentEnd: number[] = [];
for (const s of sents) {
  const n = normWithMap(s.text).text.length;
  sentStart.push(acc);
  acc += n;
  sentEnd.push(acc);
}

// sutraNorm 的 8 字窗索引
const sIndex = new Map<number, number[]>();
{
  let h = 0;
  for (let i = 0; i < sutraNorm.length; i++) {
    h = (Math.imul(h, BASE) + sutraNorm.charCodeAt(i)) | 0;
    if (i >= N) h = (h - Math.imul(sutraNorm.charCodeAt(i - N), POW)) | 0;
    if (i >= N - 1) {
      const st = i - N + 1;
      const a = sIndex.get(h); if (a) a.push(st); else sIndex.set(h, [st]);
    }
  }
}
console.log(`主文 ${sents.length} 句、正規化 ${sutraNorm.length} 字、窗 ${sIndex.size} 種`);

interface Summary { id: string; chars: number; windows: number; matched: number; kept: number; sentences: number; pages: number }

const files = readdirSync(join(DATA, 'works')).filter((f) => f.endsWith('.json'));
const summary: Summary[] = [];

for (const f of files) {
  const w = JSON.parse(readFileSync(join(DATA, 'works', f), 'utf8')) as {
    id: string; title: string; chars: number; lines: { page: string; text: string }[];
  };
  // 原文 + 每字的頁
  let raw = '';
  const pageOf: string[] = [];
  for (const l of w.lines) {
    for (const ch of l.text) { raw += ch; pageOf.push(l.page); }
    raw += '\n'; pageOf.push(l.page);
  }
  const { text: wn, map } = normWithMap(raw);

  // 找錨：work 的 8 字窗 → 主文位置，全部收下，再用 LIS 取最長單調鏈
  const pairs: { w: number; s: number }[] = [];
  let h = 0;
  for (let i = 0; i < wn.length; i++) {
    h = (Math.imul(h, BASE) + wn.charCodeAt(i)) | 0;
    if (i >= N) h = (h - Math.imul(wn.charCodeAt(i - N), POW)) | 0;
    if (i < N - 1) continue;
    const st = i - N + 1;
    const arr = sIndex.get(h);
    if (!arr) continue;
    const win = wn.slice(st, i + 1);
    for (const p of arr) if (sutraNorm.startsWith(win, p)) pairs.push({ w: st, s: p });
  }
  // 同一 work 位置只留一個：排序時 s 遞減，LIS 就不會重複取同一窗
  pairs.sort((a, b) => a.w - b.w || b.s - a.s);
  const tails: number[] = [];
  const tailIdx: number[] = [];
  const prev = new Int32Array(pairs.length).fill(-1);
  for (let i = 0; i < pairs.length; i++) {
    const s = pairs[i].s;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < s) lo = mid + 1; else hi = mid; }
    if (lo > 0) prev[i] = tailIdx[lo - 1];
    tails[lo] = s;
    tailIdx[lo] = i;
  }
  const kept: [number, number][] = [];
  for (let i = tailIdx.length ? tailIdx[tailIdx.length - 1] : -1; i >= 0; i = prev[i]) kept.push([pairs[i].w, pairs[i].s]);
  kept.reverse();

  // 句 → 注疏片段
  const perSentence = new Map<number, { start: number; end: number; page: string }[]>();
  let si = 0;
  for (const [wp, sp] of kept) {
    while (si + 1 < sents.length && sentStart[si + 1] <= sp) si++;
    if (sp < sentStart[si] || sp >= sentEnd[si]) continue;
    const rawStart = map[wp];
    const rawEnd = map[Math.min(wp + N - 1, map.length - 1)] + 1;
    const list = perSentence.get(si) ?? [];
    list.push({ start: rawStart, end: rawEnd, page: pageOf[rawStart] ?? '' });
    perSentence.set(si, list);
  }

  // 合併同一句內相鄰片段
  const merged = new Map<number, { start: number; end: number; page: string }[]>();
  for (const [k, list] of perSentence) {
    list.sort((a, b) => a.start - b.start);
    const out: { start: number; end: number; page: string }[] = [];
    for (const seg of list) {
      const last = out[out.length - 1];
      if (last && seg.start - last.end < 40) last.end = Math.max(last.end, seg.end);
      else out.push({ ...seg });
    }
    merged.set(k, out);
  }

  const pages = new Set(w.lines.map((l) => l.page).filter(Boolean));
  writeFileSync(join(OUT, `${w.id}.json`), JSON.stringify({
    schema: 1,
    id: w.id,
    title: w.title,
    chars: w.chars,
    sentences: [...merged].map(([s, frags]) => ({ s, frags })),
  }, null, 0) + '\n');

  const stat = {
    id: w.id, chars: w.chars, windows: kept.length,
    kept: kept.length, sentences: merged.size, pages: pages.size,
  };
  summary.push(stat);
  console.log(`${w.id}\t錨 ${kept.length}/${wn.length - N + 1}\t句 ${merged.size}/${sents.length}\t頁 ${pages.size}`);
}

writeFileSync(join(DATA, 'align-summary.json'), JSON.stringify({ schema: 1, n: N, summary }, null, 1) + '\n');
console.log('→ data/align/*.json、data/align-summary.json');
