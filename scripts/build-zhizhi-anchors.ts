#!/usr/bin/env bun
/**
 * 直指：用「章節經文」把 zhizhi.json 的節點錨到主文句。
 *
 *   bun run scripts/build-zhizhi-anchors.ts
 *
 * 讀 data/kepan/zhizhi-sutra.json（章：chain+sutra）、data/kepan/zhizhi.json
 * 寫回 data/kepan/zhizhi.json（更新 u/u2）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const CH = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; text: string }[];
};
const norm = (t: string) => t.replace(/[「」『』（）()\s，。、；：！？…—·：.]/g, '').replace(/祗/g, '祇').replace(/盤/g, '槃').replace(/陁/g, '陀');
const SN = sutra.sentences.map((s) => ({ i: s.i, n: norm(s.text) }));
const LAST = sutra.sentences[sutra.sentences.length - 1].i;

const chapters = JSON.parse(readFileSync(join(DATA, 'kepan', 'zhizhi-sutra.json'), 'utf8')) as Record<string, { chain: string; sutra: string }>;
const zj = JSON.parse(readFileSync(join(DATA, 'kepan', 'zhizhi.json'), 'utf8')) as { nodes: any[] };
const nodes = zj.nodes;

const segName = (seg: string) => seg.replace(/分[一二三四五六七八九十]+$/, '').replace(/[，。；、]$/, '').trim();

let pi = 0;
let ni = 0;
let hit = 0;
let total = 0;
const touched = new Set<number>();
for (const [id, ch] of Object.entries(chapters)) {
  if (!ch.sutra) continue;
  total++;
  const key = norm(ch.sutra);
  if (key.length < 4) continue;
  // 找最深一節的名稱
  const marks: { pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp('[' + CH + '](初|二|三|四|五|六|七|八|九|十)', 'g');
  while ((m = rx.exec(ch.chain))) marks.push({ pos: m.index, end: m.index + m[0].length });
  if (!marks.length) continue;
  const lastSeg = segName(ch.chain.slice(marks[marks.length - 1].end));
  // 在節點序列裡找對應（從上次位置往後 40 個）
  let idx = -1;
  for (let k = Math.max(0, ni - 5); k < Math.min(nodes.length, ni + 60); k++) {
    if (nodes[k].nm && (nodes[k].nm === lastSeg || lastSeg.startsWith(nodes[k].nm) || nodes[k].nm.startsWith(lastSeg.slice(0, 4)))) { idx = k; break; }
  }
  if (idx < 0) continue;
  ni = idx + 1;
  // 對經文
  let u = -1;
  for (let i = pi; i < Math.min(pi + 120, SN.length); i++) {
    if (SN[i].n.startsWith(key.slice(0, 8)) || SN[i].n.includes(key.slice(0, 8))) { u = i; break; }
  }
  if (u >= 0) { nodes[idx].u = u; touched.add(idx); pi = u + 1; hit++; }
  else nodes[idx].u = pi;
}

// 未錨的節點：在相鄰已錨之間內插
const anchors = nodes.map((n, i) => ({ i, u: n.u })).filter((x) => touched.has(x.i));
for (let a = 0; a < anchors.length; a++) {
  const A = anchors[a];
  const B = a + 1 < anchors.length ? anchors[a + 1] : { i: nodes.length, u: LAST };
  for (let k = A.i + 1; k < B.i; k++) {
    if (touched.has(k)) continue;
    nodes[k].u = Math.round(A.u + ((B.u - A.u) * (k - A.i)) / Math.max(1, B.i - A.i));
  }
}
let cur = 0;
for (const n of nodes) { if (n.u < cur) n.u = cur; cur = n.u; }
for (let i = 0; i < nodes.length; i++) nodes[i].u2 = i + 1 < nodes.length ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : LAST;

writeFileSync(join(DATA, 'kepan', 'zhizhi.json'), JSON.stringify({ schema: 1, nodes }, null, 0) + '\n');
console.log(`章 ${total}、錨上 ${hit}；節點 ${nodes.length}`);
