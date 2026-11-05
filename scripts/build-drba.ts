#!/usr/bin/env bun
/**
 * 宣化上人《楞嚴經簡要科判》（DRBA）→ 節點樹＋位置。
 *
 *   bun run scripts/build-drba.ts
 *
 * 讀 data/kepan/drba-outline.html、data/sutra.json
 * 寫 data/kepan/drba.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

let h = readFileSync(join(DATA, 'kepan', 'drba-outline.html'), 'utf8');
h = h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
const lines = h
  .split(/\r?\n/)
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：]/g, '');
const SN = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));
const LAST = sutra.sentences[sutra.sentences.length - 1].i;

const nodes: { lv: number; lab: string; nm: string; par: number | null; ch: number[]; u: number; u2: number }[] = [];
const stack: number[] = [];
for (const ln of lines) {
  const m = /^([A-Z])(\d+)\s+(.{2,})$/.exec(ln);
  if (!m) continue;
  const lv = m[1].charCodeAt(0) - 64;
  while (stack.length && nodes[stack[stack.length - 1]].lv >= lv) stack.pop();
  const par = stack.length ? stack[stack.length - 1] : null;
  const id = nodes.length;
  nodes.push({ lv, lab: m[1] + m[2], nm: m[3].slice(0, 24), par, ch: [], u: 0, u2: 0 });
  if (par != null) nodes[par].ch.push(id);
  stack.push(id);
}

const N = nodes.length;
// 位置：用「（卷N終）」當硬錨，其餘在錨點之間等比
const juanLast: Record<number, number> = {};
const juanFirst: Record<number, number> = {};
for (const s of sutra.sentences) {
  juanLast[s.juan] = s.i;
  if (juanFirst[s.juan] == null) juanFirst[s.juan] = s.i;
}
const CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const marks: { idx: number; u: number }[] = [];
// 三大分：用科判錨定的分節起點
try {
  const ka = JSON.parse(readFileSync(join(DATA, 'ke-anchors.json'), 'utf8')).sections as any[];
  const find = (kw: string) => ka.find((s) => (s.title || '').includes(kw) || (s.code || '').includes(kw));
  const zheng = find('正說'); const liu = find('流通');
  nodes.forEach((nd, i) => {
    if (/正宗分/.test(nd.nm) && zheng) marks.push({ idx: i, u: zheng.startU });
    if (/流通分/.test(nd.nm) && liu) marks.push({ idx: i, u: liu.startU });
  });
} catch (e) {}
nodes.forEach((nd, i) => {
  const m = /卷([一二三四五六七八九十]+)\s*終/.exec(nd.nm);
  if (m) {
    const j = CN[m[1]] || 0;
    if (juanLast[j] != null) marks.push({ idx: i, u: juanLast[j] });
  }
});
marks.sort((a, b) => a.idx - b.idx || a.u - b.u);
const anchors: { idx: number; u: number }[] = [];
for (const m of marks) {
  if (anchors.length && m.u <= anchors[anchors.length - 1].u) continue;
  anchors.push(m);
}
if (!anchors.length || anchors[0].idx > 0) anchors.unshift({ idx: 0, u: 0 });
if (anchors[anchors.length - 1].idx < nodes.length - 1) anchors.push({ idx: nodes.length - 1, u: LAST });
for (let k = 0; k + 1 < anchors.length; k++) {
  const a = anchors[k], b = anchors[k + 1];
  nodes[a.idx].u = a.u;
  for (let i = a.idx + 1; i < b.idx; i++) {
    nodes[i].u = Math.round(a.u + ((b.u - a.u) * (i - a.idx)) / Math.max(1, b.idx - a.idx));
  }
}
nodes[anchors[anchors.length - 1].idx].u = anchors[anchors.length - 1].u;
let cur = 0;
for (let i = 0; i < nodes.length; i++) { if (nodes[i].u < cur) nodes[i].u = cur; cur = nodes[i].u; }
for (let i = 0; i < nodes.length; i++) nodes[i].u2 = i + 1 < nodes.length ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : LAST;

const roots = nodes.filter((x) => x.par == null).map((_, i) => i);
console.log(`節點 ${N}，層 ${Math.max(...nodes.map((x) => x.lv))}，根 ${nodes.filter((x) => x.par == null).length}`);
writeFileSync(join(DATA, 'kepan', 'drba-outline.json'), JSON.stringify({ schema: 1, nodes }, null, 0) + '\n');
