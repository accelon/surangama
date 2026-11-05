#!/usr/bin/env bun
/**
 * 子璿《長水疏》科判（kepanhuizong b_1_06.pdf 文字層）。
 * 層級＝「甲初…」標記字；位置用「（表 X-Y）」換算。
 *
 *   bun run scripts/build-changshui.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const LEVELS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

const raw = readFileSync(join(DATA, 'kepan', 'changshui-pdf.txt'), 'utf8');
const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};
const juanRange: Record<number, [number, number]> = {};
for (const s of sutra.sentences) {
  if (!juanRange[s.juan]) juanRange[s.juan] = [s.i, s.i];
  juanRange[s.juan][1] = s.i;
}
const TABLES: Record<number, number> = { 1: 13, 2: 17, 3: 11, 4: 14, 5: 9, 6: 15, 7: 15, 8: 15, 9: 17, 10: 11 };

type N = { lv: number; lab: string; nm: string; par: number | null; ch: number[]; u: number; u2: number };
const nodes: N[] = [];
const marker = new RegExp('([' + LEVELS + '])(初|二|三|四|五|六|七|八|九|十)', 'g');

for (const line of raw.split(/\r?\n/)) {
  const text = line.trim();
  if (!text) continue;
  const ref = /表\s*(\d+)\s*[-–]\s*(\d+)/.exec(text);
  const marks: { lv: number; lab: string; pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(marker.source, 'g');
  while ((m = rx.exec(text))) marks.push({ lv: LEVELS.indexOf(m[1]) + 1, lab: m[1] + m[2], pos: m.index, end: m.index + m[0].length });
  if (!marks.length) continue;
  for (let k = 0; k < marks.length; k++) {
    let seg = text.slice(marks[k].end, k + 1 < marks.length ? marks[k + 1].pos : undefined);
    seg = seg.replace(/（表[^）]*）/g, '').replace(/表\s*\d+\s*[-–]\s*\d+/g, '').replace(/[（(].*?[)）]/g, '').trim().replace(/分[一二三四五六七八九十]+$/, '').trim();
    if (!seg) continue;
    const nd: N & { tab?: any } = { lv: marks[k].lv, lab: marks[k].lab, nm: seg.slice(0, 24), par: null, ch: [], u: 0, u2: 0 };
    (nd as any).tab = ref ? { j: +ref[1], t: +ref[2] } : null;
    nodes.push(nd);
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
  const tb = (n as any).tab;
  if (tb) {
    const r = juanRange[tb.j];
    if (r) n.u = Math.round(r[0] + Math.min(1, (tb.t - 1) / Math.max(1, TABLES[tb.j] || 12)) * (r[1] - r[0]));
  }
  if (!tb) n.u = last;
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
writeFileSync(join(DATA, 'kepan', 'changshui.json'), JSON.stringify({ schema: 1, nodes: nodes.map(({ ...rest }: any) => rest) }, null, 0) + '\n');
