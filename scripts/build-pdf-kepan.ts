#!/usr/bin/env bun
/**
 * 通用：kepanhuizong PDF 文字層 → 科判樹（甲乙丙…層級 + 表號錨定）。
 *
 *   bun run scripts/build-pdf-kepan.ts <輸入.txt> <輸出.json> <每卷表數，逗號分隔>
 *
 * 例：bun run scripts/build-pdf-kepan.ts data/kepan/b_1_05.txt data/kepan/yaojie.json 6,7,6,8,5,6,7,7,8,7
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const DATA = join(ROOT, 'data');
const LEVELS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';

const [input, output, tablesArg] = process.argv.slice(2);
if (!input || !output || !tablesArg) {
  console.error('用法：build-pdf-kepan.ts <輸入.txt> <輸出.json> <每卷表數>');
  process.exit(1);
}
const TABLES: Record<number, number> = {};
tablesArg.split(',').forEach((v, i) => { TABLES[i + 1] = +v; });

const raw = readFileSync(join(ROOT, input), 'utf8');
const sutra = JSON.parse(readFileSync(join(DATA, 'sutra.json'), 'utf8')) as {
  sentences: { i: number; juan: number; text: string }[];
};
const juanRange: Record<number, [number, number]> = {};
for (const s of sutra.sentences) {
  if (!juanRange[s.juan]) juanRange[s.juan] = [s.i, s.i];
  juanRange[s.juan][1] = s.i;
}

type N = { lv: number; lab: string; nm: string; par: number | null; ch: number[]; u: number; u2: number };
const nodes: (N & { tab?: any })[] = [];
let pending: any = null;
const marker = new RegExp('([' + LEVELS + '])(初|二|三|四|五|六|七|八|九|十)', 'g');

for (const line of raw.split(/\r?\n/)) {
  const text = line.trim();
  if (!text) continue;
  const ref0 = /表\s*(\d+)\s*[-–]\s*(\d+)/.exec(text);
  const ref = ref0 ? { j: +ref0[1], t: +ref0[2] } : pending;
  const marks: { lv: number; lab: string; pos: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(marker.source, 'g');
  while ((m = rx.exec(text))) marks.push({ lv: LEVELS.indexOf(m[1]) + 1, lab: m[1] + m[2], pos: m.index, end: m.index + m[0].length });
  if (!marks.length) { if (ref0) pending = { j: +ref0[1], t: +ref0[2] }; continue; }
  for (let k = 0; k < marks.length; k++) {
    let seg = text.slice(marks[k].end, k + 1 < marks.length ? marks[k + 1].pos : undefined);
    seg = seg.replace(/（表[^）]*）/g, '').replace(/表\s*\d+\s*[-–]\s*\d+/g, '').replace(/[（(].*?[)）]/g, '').trim();
    // 砍掉後面的經文：前 16 字內出現空白就切
    const sp = seg.search(/[\s　]/);
    if (sp > 0 && sp <= 16) seg = seg.slice(0, sp);
    seg = seg.replace(/分[一二三四五六七八九十]+$/, '').replace(/[，。；、]$/, '').trim();
    if (!seg) continue;
    nodes.push({ lv: marks[k].lv, lab: marks[k].lab, nm: seg.slice(0, 24), par: null, ch: [], u: 0, u2: 0, tab: ref || null });
  pending = null;
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
  if (n.tab) {
    const r = juanRange[n.tab.j];
    if (r) n.u = Math.round(r[0] + Math.min(1, (n.tab.t - 1) / Math.max(1, TABLES[n.tab.j] || 10)) * (r[1] - r[0]));
  }
  if (!n.tab) n.u = last;
  if (n.u < last) n.u = last;
  last = n.u;
}
for (let i = 0; i < nodes.length; i++) nodes[i].u2 = i + 1 < nodes.length ? Math.max(nodes[i].u, nodes[i + 1].u - 1) : 3731;

const N = nodes.length;
const dist: Record<number, number> = {};
for (const n of nodes) dist[n.lv] = (dist[n.lv] || 0) + 1;
console.log(`${output}: 節點 ${N}，層 ${Math.max(...nodes.map((n) => n.lv))}，根 ${nodes.filter((n) => n.par == null).length}，帶表號 ${nodes.filter((n) => n.tab).length}`);
console.log('分布', Object.keys(dist).sort((a, b) => +a - +b).map((k) => k + ':' + dist[+k]).join(' '));
console.log(nodes.slice(0, 6).map((n) => n.lab + n.nm.slice(0, 10)).join(' | '));
writeFileSync(join(DATA, 'kepan', output), JSON.stringify({ schema: 1, nodes: nodes.map(({ tab, ...rest }) => rest) }, null, 0) + '\n');
