#!/usr/bin/env bun
/**
 * 法界佛教總會《楞嚴經科判》（含經文，PDF）→ 節點樹＋精確錨定。
 *
 *   bun run scripts/build-drba-pdf.ts
 *
 * 讀 data/kepan/drba-pdf.txt、data/sutra.json
 * 寫 data/kepan/drba.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const raw = readFileSync(join(DATA, 'kepan', 'drba-pdf.txt'), 'utf8');
const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};

const VAR: [RegExp, string][] = [
  [/祗/g, '祇'], [/盤/g, '槃'], [/陁/g, '陀'], [/賖/g, '奢'], [/魔/g, '魔'],
];
const norm = (t: string) => {
  let s = t.replace(/[「」『』（）()\s，。、；：！？…—·：,.]/g, '');
  for (const [re, to] of VAR) s = s.replace(re, to);
  return s;
};
const SN = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));
const LAST = sutra.sentences[sutra.sentences.length - 1].i;
const FW = 'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ';
const CH = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

type N = { lv: number; lab: string; nm: string; st: string; u: number; par: number | null; ch: number[]; exact: number };
const nodes: N[] = [];
for (const ln of raw.split(/\r?\n/)) {
  const m = /^([Ａ-Ｚ])(\d+)\s+(.*)$/.exec(ln.trim());
  if (!m) continue;
  const lv = FW.indexOf(m[1]) + 1;
  const parts = m[3].split(/\s{2,}/);
  const nm = (parts[0] || '').replace(/（分[一二三四五六七八九十]+）$/, '').trim();
  const st = (parts[1] || '').trim();
  nodes.push({ lv, lab: (CH[lv - 1] || m[1]) + m[2], nm, st, u: 0, par: null, ch: [], exact: 0 });
}

// 樹
const stack: number[] = [];
for (let i = 0; i < nodes.length; i++) {
  while (stack.length && nodes[stack[stack.length - 1]].lv >= nodes[i].lv) stack.pop();
  if (stack.length) { nodes[i].par = stack[stack.length - 1]; nodes[stack[stack.length - 1]].ch.push(i); }
  stack.push(i);
}

// 錨定
let pi = 0;
let matched = 0;
for (const nd of nodes) {
  if (!nd.st) { nd.u = pi; continue; }
  const key = norm(nd.st);
  let hit = -1;
  for (let i = pi; i < Math.min(pi + 200, SN.length); i++) {
    const n = SN[i].n;
    if (n.startsWith(key.slice(0, 8)) || (key.length >= 6 && n.includes(key.slice(0, 8))) || (key.length >= 10 && n.includes(key.slice(2, 10))) || (key.length >= 8 && n.includes(key.slice(0, 6)))) { hit = i; break; }
  }
  if (hit >= 0) { nd.u = hit; nd.exact = 1; pi = hit + 1; matched++; } else nd.u = pi;
}
// 未錨上的節點：在相鄰已錨節點之間依序內插（不要全部擠在前一個）
const anchors = nodes.map((n, i) => ({ i, u: n.u, ok: n.exact })).filter((x) => x.ok);
for (let a = 0; a < anchors.length; a++) {
  const A = anchors[a];
  const B = a + 1 < anchors.length ? anchors[a + 1] : { i: nodes.length, u: LAST };
  const span = B.i - A.i;
  for (let k = A.i + 1; k < B.i; k++) {
    if (nodes[k].exact) continue;
    nodes[k].u = Math.round(A.u + ((B.u - A.u) * (k - A.i)) / Math.max(1, span));
  }
}
// 開頭與結尾
for (let k = 0; k < (anchors[0] ? anchors[0].i : nodes.length); k++) nodes[k].u = Math.min(nodes[k].u, anchors[0] ? anchors[0].u : 0);
// 單調
let cur = 0;
for (const nd of nodes) { if (nd.u < cur) nd.u = cur; cur = nd.u; }
for (let i = 0; i < nodes.length; i++) nodes[i].u = Math.min(nodes[i].u, LAST);
// 節點 u2
const out = nodes.map((n, i) => ({
  lv: n.lv, lab: n.lab, nm: n.nm, par: n.par, ch: n.ch, u: n.u,
  u2: i + 1 < nodes.length ? Math.max(n.u, nodes[i + 1].u - 1) : LAST, exact: n.exact,
}));
console.log(`節點 ${nodes.length}，有經文 ${nodes.filter((n) => n.st).length}，錨上 ${matched}，最深 ${Math.max(...nodes.map((n) => n.lv))}`);
writeFileSync(join(DATA, 'kepan', 'drba.json'), JSON.stringify({ schema: 2, nodes: out }, null, 0) + '\n');
const show = nodes.slice(0, 8);
for (const n of show) console.log(n.lab, n.nm.slice(0, 12), 'u', n.u, n.st ? '「' + n.st.slice(0, 14) + '」' : '');
