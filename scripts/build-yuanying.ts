#!/usr/bin/env bun
/**
 * 圓瑛《楞嚴經講義》科判 → 節點樹。
 * 來源：metaprgmr.github.io 的 parts[0] 固定寬度文字；
 * 層級由「（甲）（乙）（丙）…」標記決定，未標記者沿用上一層。
 *
 *   bun run scripts/build-yuanying.ts
 *
 * 讀 data/kepan/yuanying-kepan.js、data/sutra.json → 寫 data/kepan/yuanying.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');

const js = readFileSync(join(DATA, 'kepan', 'yuanying-kepan.js'), 'utf8');
const parts = [...js.matchAll(/parts\[\d+\]\s*=\s*`([\s\S]*?)`;/g)].map((m) => m[1]);
if (!parts.length) throw new Error('parts not found');

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};
const juanRange: Record<number, [number, number]> = {};
for (const s of sutra.sentences) {
  if (!juanRange[s.juan]) juanRange[s.juan] = [s.i, s.i];
  juanRange[s.juan][1] = s.i;
}
const TABLES: Record<number, number> = { 1: 9, 2: 10, 3: 11, 4: 12, 5: 7, 6: 8, 7: 9, 8: 11, 9: 11, 10: 9 };
const LEVELS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

type N = { lv: number; lab: string; nm: string; par: number | null; ch: number[]; u: number; u2: number; v?: { j: number; t: number } };
const nodes: N[] = [];
let curLv = 1;
let curVerse: { j: number; t: number } | null = null;

for (const rawText of parts) {
  for (const line of rawText.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idPart = line.slice(2, 6).trim();
    const body = line.slice(6);
    const vm = /^([A-Z])(\d{3})$/.exec(idPart);
    if (vm) curVerse = { j: vm[1].charCodeAt(0) - 64, t: +vm[2] };
    const text = body.replace(/^[：　\s]+/, '').trim();
    if (!text) continue;
    const lm = /^（([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])）/.exec(text);
    if (lm) curLv = LEVELS.indexOf(lm[1]) + 1;
    const t2 = text.replace(/^（[^）]+）/, '');
    const om = /^(初|次|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五)/.exec(t2);
    const ord = om ? om[1] : '';
    const nm = t2
      .replace(/^(初|次|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五)[，,、]?/, '')
      .replace(/[*+]/g, '')
      .replace(/[，,]$/, '')
      .trim();
    if (!nm) continue;
    const star = text.includes('*');
    const plus = text.includes('+');
    nodes.push({ lv: curLv, lab: (lm ? lm[1] : '') + ord, nm, par: null, ch: [], u: 0, u2: 0, v: curVerse || undefined, star, plus } as any);
  }
}

const st: number[] = [];
for (let i = 0; i < nodes.length; i++) {
  while (st.length && nodes[st[st.length - 1]].lv >= nodes[i].lv) st.pop();
  if (st.length) { nodes[i].par = st[st.length - 1]; nodes[st[st.length - 1]].ch.push(i); }
  st.push(i);
}

let last = 0;
for (const n of nodes) {
  if (n.v) {
    const r = juanRange[n.v.j];
    if (r) {
      const total = TABLES[n.v.j] || 10;
      n.u = Math.round(r[0] + Math.min(1, (n.v.t - 1) / Math.max(1, total)) * (r[1] - r[0]));
    }
  }
  if (!n.v || !n.u) n.u = last;
  if (n.u < last) n.u = last;
  last = n.u;
}
for (let i = 0; i < nodes.length; i++) nodes[i].u2 = i + 1 < nodes.length ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : 3731;

const N = nodes.length;
const dist: Record<number, number> = {};
for (const n of nodes) dist[n.lv] = (dist[n.lv] || 0) + 1;
console.log(`節點 ${N}，層 ${Math.max(...nodes.map((n) => n.lv))}，根 ${nodes.filter((n) => n.par == null).length}`);
console.log('分布', Object.keys(dist).sort((a, b) => +a - +b).map((k) => k + ':' + dist[+k]).join(' '));
console.log(nodes.slice(0, 8).map((n) => n.lab + n.nm.slice(0, 8)).join(' | '));
function emit(file: string, keep: (n: any) => boolean) {
  const keepIdx = new Map<number, number>();
  const picked: any[] = [];
  nodes.forEach((n, i) => { if (keep(n)) { keepIdx.set(i, picked.length); picked.push(n); } });
  const out = picked.map((n, i) => {
    let par = null;
    for (let k = i - 1; k >= 0; k--) { const orig = [...keepIdx.entries()].find(([o, ni]) => ni === k)?.[0]; if (orig == null) continue; if (nodes[orig].lv < n.lv) { par = k; break; } }
    return { lv: n.lv, lab: n.lab, nm: n.nm, par, ch: [] as number[], u: n.u, u2: n.u2 };
  });
  out.forEach((n, i) => { if (n.par != null) out[n.par].ch.push(i); });
  writeFileSync(join(DATA, 'kepan', file), JSON.stringify({ schema: 1, nodes: out }, null, 0) + '\n');
  console.log(file, out.length);
}
emit('yuanying.json', () => true);
emit('yuanying-terse1.json', (n) => !!n.star || !!n.plus);
emit('yuanying-terse2.json', (n) => !!n.star);
