#!/usr/bin/env bun
/**
 * 科判錨定：把蒙鈔目錄的「起…盡…」對到主文句，產生分節（sections）。
 *
 *   bun run scripts/build-ke-anchors.ts
 *
 * 讀 data/works/X287.json（目錄）、data/sutra.json
 * 寫 data/ke-anchors.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; page: string; text: string }[];
};
const x287 = JSON.parse(readFileSync(join(DATA, 'works', 'X287.json'), 'utf8')) as {
  lines: { text: string; page: string }[];
};
const lines = x287.lines.map((l) => l.text);

const CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function cn(s: string): number {
  if (s === '十') return 10;
  if (s.length === 1) return CN[s] || 0;
  if (s[0] === '十') return 10 + (CN[s[1]] || 0);
  if (s[1] === '十') return (CN[s[0]] || 0) * 10 + (s[2] ? CN[s[2]] || 0 : 0);
  return CN[s] || 0;
}

// ---- 1. 解析目錄
const start = lines.findIndex((t) => t.includes('大佛頂首楞嚴經疏解蒙鈔目錄'));
type Entry = { juan: number; code: string; title: string; range: string };
const entries: Entry[] = [];
let juan = 0;
let cur: { juan: number; code: string; body: string } | null = null;
const flush = () => {
  if (!cur) return;
  const body = cur.body.trim();
  const rm = /起(.+?)盡(.+)$/.exec(body);
  let range = rm ? rm[0] : '';
  let title = rm ? body.slice(0, rm.index) : body;
  title = title.replace(/經$/, '').replace(/^經/, '').trim();
  entries.push({ juan: cur.juan, code: cur.code, title, range });
  cur = null;
};
for (let i = start + 1; i < lines.length; i++) {
  const t = lines[i].trim();
  if (/卷末佛頂五錄|佛頂五錄/.test(t)) break;
  const mj = /^第([一二三四五六七八九十]+)卷$/.exec(t);
  if (mj) { flush(); juan = cn(mj[1]); continue; }
  const m = /^([一二三四五六七八九十]+之[一二三四五六七八九十]+)[　\s]*(.*)$/.exec(t);
  if (m) { flush(); cur = { juan, code: m[1], body: m[2] }; continue; }
  if (cur) cur.body += t;
}
flush();

// ---- 2. 比對經文
const norm = (s: string) => s.replace(/[「」『』（）()\s，。、；：！？…—·]/g, '');
// 把全部句子正規化後串起來，片語可以跨句匹配
const normSents = sutra.sentences.map((s) => norm(s.text));
const sentStart: number[] = [];
let pos = 0;
for (let i = 0; i < normSents.length; i++) { sentStart.push(pos); pos += normSents[i].length; }
const fullNorm = normSents.join('');

function sentAt(charPos: number): number {
  let lo = 0, hi = sentStart.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sentStart[mid] <= charPos) lo = mid; else hi = mid - 1;
  }
  return lo;
}

function find(phrase: string, lo: number, hi: number): number | null {
  const p = norm(phrase).replace(/^卷中/, '').replace(/^卷末$/, '');
  if (!p) return null;
  const from = sentStart[Math.max(0, lo)] ?? 0;
  const to = hi >= sentStart.length ? fullNorm.length : sentStart[hi] + normSents[hi].length;
  const idx = fullNorm.indexOf(p, from);
  if (idx < 0 || idx > to) return null;
  return sentAt(idx);
}

// 每卷的句範圍
const juanRange: Record<number, { lo: number; hi: number }> = {};
for (const s of sutra.sentences) {
  const r = juanRange[s.juan] || (juanRange[s.juan] = { lo: s.i, hi: s.i });
  r.lo = Math.min(r.lo, s.i);
  r.hi = Math.max(r.hi, s.i);
}

const out = entries.map((e) => {
  let sp = '';
  let ep = '';
  const m = /起(.+?)盡(.+)$/.exec(e.range);
  if (m) {
    sp = m[1].trim().replace(/^卷中/, '');
    ep = m[2].trim().replace(/竟$/, '').replace(/^卷末$/, '');
  }
  return { ...e, startPhrase: sp, endPhrase: ep, startU: null as number | null, endU: null as number | null };
});

// 依目錄順序、在該卷前後緩衝區內定位
let cursor = -1;
for (const a of out) {
  const jr = juanRange[a.juan] || { lo: 0, hi: sutra.sentences.length - 1 };
  const lo = Math.max(cursor + 1, jr.lo - 80);
  const hi = jr.hi + 120;
  const su0 = a.startPhrase ? find(a.startPhrase, lo, hi) : null;
  const conf = su0 != null;
  const su = conf ? su0! : cursor + 1;
  const eu = a.endPhrase ? find(a.endPhrase, su, hi) : null;
  (a as any).conf = conf;
  a.startU = su;
  a.endU = eu;
  cursor = eu != null ? eu : su;
}

// 沒錨到的節，用同卷前後錨點平均分配
for (const j of Object.keys(juanRange).map(Number)) {
  const jr = juanRange[j];
  const secs = out.filter((x) => x.juan === j);
  if (!secs.length) continue;
  // 先把 conf 的起點固定，其餘在區間內插
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    if (s.conf) continue;
    // 上一個錨（含卷首）
    let prevU = jr.lo;
    let prevIdx = -1;
    for (let k = i - 1; k >= 0; k--) {
      if (secs[k].conf) { prevU = secs[k].startU!; prevIdx = k; break; }
    }
    // 下一個錨（含卷末）
    let nextU = jr.hi + 1;
    let nextIdx = secs.length;
    for (let k = i + 1; k < secs.length; k++) {
      if (secs[k].conf) { nextU = secs[k].startU!; nextIdx = k; break; }
    }
    const slots = nextIdx - prevIdx;
    const at = i - prevIdx;
    s.startU = Math.round(prevU + ((nextU - prevU) * at) / Math.max(1, slots));
  }
  // 依起點排序後，終點＝下一節起點-1；最後一節到卷末
  const sorted = secs.slice().sort((a, b) => (a.startU! - b.startU!));
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].endU = i + 1 < sorted.length ? sorted[i + 1].startU! - 1 : jr.hi;
  }
}
// 每卷第一節至少從該卷第一句開始（蒙鈔卷界≈大正卷界）
for (const j of Object.keys(juanRange).map(Number)) {
  const secs = out.filter((x) => x.juan === j).sort((a, b) => a.startU! - b.startU!);
  if (!secs.length) continue;
  const jr = juanRange[j];
  if (secs[0].startU! > jr.lo) secs[0].startU = jr.lo;
}

// 全序重整：讓分節連續（缺口往前併），並補卷首
out.sort((a, b) => (a.startU! - b.startU!));
let prevEnd = 45; // 卷首 0..45
for (let i = 0; i < out.length; i++) {
  if (out[i].startU! > prevEnd + 1) out[i].startU = prevEnd + 1;
  out[i].endU = i + 1 < out.length ? Math.max(out[i].startU!, out[i + 1].startU! - 1) : sutra.sentences.length - 1;
  prevEnd = out[i].endU!;
}

const sections = [
  { juan: 0, code: '卷首', title: '序', startPhrase: '', endPhrase: '', range: '', startU: 0, endU: 45, conf: true },
  ...out,
];
const total = sections.reduce((a, s) => a + (s.endU! - s.startU! + 1), 0);
console.log(`分節 ${sections.length}，覆蓋 ${total} 句 / 共 ${sutra.sentences.length}`);
for (const s of sections) console.log(`${String(s.startU).padStart(4)}..${String(s.endU).padStart(4)}  ${s.juan}卷 ${s.code} ${s.title || s.startPhrase}`);

writeFileSync(join(DATA, 'ke-anchors.json'), JSON.stringify({ schema: 1, source: 'X287 目錄', sections }, null, 1) + '\n');
