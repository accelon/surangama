#!/usr/bin/env bun
/**
 * 六家科判的節點位置：共用蒙鈔疏前引文錨點（750），各科節點依序等比放入。
 *
 *   bun run scripts/build-ke-nodes-all.ts
 *
 * 讀 data/works/X265,X273,X278,X290,X304,X314.json、data/works/X287.json、data/sutra.json
 * 寫 data/ke-nodes-all.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：]/g, '');

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; text: string }[];
};
const x287 = JSON.parse(readFileSync(join(DATA, 'works', 'X287.json'), 'utf8')) as { lines: { text: string }[] };
const SN = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));

function findSent(q: string): number | null {
  const n = norm(q);
  if (n.length < 4) return null;
  const p = n.slice(0, Math.min(n.length, 24));
  const h = SN.find((x) => x.n.startsWith(p));
  if (h) return h.i;
  const p2 = n.slice(0, 12);
  const inn = SN.find((x) => x.n.includes(p2));
  return inn ? inn.i : null;
}

// 錨點
const raw: number[] = [];
let buf: string[] = [];
for (const ln of x287.lines.map((l) => l.text)) {
  if (ln.includes('【疏】')) {
    const q = buf.length ? buf[buf.length - 1].trim() : '';
    const u = q ? findSent(q) : null;
    if (u != null) raw.push(u);
    buf = [];
  } else buf.push(ln);
}
raw.sort((a, b) => a - b);
const anchors: number[] = [];
for (const u of raw) if (!anchors.length || u > anchors[anchors.length - 1]) anchors.push(u);

const CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const KE = ['X265', 'X273', 'X278', 'X290', 'X304', 'X314'];

const byKe: Record<string, any[]> = {};
for (const id of KE) {
  const w = JSON.parse(readFileSync(join(DATA, 'works', `${id}.json`), 'utf8')) as { lines: { text: string }[] };
  const lines = w.lines.map((l) => l.text.trim()).filter(Boolean);
  let start = lines.findIndex((t) => /^(釋經分|科判|科文)/.test(t));
  if (start < 0) start = 0;
  const nodes: { order: number; text: string; level: number; u: number }[] = [];
  const stack: number[] = [];
  for (let i = start; i < lines.length; i++) {
    const m = /^([一二三四五六七八九十]+)(.*)$/.exec(lines[i]);
    if (!m) continue;
    const n = CN[m[1]];
    if (!n) continue;
    let level = 0;
    if (!stack.length) { stack.push(n); level = 0; }
    else if (n === 1) { stack.push(1); level = stack.length - 1; }
    else {
      while (stack.length && stack[stack.length - 1] + 1 !== n) stack.pop();
      if (!stack.length) { stack.push(n); level = 0; }
      else { stack[stack.length - 1] = n; level = stack.length - 1; }
    }
    nodes.push({ order: nodes.length, text: m[2], level, u: 0 });
  }
  const N = nodes.length;
  const A = anchors.length;
  nodes.forEach((nd, i) => {
    const t = N <= 1 ? 0 : Math.round((i * (A - 1)) / (N - 1));
    nd.u = anchors[Math.max(0, Math.min(A - 1, t))];
  });
  byKe[id] = nodes;
  console.log(`${id}: ${N} 節點，最深 L${Math.max(...nodes.map((x) => x.level))}`);
}

writeFileSync(join(DATA, 'ke-nodes-all.json'), JSON.stringify({ schema: 1, anchors: anchors.length, byKe }, null, 0) + '\n');
console.log('錨點', anchors.length, '→ data/ke-nodes-all.json');
