#!/usr/bin/env bun
/**
 * 節點級錨定（A 案）：用蒙鈔的「經文引文 → 【疏】」結構取得密集錨點，
 * 再把子璿科文的節點依序放進這些錨點。
 *
 *   bun run scripts/build-ke-nodes.ts
 *
 * 讀 data/works/X287.json（蒙鈔）、data/works/X265.json（科文）、data/sutra.json
 * 寫 data/ke-nodes.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：]/g, '');

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; page: string; text: string }[];
};
const x287 = JSON.parse(readFileSync(join(DATA, 'works', 'X287.json'), 'utf8')) as { lines: { text: string }[] };
const x265 = JSON.parse(readFileSync(join(DATA, 'works', 'X265.json'), 'utf8')) as { lines: { text: string }[] };

const sentNorm = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));

function findSent(q: string): number | null {
  const n = norm(q);
  if (n.length < 4) return null;
  const p = n.slice(0, Math.min(n.length, 24));
  const head = sentNorm.find((x) => x.n.startsWith(p));
  if (head) return head.i;
  const p2 = n.slice(0, 12);
  const inner = sentNorm.find((x) => x.n.includes(p2));
  return inner ? inner.i : null;
}

// ---- 1. 蒙鈔：每個【疏】前的引文 → 錨點
const rawAnchors: number[] = [];
let buf: string[] = [];
for (const ln of x287.lines.map((l) => l.text)) {
  if (ln.includes('【疏】')) {
    const q = buf.length ? buf[buf.length - 1] : '';
    const u = q ? findSent(q) : null;
    if (u != null) rawAnchors.push(u);
    buf = [];
  } else buf.push(ln);
}
rawAnchors.sort((a, b) => a - b);
const uniq: number[] = [];
for (const u of rawAnchors) if (!uniq.length || u > uniq[uniq.length - 1]) uniq.push(u);

// ---- 2. 科文節點（層級由序號規則推）
const CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const lines = x265.lines.map((l) => l.text.trim()).filter(Boolean);
const start = lines.findIndex((t) => t === '釋經分');
type Node = { order: number; text: string; level: number; u: number };
const nodes: Node[] = [];
const stack: number[] = [];
for (let i = start + 1; i < lines.length; i++) {
  const m = /^([一二三四五六七八九十]+)(.*)$/.exec(lines[i]);
  if (!m) continue;
  const n = CN[m[1]];
  if (!n) continue;
  if (!stack.length) { stack.push(n); nodes.push({ order: nodes.length, text: m[2], level: 0, u: 0 }); continue; }
  if (n === 1) { stack.push(1); nodes.push({ order: nodes.length, text: m[2], level: stack.length - 1, u: 0 }); continue; }
  while (stack.length && stack[stack.length - 1] + 1 !== n) stack.pop();
  if (!stack.length) { stack.push(n); nodes.push({ order: nodes.length, text: m[2], level: 0, u: 0 }); }
  else { stack[stack.length - 1] = n; nodes.push({ order: nodes.length, text: m[2], level: stack.length - 1, u: 0 }); }
}

// ---- 3. 依序把節點放進錨點序列（等比對位）
const N = nodes.length;
const A = uniq.length;
nodes.forEach((nd, i) => {
  const t = N <= 1 ? 0 : Math.round((i * (A - 1)) / (N - 1));
  nd.u = uniq[Math.max(0, Math.min(A - 1, t))];
});

writeFileSync(join(DATA, 'ke-nodes.json'), JSON.stringify({ schema: 2, source: 'X287 疏前引文 + X265 科文', anchors: uniq.length, nodes }, null, 0) + '\n');
console.log(`錨點 ${A}，節點 ${N}，平均每錨點 ${(N / Math.max(1, A)).toFixed(1)} 節點`);
console.log('前 10 節點：');
for (const nd of nodes.slice(0, 10)) console.log(`  u=${nd.u} L${nd.level} ${nd.text}`);
