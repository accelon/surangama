#!/usr/bin/env bun
/**
 * 合併分節：卷1 用蒙鈔疏文引文切出的 104 個讀窗，其餘各卷沿用 27 分節。
 *
 *   bun run scripts/build-sections.ts
 *
 * 讀 data/ke-windows-j1.json、data/ke-anchors.json
 * 寫 data/sections-final.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const anchors = JSON.parse(readFileSync(join(DATA, 'ke-anchors.json'), 'utf8')) as {
  sections: { juan: number; code: string; title: string; startU: number; endU: number }[];
};
const all = JSON.parse(readFileSync(join(DATA, 'windows-all.json'), 'utf8')) as {
  windows: { u0: number; u1: number; title: string; juan: number }[];
};
const w1 = { windows: all.windows.filter((w) => w.juan === 1).map((w, i) => ({ n: i + 1, title: w.title, u0: w.u0, u1: w.u1 })) };

const out: { n: number; title: string; u0: number; u1: number; group: string }[] = [];
let n = 0;
// 卷首
for (const s of anchors.sections) {
  if (s.juan === 0) out.push({ n: ++n, title: s.code + ' ' + (s.title || ''), u0: s.startU, u1: s.endU, group: '卷首' });
}
// 卷一：讀窗
for (const w of w1.windows) {
  out.push({ n: ++n, title: '卷一·' + w.n + '　' + w.title, u0: w.u0, u1: w.u1, group: '卷一' });
}
// 卷2 以後：用 windows-all
for (const w of all.windows) {
  if (w.juan === 0 || w.juan === 1) continue;
  out.push({ n: ++n, title: '卷' + w.juan + '·' + (n) + '　' + w.title, u0: w.u0, u1: w.u1, group: '卷' + w.juan });
}

function cnNum(k: number): string {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (k <= 10) return k === 10 ? '十' : d[k];
  if (k < 20) return '十' + d[k - 10];
  const t = Math.floor(k / 10), r = k % 10;
  return d[t] + '十' + (r ? d[r] : '');
}

// 收斂重疊：後一節起點不得早於前一節終點
for (let i = 1; i < out.length; i++) {
  if (out[i].u0 <= out[i - 1].u1) out[i].u0 = out[i - 1].u1 + 1;
  if (out[i].u1 < out[i].u0) out[i].u1 = out[i].u0;
}

// 驗證連續
let ok = true;
for (let i = 1; i < out.length; i++) if (out[i].u0 !== out[i - 1].u1 + 1) { ok = false; console.log('gap at', i, out[i - 1].u1, out[i].u0); }
console.log(`分節 ${out.length}，連續 ${ok}，覆蓋 ${out[0].u0}..${out[out.length - 1].u1}`);
writeFileSync(join(DATA, 'sections-final.json'), JSON.stringify({ schema: 1, sections: out }, null, 1) + '\n');
